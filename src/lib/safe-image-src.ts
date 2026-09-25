const DEFAULT_FALLBACK = '/images/LC1_Azul.png';
const RASTER_IMAGE_SUBTYPES = new Set(['png', 'jpeg', 'jpg', 'gif', 'webp', 'avif', 'bmp']);

function isRelativeImagePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

function compactSchemeNoise(value: string): string {
  return value.replace(/[\u0000-\u0020\u007F]+/g, '');
}

function isAllowedRasterDataImage(value: string): boolean {
  const match = /^data:image\/([a-z0-9.+-]+)[;,]/i.exec(value);
  if (!match) return false;
  const subtype = match[1].toLowerCase();
  if (subtype === 'svg+xml' || subtype.startsWith('svg')) return false;
  return RASTER_IMAGE_SUBTYPES.has(subtype);
}

/**
 * Allow img src that cannot be interpreted as script.
 * Allowlist: https, same-origin relative `/`, blob (local File preview),
 * and raster `data:image/*` (never svg+xml).
 * Block javascript:, vbscript:, data:text/html, protocol-relative //, http:.
 */
export function isSafeImageSrc(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string') return false;
  const value = raw.trim();
  if (!value) return false;
  if (isRelativeImagePath(value)) {
    return !/[\u0000-\u001F\u007F]/.test(value);
  }

  const compacted = compactSchemeNoise(value);
  let parsed: URL;
  try {
    parsed = new URL(compacted, 'http://localhost');
  } catch {
    return false;
  }

  switch (parsed.protocol) {
    case 'https:':
      return true;
    case 'blob:':
      return true;
    case 'data:':
      return isAllowedRasterDataImage(compacted);
    default:
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
