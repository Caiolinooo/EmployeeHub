/**
 * Normalize and guard outbound LLM endpoint URLs (SSRF).
 * Host checks use parsed hostname (exact / leading-dot suffix), never raw includes().
 */
import { joinSafeUrl, parseSafeUrl, UnsafeUrlError } from '../security/safe-url';

export { UnsafeUrlError };

const GEMINI_OPENAI_HOST = 'generativelanguage.googleapis.com';
const LLM_PROTOCOLS = ['https:', 'http:'] as const;

export function hostnameEqualsOrSuffix(hostname: string, allowed: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '');
  const needle = allowed.toLowerCase().replace(/\.+$/, '');
  if (!host || !needle) return false;
  return host === needle || host.endsWith(`.${needle}`);
}

/**
 * Normalize an LLM base URL (e.g. append /v1beta/openai for Gemini).
 */
export function normalizeEndpoint(rawEndpoint: string): string {
  const ep = (rawEndpoint || '').trim().replace(/\/+$/, '');
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

  const path = parsed.pathname.replace(/\/+$/, '');
  if (path.includes('/openai')) {
    return ep;
  }
  if (path.endsWith('/v1beta')) {
    parsed.pathname = `${path}/openai`;
  } else if (!path.includes('/v1beta')) {
    parsed.pathname = `${path}/v1beta/openai`;
  }
  return parsed.href.replace(/\/+$/, '');
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
