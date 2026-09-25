import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getStoredSession, mergeCookies, buildCookieHeader, extractCsrfTokenFromCookies, storeSession } from '@/lib/poliweb-session';
import {
    POLIWEB_BASE,
    POLIWEB_HOST,
    resolvePoliwebUrl,
    shouldRewriteProxiedHtmlUrl,
} from '@/lib/security/safe-url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FORWARDED_RESPONSE_HEADERS = [
    'content-type',
    'content-length',
    'content-encoding',
    'cache-control',
    'etag',
    'last-modified',
    'accept-ranges',
    'expires',
];

function guessContentTypeFromPath(pathname: string): string | null {
    const normalized = pathname.toLowerCase();
    if (normalized.endsWith('.ttf')) return 'font/ttf';
    if (normalized.endsWith('.otf')) return 'font/otf';
    if (normalized.endsWith('.woff')) return 'font/woff';
    if (normalized.endsWith('.woff2')) return 'font/woff2';
    if (normalized.endsWith('.css')) return 'text/css; charset=utf-8';
    if (normalized.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (normalized.endsWith('.svg')) return 'image/svg+xml';
    if (normalized.endsWith('.png')) return 'image/png';
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
    if (normalized.endsWith('.gif')) return 'image/gif';
    return null;
}

function copyAllowedHeaders(upstreamHeaders: Headers, fallbackPath: string): Headers {
    const headers = new Headers();
    for (const headerName of FORWARDED_RESPONSE_HEADERS) {
        const value = upstreamHeaders.get(headerName);
        if (value) {
            headers.set(headerName, value);
        }
    }

    if (!headers.get('content-type')) {
        const guessed = guessContentTypeFromPath(fallbackPath);
        if (guessed) {
            headers.set('content-type', guessed);
        }
    }
    return headers;
}

function isFontPath(pathname: string): boolean {
    const normalized = pathname.toLowerCase();
    return normalized.endsWith('.ttf') || normalized.endsWith('.otf') || normalized.endsWith('.woff') || normalized.endsWith('.woff2');
}

/**
 * Extract JWT token from request cookies or Authorization header
 * Priority: Authorization header > Cookie header
 */
function extractToken(request: NextRequest): string | null {
    // Try Authorization header first
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.replace('Bearer ', '');
    if (headerToken) {
        return headerToken;
    }

    // Fallback to cookies (used by iframe requests)
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').map(c => c.trim());
    
    for (const cookie of cookies) {
        if (cookie.startsWith('abzToken=')) {
            return cookie.split('=')[1]?.split(';')[0] || null;
        }
        if (cookie.startsWith('token=')) {
            return cookie.split('=')[1]?.split(';')[0] || null;
        }
    }

    return null;
}

/**
 * GET /api/poliweb-proxy/[...path]
 * Serves Poliweb content through proxy with session cookies injected
 */
export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
    const params = await props.params;
    try {
        const pathSegments = await Promise.resolve(params.path);
        const targetPath = '/' + pathSegments.join('/');

        // Get user ID from token (Authorization header OR cookies)
        const token = extractToken(request);
        let userId: string | null = null;

        if (token) {
            try {
                const authResult = verifyToken(token);
                if (authResult) {
                    userId = authResult.userId;
                }
            } catch {
                // Token invalid, continue without session
            }
        }

        // Get stored session
        const session = userId ? getStoredSession(userId) : null;
        const cookieHeader = session ? buildCookieHeader(session.cookies) : '';

        // If no session found, redirect to /poliweb to trigger re-login
        if (!session && userId) {
            return new NextResponse(
                `<html><head><script>if(window.top!==window){window.top.location.href='/poliweb'}else{window.location.href='/poliweb'}</script></head><body>Redirecionando para login...</body></html>`,
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
        }

        const url = new URL(request.url);
        const searchParams = url.searchParams.toString();
        const targetUrl = resolvePoliwebUrl(targetPath, searchParams);
        if (targetUrl.protocol !== 'https:' || targetUrl.hostname !== POLIWEB_HOST) {
            return NextResponse.json(
                { error: 'Erro ao conectar ao Poliweb' },
                { status: 502 }
            );
        }

        const response = await fetch(targetUrl.href, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
            },
            redirect: 'manual',
        });

        const contentType = response.headers.get('content-type') || '';

        // Handle redirects
        if (response.status === 302 || response.status === 301) {
            const location = response.headers.get('location');
            if (location) {
                // If redirecting to login and we have a session, session expired
                if (location.includes('Login') && session && userId) {
                    return new NextResponse(
                        `<html><head><meta http-equiv="refresh" content="0;url=/poliweb"></head></html>`,
                        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                    );
                }
                const currentRequestUrl = new URL(request.url);
                const resolvedLocation = new URL(location, POLIWEB_BASE);
                const rewrittenLocation = `${resolvedLocation.pathname}${resolvedLocation.search}`;
                return NextResponse.redirect(new URL(`/api/poliweb-proxy${rewrittenLocation}`, currentRequestUrl));
            }
        }

        if (contentType.includes('text/html')) {
            const html = await response.text();
            const rewrittenHtml = rewriteHtml(html);

            return new NextResponse(rewrittenHtml, {
                status: response.status,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'X-Content-Type-Options': 'nosniff',
                },
            });
        }

        // For non-HTML content (CSS, JS, images, etc.), proxy directly
        const body = await response.arrayBuffer();
        const headers = copyAllowedHeaders(response.headers, targetPath);
        if (!headers.get('cache-control')) {
            headers.set('cache-control', 'public, max-age=86400');
        }

        if (isFontPath(targetPath) && (headers.get('content-type') || '').includes('text/html')) {
            console.warn('Poliweb proxy returned HTML for font request', {
                targetPath,
                status: response.status,
            });
        }

        return new NextResponse(body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    } catch (error) {
        console.error('Erro no proxy Poliweb GET:', error);
        return NextResponse.json(
            { error: 'Erro ao conectar ao Poliweb' },
            { status: 502 }
        );
    }
}

