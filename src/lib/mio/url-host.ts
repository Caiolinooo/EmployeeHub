/**
 * Hostname / email-domain checks that CodeQL accepts.
 * Never use `url.includes('example.com')` — `evil.com.attacker.net` and
 * `https://evil.com.attacker.net` bypass substring checks.
 */
export function hostnameMatches(hostname: string, domain: string): boolean {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host || !d) return false;
  return host === d || host.endsWith(`.${d}`);
}

export function urlHostnameMatches(rawUrl: string, domain: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return hostnameMatches(parsed.hostname, domain);
  } catch {
    return false;
  }
}

export function emailDomainMatches(email: string, domain: string): boolean {
  const trimmed = String(email || '').trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 0) return false;
  const host = trimmed.slice(at + 1);
  if (!host || /[/?#\s]/.test(host)) return false;
  return hostnameMatches(host, domain);
}

export function isValidNonPlaceholderEmail(email: string): boolean {
  const trimmed = String(email || '').trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return false;
  const host = trimmed.slice(at + 1);
  if (!host || /[/?#\s]/.test(host)) return false;
  return !hostnameMatches(host, 'placeholder.com');
}
