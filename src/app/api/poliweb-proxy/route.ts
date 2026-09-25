import { NextRequest, NextResponse } from 'next/server';
import {
  POLIWEB_BASE,
  POLIWEB_HOST,
  resolvePoliwebUrl,
  shouldRewriteProxiedHtmlUrl,
} from '@/lib/security/safe-url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/poliweb-proxy
 * Root proxy - serves the login page or authenticated content
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const targetUrl = resolvePoliwebUrl(url.searchParams.get('path'));
        if (targetUrl.protocol !== 'https:' || targetUrl.hostname !== POLIWEB_HOST) {
            return NextResponse.json(
                { error: 'Erro ao conectar ao Poliweb' },
                { status: 502 }
            );
        }

        const response = await fetch(targetUrl.href, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            redirect: 'manual',
        });

        const html = await response.text();
        const cookies = response.headers.getSetCookie?.() || [];

        // Rewrite HTML to fix asset URLs
        const rewrittenHtml = rewriteHtml(html);

        const nextResponse = new NextResponse(rewrittenHtml, {
            status: response.status,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        });

        // Forward cookies to client
        cookies.forEach(cookie => {
            nextResponse.headers.append('Set-Cookie', cookie);
        });

        return nextResponse;
    } catch (error) {
        console.error('Erro no proxy Poliweb:', error);
        return NextResponse.json(
            { error: 'Erro ao conectar ao Poliweb' },
            { status: 502 }
        );
    }
}

/**
 * POST /api/poliweb-proxy
 * Handles login form submission with CSRF token
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.formData();
        const email = body.get('email') as string;
        const password = body.get('password') as string;
        const csrfToken = body.get('__RequestVerificationToken') as string;
        const rememberMe = body.get('rememberMe') === 'true';

        if (!email || !password || !csrfToken) {
            return NextResponse.json(
                { error: 'Dados de login incompletos' },
                { status: 400 }
            );
        }

        // Step 1: GET the login page to capture initial cookies
        const loginPageUrl = `${POLIWEB_BASE}/PainelEmpresa`;
        const loginPageResponse = await fetch(loginPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            redirect: 'manual',
        });

        // Collect cookies from the login page
        const initialCookies = loginPageResponse.headers.getSetCookie?.() || [];

        // Step 2: POST the login form with the CSRF token
        const formBody = new URLSearchParams();
        formBody.append('Input.Email', email);
        formBody.append('Input.Password', password);
        formBody.append('Input.RememberMe', rememberMe ? 'true' : 'false');
        formBody.append('__RequestVerificationToken', csrfToken);

        const loginResponse = await fetch(loginPageUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cookie': initialCookies.join('; '),
            },
            body: formBody.toString(),
            redirect: 'manual',
        });

        // Get session cookies from login response
        const sessionCookies = loginResponse.headers.getSetCookie?.() || [];

        // Check if login was successful (redirect to dashboard)
        const location = loginResponse.headers.get('location');
        const isLoggedIn = loginResponse.status === 302 && location && !location.includes('Login');

        // Combine all cookies
        const allCookies = [...initialCookies, ...sessionCookies];

        const result: any = {
            success: isLoggedIn,
            cookies: allCookies,
        };

        if (isLoggedIn) {
            result.redirectUrl = `${POLIWEB_BASE}${location}`;
        } else {
            // Try to detect error from response body
            const bodyText = await loginResponse.text();
            if (bodyText.includes('Senha incorreta') || bodyText.includes('Email inválido') || bodyText.includes('Invalid')) {
                result.error = 'Credenciais inválidas';
            } else if (bodyText.includes('csrf') || bodyText.includes('token')) {
                result.error = 'Token CSRF expirado. Tente novamente.';
            } else {
                result.error = 'Falha no login. Verifique suas credenciais.';
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Erro no login Poliweb:', error);
        return NextResponse.json(
            { error: 'Erro ao realizar login' },
            { status: 500 }
        );
    }
}

function rewriteHtml(html: string): string {
    let result = html;

    // Rewrite relative URLs to go through our proxy
    result = result.replace(/(href|src|action)="(\/(?!\/))/g, (match, attr, path) => {
        if (!shouldRewriteProxiedHtmlUrl(path)) {
            return match;
        }
        return `${attr}="/api/poliweb-proxy?path=${path}"`;
    });

    // Rewrite absolute URLs to Poliweb
    result = result.replace(/(href|src|action)="https:\/\/poliweb\.policlinicamacae\.com\.br\//g, (match, attr) => {
        return `${attr}="/api/poliweb-proxy?path=/"`;
    });

    // Rewrite CSS url() references
    result = result.replace(/url\(['"]?(\/(?!\/)[^'")]+)['"]?\)/g, (match, path) => {
        return `url('/api/poliweb-proxy?path=${path}')`;
    });

    return result;
}