/**
 * POST /api/poliweb-proxy/[...path]
 * Handles form submissions through proxy with session cookies
 */
export async function POST(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
    const params = await props.params;
    try {
        const pathSegments = await Promise.resolve(params.path);
        const targetPath = '/' + pathSegments.join('/');

        // Get user session from token (Authorization header OR cookies)
        const token = extractToken(request);
        let userId: string | null = null;

        if (token) {
            try {
                const authResult = verifyToken(token);
                if (authResult) {
                    userId = authResult.userId;
                }
            } catch {
                // Token invalid, continue without session
            }
        }

        const session = userId ? getStoredSession(userId) : null;
        const cookieHeader = session ? buildCookieHeader(session.cookies) : '';

        const contentType = request.headers.get('content-type') || '';
        let body: string | ArrayBuffer;

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData();
            const formParams = new URLSearchParams();
            formData.forEach((value, key) => {
                formParams.append(key, value as string);
            });
            body = formParams.toString();
        } else {
            body = await request.arrayBuffer();
        }

        const targetUrl = resolvePoliwebUrl(targetPath);
        if (targetUrl.protocol !== 'https:' || targetUrl.hostname !== POLIWEB_HOST) {
            return NextResponse.json(
                { error: 'Erro ao processar requisição' },
                { status: 502 }
            );
        }

        const response = await fetch(targetUrl.href, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'Content-Type': contentType,
                ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
            },
            body,
            redirect: 'manual',
        });

        // Handle session cookies from response
        const responseCookies = response.headers.getSetCookie?.() || [];
        if (responseCookies.length > 0 && userId) {
            const existingSession = getStoredSession(userId);
            const existingCookies = existingSession?.cookies || [];
            const mergedCookies = mergeCookies(existingCookies, responseCookies);
            const csrfToken = session?.csrfToken || extractCsrfTokenFromCookies(responseCookies) || '';
            if (csrfToken) {
                storeSession(userId, mergedCookies, csrfToken);
            }
        }

        const responseContentType = response.headers.get('content-type') || '';

        // Handle redirects
        if ((response.status === 302 || response.status === 301)) {
            const location = response.headers.get('location');
            if (location) {
                const currentRequestUrl = new URL(request.url);
                const resolvedLocation = new URL(location, POLIWEB_BASE);
                const rewrittenLocation = `${resolvedLocation.pathname}${resolvedLocation.search}`;
                return NextResponse.redirect(new URL(`/api/poliweb-proxy${rewrittenLocation}`, currentRequestUrl));
            }
        }

        if (responseContentType.includes('text/html')) {
            const html = await response.text();
            const rewrittenHtml = rewriteHtml(html);

            return new NextResponse(rewrittenHtml, {
                status: response.status,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                },
            });
        }

        const responseBody = await response.arrayBuffer();
        const headers = copyAllowedHeaders(response.headers, targetPath);
        if (!headers.get('content-type') && responseContentType) {
            headers.set('content-type', responseContentType);
        }

        return new NextResponse(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    } catch (error) {
        console.error('Erro no proxy Poliweb POST:', error);
        return NextResponse.json(
            { error: 'Erro ao processar requisição' },
            { status: 502 }
        );
    }
}

function rewriteHtml(html: string): string {
    let result = html;

    // Rewrite relative URLs to go through our proxy
    result = result.replace(/\b(href|src|action)=["'](\/(?!\/)[^"']*)["']/gi, (match, attr, path) => {
        if (!shouldRewriteProxiedHtmlUrl(path)) {
            return match;
        }
        return `${attr}="/api/poliweb-proxy${path}"`;
    });

    // Rewrite absolute URLs to Poliweb
    result = result.replace(/(href|src|action)=["']https:\/\/poliweb\.policlinicamacae\.com\.br\//gi, '$1="/api/poliweb-proxy/');

    // Rewrite CSS url() references
    result = result.replace(/url\(['"]?(\/(?!\/)[^'")]+)['"]?\)/g, (match, path) => {
        return `url('/api/poliweb-proxy${path}')`;
    });

    // Fix form actions to go through proxy
    result = result.replace(/action="\/Identity\/Account\/Login"/g, 'action="/api/poliweb-proxy/Identity/Account/Login"');

    const proxyRuntimePatch = `<script>(function(){try{if(window.__abzPoliwebProxyPatchApplied){return;}window.__abzPoliwebProxyPatchApplied=true;var p='/api/poliweb-proxy';var rw=function(u){return(typeof u==='string'&&u.charAt(0)==='/'&&!u.startsWith(p))?p+u:u;};var of=window.fetch;if(typeof of==='function'){window.fetch=function(input,init){try{if(typeof input==='string'){input=rw(input);}else if(input&&typeof input.url==='string'){input=rw(input.url);} }catch(e){}return of.call(this,input,init);};}var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{u=rw(u);}catch(e){}return oo.apply(this,[m,u].concat([].slice.call(arguments,2)));};}catch(e){}})();</script>`;
    if (result.includes('</head>')) {
        result = result.replace('</head>', `${proxyRuntimePatch}</head>`);
    } else if (result.includes('</body>')) {
        result = result.replace('</body>', `${proxyRuntimePatch}</body>`);
    } else {
        result = `${proxyRuntimePatch}${result}`;
    }

    return result;
}
