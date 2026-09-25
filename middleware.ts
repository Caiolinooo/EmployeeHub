import { NextRequest, NextResponse } from 'next/server';
import { applyMobileSurface } from './src/lib/mobile-ui/apply-mobile-surface';
import {
  avaliacaoLegacyRedirect,
  isAvaliacaoPagePath,
  isAuthPassthroughPath,
} from './src/lib/middleware-gates';

function markMiddleware(response: NextResponse): NextResponse {
  response.headers.set('x-abz-middleware', '1');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Comentando o redirecionamento que causa loop infinito
  // if (pathname === '/admin') {
  //   console.log('Middleware: Redirecionando /admin para /admin/');
  //   return NextResponse.redirect(new URL('/admin/', request.url));
  // }

  if (isAuthPassthroughPath(pathname)) {
    return markMiddleware(applyMobileSurface(request, NextResponse.next()));
  }

  const token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;

  const legacyTarget = avaliacaoLegacyRedirect(pathname);
  if (legacyTarget) {
    return markMiddleware(NextResponse.redirect(new URL(legacyTarget, request.url)));
  }

  // Só `/avaliacao` e `/avaliacao/...`. `/avaliacoes-avancadas` não entra aqui.
  if (isAvaliacaoPagePath(pathname)) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return markMiddleware(NextResponse.redirect(loginUrl));
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Authorization', `Bearer ${token}`);
    // Do not rewrite abzToken/token cookies: saveToken already sets 30d expiry.
    // Re-setting maxAge=1d here would shrink sessions on every /avaliacao visit.
    return markMiddleware(
      NextResponse.next({
        request: { headers: requestHeaders },
      })
    );
  }

  const response = NextResponse.next();
  const defaultLocale = 'pt-BR';
  const locale = request.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
  response.headers.set('x-locale', locale);
  response.cookies.set('NEXT_LOCALE', locale);
  return markMiddleware(applyMobileSurface(request, response));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes — auth is per-route)
     * - _next/static, _next/image, _next/data
     * - favicon.ico, public, images, fonts, documentos
     */
    '/((?!api|_next/static|_next/image|_next/data|favicon.ico|public|images|fonts|documentos).*)',
  ],
};
