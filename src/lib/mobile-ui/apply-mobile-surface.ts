import { NextRequest, NextResponse, userAgent } from 'next/server';
import {
  UI_COOKIE,
  decideMobileSurface,
  isMobilePrefix,
  shouldRedirectMobilePrefix,
  stripMobilePrefix,
} from './device-surface';

const UI_VARY = 'User-Agent, Sec-CH-UA-Mobile, Cookie';

/**
 * Aplica rewrite mobile só quando a decisão pede.
 * Redirects e o `next()` desktop saem intactos (sem headers extras).
 * Usado pelo `middleware.ts` da raiz (Next 15.5 procura ao lado de `pages/`).
 */
export function applyMobileSurface(request: NextRequest, response: NextResponse): NextResponse {
  if (isRedirect(response)) return response;

  const { pathname, search } = request.nextUrl;
  const ua = userAgent(request);
  const uiCookie = request.cookies.get(UI_COOKIE)?.value;

  if (isMobilePrefix(pathname)) {
    if (
      shouldRedirectMobilePrefix({
        pathname,
        uiCookie,
        uaDeviceType: ua.device.type,
        isBot: ua.isBot,
      })
    ) {
      const dest = new URL(stripMobilePrefix(pathname) + search, request.url);
      return NextResponse.redirect(dest);
    }
    return response;
  }

  const decision = decideMobileSurface({
    pathname,
    uiCookie,
    secChUaMobile: request.headers.get('sec-ch-ua-mobile'),
    uaDeviceType: ua.device.type,
    isBot: ua.isBot,
  });

  if (!decision.rewritePath) return response;

  const dest = new URL(decision.rewritePath + search, request.url);
  const rewrite = NextResponse.rewrite(dest);
  copyPreservedState(response, rewrite);
  rewrite.headers.set('Vary', UI_VARY);
  rewrite.headers.set('Accept-CH', 'Sec-CH-UA-Mobile');
  rewrite.headers.set('Critical-CH', 'Sec-CH-UA-Mobile');
  rewrite.headers.set('x-abz-ui', 'mobile');
  return rewrite;
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
