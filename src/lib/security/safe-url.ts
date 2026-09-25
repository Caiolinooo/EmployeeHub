/**
 * Outbound URL guard for SSRF-sensitive fetches.
 * Parse with `new URL()`, allow only explicit schemes + hosts, reject
 * credentials and private/loopback/link-local addresses.
 */

export class UnsafeUrlError extends Error {
  readonly code = 'UNSAFE_URL';

  constructor(message = 'URL não permitida') {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export type ParseSafeUrlOptions = {
  allowedProtocols?: readonly string[];
  allowedHosts: readonly string[];
};

const DEFAULT_PROTOCOLS = ['https:'] as const;
const BLOCKED_HTML_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:']);
const PASSTHROUGH_HTML_SCHEMES = new Set(['mailto:', 'tel:', 'sms:']);

export const POLIWEB_HOST = 'poliweb.policlinicamacae.com.br';
export const POLIWEB_BASE = `https://${POLIWEB_HOST}`;
export const CONSULTA_CA_HOST = 'consultaca.com';
export const CONSULTA_CA_BASE = `https://${CONSULTA_CA_HOST}`;
export const MTE_CAEPI_HOST = 'caepi.mte.gov.br';
export const GOOGLE_CALENDAR_HOST = 'calendar.google.com';

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '').replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
  if (host === 'metadata.google.internal') return true;
  if (isIpv4Address(host) && isPrivateIpv4(host)) return true;
  if (isBlockedIpv6(host)) return true;
  return false;
}

export function parseSafeUrl(raw: string, options: ParseSafeUrlOptions): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UnsafeUrlError('URL inválida');
  }

  const allowedProtocols = options.allowedProtocols ?? DEFAULT_PROTOCOLS;
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new UnsafeUrlError('Protocolo não permitido');
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new UnsafeUrlError('Credenciais na URL não são permitidas');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError('Host privado ou loopback não é permitido');
  }

  const allowed = options.allowedHosts.map((host) => host.toLowerCase());
  if (!allowed.includes(hostname)) {
    throw new UnsafeUrlError('Host não permitido');
  }

  return parsed;
}

export function joinSafeUrl(
  base: string,
  path: string,
  options?: ParseSafeUrlOptions,
): URL {
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
  } catch {
    throw new UnsafeUrlError('Base URL inválida');
  }

  const allowedHosts = options?.allowedHosts ?? [baseUrl.hostname];
  const allowedProtocols = options?.allowedProtocols ?? DEFAULT_PROTOCOLS;
  parseSafeUrl(baseUrl.href, { allowedHosts, allowedProtocols });

  if (path.includes('\\') || path.includes('\0')) {
    throw new UnsafeUrlError('Path inválido');
  }

  const trimmedPath = path.trim();
  if (trimmedPath.startsWith('//') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedPath)) {
    throw new UnsafeUrlError('Path absoluto não permitido');
  }

  const prefix = baseUrl.href.endsWith('/') ? baseUrl.href : `${baseUrl.href}/`;
  const relative = trimmedPath.startsWith('/') ? trimmedPath.slice(1) : trimmedPath;
  let joined: URL;
  try {
    joined = new URL(relative, prefix);
  } catch {
    throw new UnsafeUrlError('URL inválida');
  }

  if (joined.origin !== baseUrl.origin) {
    throw new UnsafeUrlError('URL saiu da origem permitida');
  }

  return parseSafeUrl(joined.href, { allowedHosts, allowedProtocols });
}

export function htmlUrlProtocol(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).protocol.toLowerCase();
  } catch {
    try {
      return new URL(trimmed, 'https://invalid.invalid').protocol.toLowerCase();
    } catch {
      return null;
    }
  }
}

export function isBlockedHtmlUrlScheme(raw: string): boolean {
  const protocol = htmlUrlProtocol(raw);
  return protocol !== null && BLOCKED_HTML_SCHEMES.has(protocol);
}

export function shouldRewriteProxiedHtmlUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  const protocol = htmlUrlProtocol(trimmed);
  if (!protocol) return false;
  if (BLOCKED_HTML_SCHEMES.has(protocol)) return false;
  if (PASSTHROUGH_HTML_SCHEMES.has(protocol)) return false;
  return protocol === 'https:' || protocol === 'http:';
}

export function resolvePoliwebUrl(
  pathFromQuery: string | null | undefined,
  search?: string,
): URL {
  const rawPath = pathFromQuery && pathFromQuery.trim() ? pathFromQuery.trim() : '/PainelEmpresa';
  let candidate: URL;
  try {
    candidate = new URL(rawPath, POLIWEB_BASE);
  } catch {
    throw new UnsafeUrlError('Path Poliweb inválido');
  }

  if (search) {
    const extras = new URLSearchParams(search);
    extras.forEach((value, key) => {
      candidate.searchParams.append(key, value);
    });
  }

  const safe = parseSafeUrl(candidate.href, {
    allowedProtocols: ['https:'],
    allowedHosts: [POLIWEB_HOST],
  });
  if (safe.protocol !== 'https:' || safe.hostname !== POLIWEB_HOST) {
    throw new UnsafeUrlError('Host Poliweb não permitido');
  }
  return safe;
}

