/**
 * Front mobile separado: detecção + allowlist.
 * Sem I/O. Usado pelo middleware e pelos testes.
 */

export {
  isPhoneUserAgent,
  isTabletUserAgent,
} from './ua-patterns';

export const UI_COOKIE = 'ui';
export const MOBILE_PATH_PREFIX = '/m';

/** Rotas cuja URL pública já tem página em `app/(mobile)/m/...`. */
export const MOBILE_IMPLEMENTED_PATHS = ['/login'] as const;

/** `/m/*` que o UA desktop pode abrir direto. `/m/preview` é vitrine e 404 em produção. */
export const MOBILE_DIRECT_PATHS = ['/m/preview'] as const;

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type UiCookie = 'desktop' | 'mobile' | undefined;

export type SurfaceDecision = {
  rewritePath: string | null;
  reason:
    | 'already-mobile-prefix'
    | 'not-implemented'
    | 'cookie-desktop'
    | 'cookie-mobile'
    | 'bot-desktop'
    | 'tablet-default-desktop'
    | 'ua-mobile'
    | 'ch-mobile'
    | 'desktop';
};

export function parseUiCookie(value: string | undefined | null): UiCookie {
  if (value === 'desktop' || value === 'mobile') return value;
  return undefined;
}

/** `Sec-CH-UA-Mobile` is `?1` / `?0` (Chromium). */
export function parseSecChUaMobile(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const v = value.trim();
  if (v === '?1' || v === '1') return true;
  if (v === '?0' || v === '0') return false;
  return null;
}

export function classifyDevice(input: {
  secChUaMobile?: string | null;
  uaDeviceType?: string | undefined;
}): DeviceClass {
  const type = input.uaDeviceType;
  if (type === 'tablet') return 'tablet';
  const ch = parseSecChUaMobile(input.secChUaMobile ?? null);
  if (ch === true) return 'mobile';
  if (ch === false) return 'desktop';
  if (type === 'mobile') return 'mobile';
  return 'desktop';
}

export function isMobileImplemented(pathname: string): boolean {
  const path = stripQuery(pathname);
  return MOBILE_IMPLEMENTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function toMobileRewritePath(pathname: string): string {
  const path = stripQuery(pathname);
  if (path === '/') return `${MOBILE_PATH_PREFIX}/login`;
  if (path.startsWith(`${MOBILE_PATH_PREFIX}/`) || path === MOBILE_PATH_PREFIX) return path;
  return `${MOBILE_PATH_PREFIX}${path}`;
}

export function stripMobilePrefix(pathname: string): string {
  const path = stripQuery(pathname);
  if (path === MOBILE_PATH_PREFIX) return '/';
  if (path.startsWith(`${MOBILE_PATH_PREFIX}/`)) {
    const rest = path.slice(MOBILE_PATH_PREFIX.length);
    return rest || '/';
  }
  return path;
}

export function isMobilePrefix(pathname: string): boolean {
  const path = stripQuery(pathname);
  return path === MOBILE_PATH_PREFIX || path.startsWith(`${MOBILE_PATH_PREFIX}/`);
}

export function isMobileDirectPath(pathname: string): boolean {
  const path = stripQuery(pathname);
  return MOBILE_DIRECT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** `/m/*` com UA desktop volta à URL pública, salvo cookie `ui=mobile` ou rota direta. */
export function shouldRedirectMobilePrefix(input: {
  pathname: string;
  uiCookie?: string | null;
  uaDeviceType?: string | undefined;
  isBot?: boolean;
}): boolean {
  if (!isMobilePrefix(input.pathname)) return false;
  if (isMobileDirectPath(input.pathname)) return false;
  const ui = parseUiCookie(input.uiCookie);
  if (ui === 'mobile') return false;
  if (ui === 'desktop') return true;
  if (input.isBot) return true;
  return input.uaDeviceType !== 'mobile';
}

export function decideMobileSurface(input: {
  pathname: string;
  uiCookie?: string | null;
  secChUaMobile?: string | null;
  uaDeviceType?: string | undefined;
  isBot?: boolean;
}): SurfaceDecision {
  const path = stripQuery(input.pathname);
  if (path === MOBILE_PATH_PREFIX || path.startsWith(`${MOBILE_PATH_PREFIX}/`)) {
    return { rewritePath: null, reason: 'already-mobile-prefix' };
  }
  if (!isMobileImplemented(path)) {
    return { rewritePath: null, reason: 'not-implemented' };
  }

  const ui = parseUiCookie(input.uiCookie);
  if (ui === 'desktop') return { rewritePath: null, reason: 'cookie-desktop' };

  if (ui === 'mobile') {
    return { rewritePath: toMobileRewritePath(path), reason: 'cookie-mobile' };
  }

  if (input.isBot) return { rewritePath: null, reason: 'bot-desktop' };

  const device = classifyDevice({
    secChUaMobile: input.secChUaMobile,
    uaDeviceType: input.uaDeviceType,
  });

  if (device === 'tablet') return { rewritePath: null, reason: 'tablet-default-desktop' };
  if (device === 'mobile') {
    const viaCh = parseSecChUaMobile(input.secChUaMobile ?? null) === true;
    return {
      rewritePath: toMobileRewritePath(path),
      reason: viaCh ? 'ch-mobile' : 'ua-mobile',
    };
  }
  return { rewritePath: null, reason: 'desktop' };
}

function stripQuery(pathname: string): string {
  const q = pathname.indexOf('?');
  return q === -1 ? pathname : pathname.slice(0, q);
}
