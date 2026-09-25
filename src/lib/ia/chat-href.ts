import { isBlockedHtmlUrlScheme } from '../security/safe-url';

/**
 * Canonical href for markdown links, or null if unsafe.
 * Allowlist: http(s), mailto, same-origin relative `/`. Never raw user text.
 */
export function sanitizeChatHref(href: string): string | null {
  const t = href.trim();
  if (!t || /[\u0000-\u001F\u007F]/.test(t)) return null;
  if (isBlockedHtmlUrlScheme(t)) return null;
  if (t.startsWith('/') && !t.startsWith('//')) return t;
  try {
    const u = new URL(t);
    if (u.protocol === 'mailto:') return u.href;
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username !== '' || u.password !== '') return null;
    return u.href;
  } catch {
    return null;
  }
}
