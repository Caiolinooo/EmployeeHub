import path from 'path';

/** Single path segment: letters (incl. accents), marks, digits, space, `.`, `_`, `-`. */
export const SAFE_PATH_NAME_RE = /^[\p{L}\p{M}\p{N}._ -]+$/u;

const INVALID_PATH = 'Caminho inválido';
const INVALID_NAME = 'Nome de arquivo inválido';
const OUTSIDE_BASE = 'Caminho fora do diretório permitido';

export type ResolveInsideOptions = {
  asName?: boolean;
};

export type ResolveInsideResult =
  | { ok: true; resolved: string }
  | { ok: false; error: string };

function decodePathInput(input: string): string {
  let current = input;
  for (let i = 0; i < 5; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) {
        break;
      }
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

function isOutsideBase(resolvedBase: string, resolved: string): boolean {
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    return true;
  }
  const rel = path.relative(resolvedBase, resolved);
  return rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

/**
 * Resolve `input` against a fixed `base` directory.
 * Rejects null bytes, path traversal (`..`), absolute escapes, and (when `asName`)
 * any value that is not a single whitelisted filename.
 */
export function resolveInside(
  base: string,
  input: string,
  options: ResolveInsideOptions = {}
): ResolveInsideResult {
  if (typeof input !== 'string' || input.length === 0) {
    return { ok: false, error: INVALID_PATH };
  }
  if (input.includes('\0')) {
    return { ok: false, error: INVALID_PATH };
  }

  const decoded = decodePathInput(input);
  if (decoded.includes('\0')) {
    return { ok: false, error: INVALID_PATH };
  }

  const normalized = decoded.replace(/\\/g, '/');

  if (options.asName) {
    if (
      normalized.includes('/') ||
      normalized === '.' ||
      normalized === '..' ||
      !SAFE_PATH_NAME_RE.test(normalized)
    ) {
      return { ok: false, error: INVALID_NAME };
    }
  }

  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, normalized);

  if (isOutsideBase(resolvedBase, resolved)) {
    return { ok: false, error: OUTSIDE_BASE };
  }

  return { ok: true, resolved };
}
