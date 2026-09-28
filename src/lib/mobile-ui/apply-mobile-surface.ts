import { NextRequest, NextResponse, userAgent } from 'next/server';
import {
  UI_COOKIE,
  decideMobileSurface,
  isMobilePrefix,
  parseUiCookie,
  shouldRedirectMobilePrefix,
  stripMobilePrefix,
} from './device-surface';

const UI_VARY = 'User-Agent, Sec-CH-UA-Mobile, Cookie';
const UI_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/**
 * Aplica rewrite mobile só quando a decisão pede.
 * Redirects e o `next()` desktop saem intactos (sem headers extras).
 * Usado pelo `middleware.ts` da raiz (Next 15.5 procura ao lado de `pages/`).
 *
 * `?ui=desktop|mobile` vence o rewrite (como o cookie) e grava o cookie.
 * Redirect de `/m/*` usa `nextUrl.clone()` e troca só o pathname.
 * Concatenar o path stripped numa URL absoluta gerava 308 no runtime do Next.
 */
export function applyMobileSurface(request: NextRequest, response: NextResponse): NextResponse {
  if (isRedirect(response)) return persistUiQueryCookie(request, response);

  const { pathname } = request.nextUrl;
  const ua = userAgent(request);
  const uiQuery = parseUiCookie(request.nextUrl.searchParams.get('ui'));
  const uiCookie = uiQuery ?? request.cookies.get(UI_COOKIE)?.value;

  if (isMobilePrefix(pathname)) {
    if (
      shouldRedirectMobilePrefix({
        pathname,
        uiCookie,
        uiQuery,
        uaDeviceType: ua.device.type,
        isBot: ua.isBot,
      })
    ) {
      const dest = request.nextUrl.clone();
      dest.pathname = stripMobilePrefix(pathname);
      return persistUiQueryCookie(request, NextResponse.redirect(dest));
    }
    return persistUiQueryCookie(request, response);
  }

  const decision = decideMobileSurface({
    pathname,
    uiCookie,
    uiQuery,
    secChUaMobile: request.headers.get('sec-ch-ua-mobile'),
    uaDeviceType: ua.device.type,
    isBot: ua.isBot,
  });

  if (!decision.rewritePath) return persistUiQueryCookie(request, response);

  const dest = request.nextUrl.clone();
  dest.pathname = decision.rewritePath;
  const rewrite = NextResponse.rewrite(dest);
  copyPreservedState(response, rewrite);
  rewrite.headers.set('Vary', UI_VARY);
  rewrite.headers.set('Accept-CH', 'Sec-CH-UA-Mobile');
  rewrite.headers.set('Critical-CH', 'Sec-CH-UA-Mobile');
  rewrite.headers.set('x-abz-ui', 'mobile');
  return persistUiQueryCookie(request, rewrite);
}

function persistUiQueryCookie(request: NextRequest, response: NextResponse): NextResponse {
  const uiQuery = parseUiCookie(request.nextUrl.searchParams.get('ui'));
  if (uiQuery === 'desktop' || uiQuery === 'mobile') {
    response.cookies.set(UI_COOKIE, uiQuery, {
      path: '/',
      sameSite: 'lax',
      maxAge: UI_COOKIE_MAX_AGE,
    });
  }
  return response;
}

function copyPreservedState(from: NextResponse, to: NextResponse) {
  const locale = from.headers.get('x-locale');
  if (locale) to.headers.set('x-locale', locale);
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

function isRedirect(response: NextResponse): boolean {
  return response.status >= 300 && response.status < 400 && response.headers.has('location');
}
