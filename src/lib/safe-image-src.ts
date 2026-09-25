const DEFAULT_FALLBACK = '/images/LC1_Azul.png';

function isRelativeImagePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

/**
 * Allow img src that cannot be interpreted as script.
 * https, same-origin relative, blob (local File preview), data:image/*.
 * Block javascript:, vbscript:, data:text/html, protocol-relative //.
 */
export function isSafeImageSrc(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string') return false;
  const value = raw.trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false;
  if (isRelativeImagePath(value)) return true;
  if (/^data:image\/[a-z0-9.+-]+[;,]/i.test(value)) return true;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol === 'blob:') return true;
    return false;
  } catch {
    return false;
  }
}

export function safeImageSrc(
  raw: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK
): string {
  const fallbackSafe = isSafeImageSrc(fallback) ? fallback.trim() : DEFAULT_FALLBACK;
  return isSafeImageSrc(raw) ? String(raw).trim() : fallbackSafe;
}
