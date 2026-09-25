/**
 * Pure path gates for root `middleware.ts`.
 * Keep this file free of `next/server` so node:test can import it.
 */

export const PUBLIC_PAGE_PATHS = [
  '/',
  '/login',
  '/set-password',
  '/register',
  '/reset-password',
  '/verify-email',
] as const;

/** Documented public APIs. Matcher already excludes `/api/*`. */
export const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/login-password',
  '/api/auth/register',
  '/api/auth/register-supabase',
  '/api/auth/resend-code',
  '/api/auth/verify-token',
  '/api/auth/token-refresh',
  '/api/auth/fix-token',
  '/api/auth/ensure-admin',
  '/api/lista-presenca/public',
  '/api/lista-presenca/registros',
] as const;

const STATIC_PREFIXES = [
  '/_next/',
  '/images/',
  '/fonts/',
  '/documentos/',
  '/public/',
  '/api/_next/',
] as const;

/**
 * Next matcher from `middleware.ts` `config.matcher`:
 * `/((?!api|_next/static|_next/image|_next/data|favicon.ico|public|images|fonts|documentos).*)`
 * Negative lookahead is a prefix check on the path after the first `/`.
 */
export const MIDDLEWARE_MATCHER_SOURCE =
  '/((?!api|_next/static|_next/image|_next/data|favicon.ico|public|images|fonts|documentos).*)';

const MATCHER_EXCLUDED_PREFIX =
  /^(api|_next\/static|_next\/image|_next\/data|favicon\.ico|public|images|fonts|documentos)/;

export function isExcludedByMiddlewareMatcher(pathname: string): boolean {
  const rest = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  return MATCHER_EXCLUDED_PREFIX.test(rest);
}

export function isPublicPagePath(pathname: string): boolean {
  return (PUBLIC_PAGE_PATHS as readonly string[]).includes(pathname);
}

export function isPublicApiPath(pathname: string): boolean {
  return (PUBLIC_API_PATHS as readonly string[]).includes(pathname);
}

export function isStaticAssetPath(pathname: string): boolean {
  if (pathname === '/favicon.ico' || pathname === '/robots.txt') return true;
  return STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isListaPresencaPublicPath(pathname: string): boolean {
  return pathname === '/lista-presenca/public' || pathname.startsWith('/lista-presenca/public/');
}

/** Paths that must never be redirected to /login by middleware. */
export function isAuthPassthroughPath(pathname: string): boolean {
  return (
    isPublicPagePath(pathname) ||
    isPublicApiPath(pathname) ||
    isStaticAssetPath(pathname) ||
    pathname.startsWith('/api/auth/') ||
    isListaPresencaPublicPath(pathname)
  );
}

/**
 * Evaluation module pages only. `/avaliacoes-avancadas` must NOT match
 * (`startsWith('/avaliacao')` is a false positive).
 */
export function isAvaliacaoPagePath(pathname: string): boolean {
  return pathname === '/avaliacao' || pathname.startsWith('/avaliacao/');
}

export type AvaliacaoLegacyTarget = '/avaliacao' | '/avaliacao/lixeira';

export function avaliacaoLegacyRedirect(pathname: string): AvaliacaoLegacyTarget | null {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  switch (normalized) {
    case '/avaliacao/avaliacoes':
    case '/avaliacao/lista-avaliacoes':
    case '/avaliacao/nova-avaliacao':
      return '/avaliacao';
    case '/avaliacao/avaliacoes/lixeira':
      return '/avaliacao/lixeira';
    default:
      return null;
  }
}

export type MiddlewareBranch =
  | 'matcher-excluded'
  | 'passthrough'
  | 'avaliacao-legacy-redirect'
  | 'avaliacao-login-redirect'
  | 'avaliacao-allow'
  | 'locale-only';

/**
 * Decide the middleware branch without touching cookies or NextResponse.
 * `hasToken` is true when `abzToken` or `token` cookie is present.
 */
export function classifyMiddlewarePath(
  pathname: string,
  hasToken: boolean
): MiddlewareBranch {
  if (isExcludedByMiddlewareMatcher(pathname)) return 'matcher-excluded';
  if (isAuthPassthroughPath(pathname)) return 'passthrough';
  if (avaliacaoLegacyRedirect(pathname)) return 'avaliacao-legacy-redirect';
  if (isAvaliacaoPagePath(pathname)) {
    return hasToken ? 'avaliacao-allow' : 'avaliacao-login-redirect';
  }
  return 'locale-only';
}
