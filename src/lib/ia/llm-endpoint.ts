/**
 * Normalize and guard outbound LLM endpoint URLs (SSRF).
 * Host checks use parsed hostname (exact / leading-dot suffix), never raw includes().
 * Trailing `/` and `.` are stripped with a linear scan — no `/X+$/` on user input.
 */
import { joinSafeUrl, parseSafeUrl, UnsafeUrlError } from '../security/safe-url';

export { UnsafeUrlError };

const GEMINI_OPENAI_HOST = 'generativelanguage.googleapis.com';
const LLM_PROTOCOLS = ['https:', 'http:'] as const;

/** Linear trim of a trailing character. Avoids polynomial `/X+$/` on untrusted input. */
export function trimTrailingChar(value: string, ch: string): string {
  const code = ch.charCodeAt(0);
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === code) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

export function hostnameEqualsOrSuffix(hostname: string, allowed: string): boolean {
  const host = trimTrailingChar(hostname.toLowerCase(), '.');
  const needle = trimTrailingChar(allowed.toLowerCase(), '.');
  if (!host || !needle) return false;
  return host === needle || host.endsWith(`.${needle}`);
}

/**
 * Normalize an LLM base URL (e.g. append /v1beta/openai for Gemini).
 */
export function normalizeEndpoint(rawEndpoint: string): string {
  const ep = trimTrailingChar((rawEndpoint || '').trim(), '/');
  if (!ep) return ep;

  let parsed: URL;
  try {
    parsed = new URL(ep);
  } catch {
    return ep;
  }

  if (!hostnameEqualsOrSuffix(parsed.hostname, GEMINI_OPENAI_HOST)) {
    return ep;
  }

  const path = trimTrailingChar(parsed.pathname, '/');
  if (path.includes('/openai')) {
    return ep;
  }
  if (path.endsWith('/v1beta')) {
    parsed.pathname = `${path}/openai`;
  } else if (!path.includes('/v1beta')) {
    parsed.pathname = `${path}/v1beta/openai`;
  }
  return trimTrailingChar(parsed.href, '/');
}

/**
 * Build a safe absolute URL for an LLM path (`models`, `chat/completions`).
 * Uses the portal SSRF helper: scheme + credentials + private/loopback denylist,
 * then pins the host to the parsed endpoint host.
 */
export function resolveLlmFetchUrl(rawEndpoint: string, suffix: string): URL {
  const endpoint = normalizeEndpoint(rawEndpoint);
  if (!endpoint) {
    throw new UnsafeUrlError('Endpoint da IA não informado.');
  }

  let base: URL;
  try {
    base = new URL(endpoint);
  } catch {
    throw new UnsafeUrlError('Endpoint da IA inválido');
  }

  const allowedHosts = [base.hostname];
  parseSafeUrl(base.href, { allowedHosts, allowedProtocols: LLM_PROTOCOLS });
  return joinSafeUrl(base.href, suffix, { allowedHosts, allowedProtocols: LLM_PROTOCOLS });
}