export function buildConsultaCaLookupUrl(caNumber: string): URL {
  const digits = caNumber.replace(/\D/g, '');
  if (!digits) {
    throw new UnsafeUrlError('Número de CA inválido');
  }
  const safe = joinSafeUrl(CONSULTA_CA_BASE, digits, {
    allowedProtocols: ['https:'],
    allowedHosts: [CONSULTA_CA_HOST],
  });
  if (safe.protocol !== 'https:' || safe.hostname !== CONSULTA_CA_HOST) {
    throw new UnsafeUrlError('Host consultaca.com não permitido');
  }
  return safe;
}

export function buildApiBaseCaepiLookupUrl(base: string, caNumber: string): URL {
  const digits = caNumber.replace(/\D/g, '');
  if (!digits) {
    throw new UnsafeUrlError('Número de CA inválido');
  }
  const trimmedBase = base.trim();
  if (!trimmedBase) {
    throw new UnsafeUrlError('API_BASE_CAEPI_URL não configurada');
  }
  let configured: URL;
  try {
    configured = new URL(trimmedBase);
  } catch {
    throw new UnsafeUrlError('API_BASE_CAEPI_URL inválida');
  }
  const safeBase = parseSafeUrl(configured.href, {
    allowedProtocols: ['https:'],
    allowedHosts: [configured.hostname],
  });
  const safe = joinSafeUrl(safeBase.href, `ca/${digits}`, {
    allowedProtocols: ['https:'],
    allowedHosts: [safeBase.hostname],
  });
  if (safe.protocol !== 'https:' || safe.hostname !== safeBase.hostname) {
    throw new UnsafeUrlError('Host API_BaseCAEPI não permitido');
  }
  return safe;
}

export function companyCalendarAllowedHosts(): string[] {
  const hosts = new Set<string>([GOOGLE_CALENDAR_HOST]);
  const envIcs = process.env.COMPANY_CALENDAR_ICS_URL;
  if (!envIcs) return [...hosts];
  try {
    const parsed = new URL(envIcs);
    if (
      parsed.protocol === 'https:' &&
      parsed.username === '' &&
      parsed.password === '' &&
      !isBlockedHostname(parsed.hostname)
    ) {
      hosts.add(parsed.hostname.toLowerCase());
    }
  } catch {
    // ignore invalid env URL — allowlist stays on the Google constant
  }
  return [...hosts];
}

export function resolveCompanyCalendarIcsUrl(raw: string): URL {
  const safe = parseSafeUrl(raw, {
    allowedProtocols: ['https:'],
    allowedHosts: companyCalendarAllowedHosts(),
  });
  if (safe.protocol !== 'https:') {
    throw new UnsafeUrlError('ICS deve ser https');
  }
  return safe;
}

export function pdfExtractAllowedHosts(): string[] {
  const hosts = new Set<string>();
  for (const raw of [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]) {
    if (!raw) continue;
    try {
      const normalized = raw.includes('://') ? raw : `https://${raw}`;
      const parsed = new URL(normalized);
      if (
        parsed.protocol === 'https:' &&
        parsed.username === '' &&
        parsed.password === '' &&
        !isBlockedHostname(parsed.hostname)
      ) {
        hosts.add(parsed.hostname.toLowerCase());
      }
    } catch {
      // skip invalid env URL
    }
  }
  return [...hosts];
}

export function resolvePdfExtractUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new UnsafeUrlError('URL vazia');
  }

  const allowedHosts = pdfExtractAllowedHosts();
  if (allowedHosts.length === 0) {
    throw new UnsafeUrlError('Nenhum host permitido configurado');
  }

  let candidate = trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    const baseRaw =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseRaw) {
      throw new UnsafeUrlError('Base URL não configurada');
    }
    const base = baseRaw.includes('://') ? baseRaw : `https://${baseRaw}`;
    candidate = new URL(trimmed, base.endsWith('/') ? base : `${base}/`).href;
  }

  const safe = parseSafeUrl(candidate, {
    allowedProtocols: ['https:'],
    allowedHosts,
  });
  if (safe.protocol !== 'https:' || !allowedHosts.includes(safe.hostname.toLowerCase())) {
    throw new UnsafeUrlError('Host do PDF não permitido');
  }
  return safe;
}

function isIpv4Address(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function ipv4ToInt(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number);
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0);
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n <= 0x00ffffff) return true; // 0.0.0.0/8
  if (n >= 0x0a000000 && n <= 0x0affffff) return true; // 10.0.0.0/8
  if (n >= 0x7f000000 && n <= 0x7fffffff) return true; // 127.0.0.0/8
  if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true; // 169.254.0.0/16
  if (n >= 0xac100000 && n <= 0xac1fffff) return true; // 172.16.0.0/12
  if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true; // 192.168.0.0/16
  if (n === 0xffffffff) return true; // broadcast
  return false;
}

function isBlockedIpv6(host: string): boolean {
  if (!host.includes(':')) return false;
  const h = host.toLowerCase();
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fe80:')) return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true;
  if (h.startsWith('::ffff:')) {
    const mapped = h.slice('::ffff:'.length);
    return isIpv4Address(mapped) && isPrivateIpv4(mapped);
  }
  return false;
}
