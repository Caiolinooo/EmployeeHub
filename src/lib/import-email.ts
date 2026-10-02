/**
 * Same language as `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` for realistic emails.
 * Bounded parts keep the match linear (CodeQL js/polynomial-redos).
 * RFC-ish caps: local 64, domain-label run 253, TLD-ish tail 63.
 */
const IMPORT_EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{1,63}$/;

export function isValidImportEmail(email: string): boolean {
  return IMPORT_EMAIL_RE.test(email);
}
