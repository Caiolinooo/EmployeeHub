import { isBlockedHtmlUrlScheme } from '../security/safe-url';

export type SafeChatLink =
  | {
      kind: 'https' | 'http';
      host: string;
      path: string;
      search: string;
      hash: string;
    }
  | { kind: 'mailto'; address: string; query: string }
  | { kind: 'relative'; path: string };

function hasControls(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 32 || c === 127) return true;
  }
  return false;
}

function isSafeHost(host: string): boolean {
  if (!host || hasControls(host) || host.includes(' ') || host.includes('\\')) return false;
  return true;
}

/**
 * Parse markdown href into allowlisted parts. Never keep the raw string.
 */
export function parseSafeChatLink(href: string): SafeChatLink | null {
  const t = href.trim();
  if (!t || hasControls(t)) return null;
  if (isBlockedHtmlUrlScheme(t)) return null;
  if (t.startsWith('/') && !t.startsWith('//')) {
    if (t.includes('\\')) return null;
    return { kind: 'relative', path: t };
  }

  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.username !== '' || u.password !== '') return null;

  if (u.protocol === 'mailto:') {
    const address = u.pathname;
    if (!address || address.includes('/') || address.includes('\\')) return null;
    if (!/^[^@\s]+@[^@\s]+$/.test(address)) return null;
    return { kind: 'mailto', address, query: u.search };
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!isSafeHost(u.host)) return null;
  return {
    kind: u.protocol === 'https:' ? 'https' : 'http',
    host: u.host,
    path: u.pathname || '/',
    search: u.search,
    hash: u.hash,
  };
}

/**
 * Rebuild href from validated parts + protocol literals + encodeURI.
 * CodeQL must not see the original user string in the attribute.
 */
export function hrefFromSafeLink(link: SafeChatLink): string {
  switch (link.kind) {
    case 'https':
      return `https://${encodeURI(link.host)}${encodeURI(link.path)}${encodeURI(link.search)}${encodeURI(link.hash)}`;
    case 'http':
      return `http://${encodeURI(link.host)}${encodeURI(link.path)}${encodeURI(link.search)}${encodeURI(link.hash)}`;
    case 'mailto':
      return `mailto:${encodeURI(link.address)}${encodeURI(link.query)}`;
    case 'relative':
      return encodeURI(link.path);
    default: {
      const exhaustive: never = link;
      return exhaustive;
    }
  }
}

export function sanitizeChatHref(href: string): string | null {
  const link = parseSafeChatLink(href);
  return link ? hrefFromSafeLink(link) : null;
}
