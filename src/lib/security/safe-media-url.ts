/**
 * Allowlist for img/video `src` values.
 * Current news upload/preview flow only creates `blob:` object URLs.
 * `data:image/*` is not used, so every `data:` URL is rejected.
 */

const SCHEME_PREFIX = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

/**
 * True when `value` is a blob: URL, https: URL, or a relative path
 * (no scheme, not protocol-relative).
 */
export function isSafeMediaUrl(value: unknown): value is string {
  return toSafeMediaUrl(value) !== '';
}

/**
 * Returns `value` unchanged when it is safe for img/video `src`.
 * Otherwise returns `''` so the sink never receives javascript:/data:/http:.
 */
export function toSafeMediaUrl(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const url = value.trim();
  if (!url || hasControlChars(url)) {
    return '';
  }

  if (url.startsWith('//')) {
    return '';
  }

  const schemeMatch = SCHEME_PREFIX.exec(url);
  if (!schemeMatch) {
    return url;
  }

  const scheme = schemeMatch[1].toLowerCase();
  if (scheme === 'blob' || scheme === 'https') {
    return url;
  }

  return '';
}
