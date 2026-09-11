/**
 * Pure portal-identity helpers. Safe for tests and client UI.
 * `users_unified` identity is `tax_id` + `email` — never `cpf` / `full_name`.
 */

import { normalizeCpf } from '@/lib/gestao-tripulantes/cpf';

export const PORTAL_USER_SELECT =
  'id, first_name, last_name, email, phone_number, role, department, active, tax_id, created_at';

export type PortalUserMatchReason = 'user_id' | 'tax_id' | 'email' | 'name_cpf';

export interface PortalUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number?: string | null;
  role: string | null;
  department?: string | null;
  active?: boolean | null;
  tax_id?: string | null;
  created_at?: string | null;
}

export interface PortalUserLookup {
  colaboradorId: string;
  userId?: string | null;
  cpf: string;
  email: string;
  nome?: string | null;
}

export interface PortalUserResolution {
  user: PortalUser | null;
  reason: PortalUserMatchReason | null;
  moduleUserIds: string[];
}

export function normalizeEmail(raw: string | null | undefined): string {
  return String(raw || '').trim().toLowerCase();
}

export function emailsMatchExact(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  return Boolean(a && b && a === b && a.includes('@'));
}

export function taxIdDigitsMatch(
  taxId: string | null | undefined,
  cpfDigits: string,
): boolean {
  if (cpfDigits.length !== 11) return false;
  return normalizeCpf(taxId || '') === cpfDigits;
}

export function normalizePersonName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function portalDisplayName(
  user: Pick<PortalUser, 'first_name' | 'last_name' | 'email'>,
): string {
  const assembled = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return assembled || user.email || '';
}

/**
 * Same-person name check: exact normalized match, or first name equal and
 * every token of the shorter name (at least first+last) appears in the longer.
 * "Aislan Rocha" corroborates "AISLAN ROCHA DE ARAUJO LEITE"; a lone first name does not.
 */
export function namesCorroborate(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizePersonName(left);
  const b = normalizePersonName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const tokensA = a.split(' ');
  const tokensB = b.split(' ');
  if (tokensA[0] !== tokensB[0]) return false;
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  if (shorter.length < 2) return false;
  return shorter.every((token) => longer.includes(token));
}

export type ExtraIdentityFactor = 'tax_id' | 'email';

export interface IdentityCorroborationContext {
  foundBy: ExtraIdentityFactor;
  confirmed?: PortalUser | null;
  colaboradorNome?: string | null;
  colaboradorCpf: string;
  colaboradorEmail: string;
}

/**
 * A unique tax_id/email hit on a *different* portal user is only "same person"
 * when a second factor exists. The lookup key that found `candidate` does not count.
 */
export function hasSecondIdentityFactor(
  candidate: PortalUser,
  ctx: IdentityCorroborationContext,
): boolean {
  const cpf = normalizeCpf(ctx.colaboradorCpf || '');
  const email = normalizeEmail(ctx.colaboradorEmail);
  const candidateName = portalDisplayName(candidate);
  const confirmed = ctx.confirmed ?? null;

  if (namesCorroborate(ctx.colaboradorNome, candidateName)) return true;
  if (confirmed && namesCorroborate(portalDisplayName(confirmed), candidateName)) return true;

  switch (ctx.foundBy) {
    case 'tax_id':
      if (emailsMatchExact(candidate.email, email)) return true;
      break;
    case 'email':
      if (taxIdDigitsMatch(candidate.tax_id, cpf)) return true;
      break;
    default: {
      const _never: never = ctx.foundBy;
      return _never;
    }
  }

  if (confirmed) {
    if (emailsMatchExact(confirmed.email, candidate.email)) return true;
    const confirmedCpf = normalizeCpf(confirmed.tax_id || '');
    if (confirmedCpf.length === 11 && taxIdDigitsMatch(candidate.tax_id, confirmedCpf)) {
      return true;
    }
  }

  return false;
}

/**
 * Primary match (no confirmed `user_id`) needs a second factor before we
 * expose module data or backfill `gt_colaboradores.user_id`.
 * `user_id` and `name_cpf` are already multi-factor.
 */
export function shouldAcceptPrimaryMatch(
  candidate: PortalUser,
  reason: PortalUserMatchReason,
  lookup: Pick<PortalUserLookup, 'nome' | 'cpf' | 'email'>,
): boolean {
  const cpf = normalizeCpf(lookup.cpf || '');
  const email = normalizeEmail(lookup.email);
  switch (reason) {
    case 'user_id':
    case 'name_cpf':
      return true;
    case 'tax_id':
      return (
        namesCorroborate(lookup.nome, portalDisplayName(candidate)) ||
        emailsMatchExact(candidate.email, email)
      );
    case 'email':
      return (
        namesCorroborate(lookup.nome, portalDisplayName(candidate)) ||
        taxIdDigitsMatch(candidate.tax_id, cpf)
      );
    default: {
      const _never: never = reason;
      return _never;
    }
  }
}

export function resolveModuleUserIds(input: {
  primary: PortalUser;
  primaryReason: PortalUserMatchReason;
  byTax?: PortalUser | null;
  byEmail?: PortalUser | null;
  colaboradorNome?: string | null;
  colaboradorCpf: string;
  colaboradorEmail: string;
}): string[] {
  const extras: Array<{ user: PortalUser | null; foundBy: ExtraIdentityFactor }> = [];
  if (input.primaryReason !== 'tax_id') {
    extras.push({ user: input.byTax ?? null, foundBy: 'tax_id' });
  }
  if (input.primaryReason !== 'email') {
    extras.push({ user: input.byEmail ?? null, foundBy: 'email' });
  }

  const ids = [input.primary.id];
  for (const extra of extras) {
    if (!extra.user || extra.user.id === input.primary.id) continue;
    if (
      hasSecondIdentityFactor(extra.user, {
        foundBy: extra.foundBy,
        confirmed: input.primary,
        colaboradorNome: input.colaboradorNome,
        colaboradorCpf: input.colaboradorCpf,
        colaboradorEmail: input.colaboradorEmail,
      })
    ) {
      ids.push(extra.user.id);
    }
  }
  return uniqueUserIds(...ids);
}

export function shouldBackfillUserId(
  currentUserId: string | null | undefined,
  matchedUserId: string | null | undefined,
): boolean {
  if (!matchedUserId) return false;
  return !currentUserId;
}

export function pickUniqueTaxIdMatch(rows: PortalUser[], cpfDigits: string): PortalUser | null {
  const hits = rows.filter((row) => taxIdDigitsMatch(row.tax_id, cpfDigits));
  return hits.length === 1 ? hits[0] : null;
}

export function pickUniqueEmailMatch(rows: PortalUser[], email: string): PortalUser | null {
  const hits = rows.filter((row) => emailsMatchExact(row.email, email));
  return hits.length === 1 ? hits[0] : null;
}

export function pickUniqueNameCpfMatch(
  rows: PortalUser[],
  nome: string,
  cpfDigits: string,
): PortalUser | null {
  const want = normalizePersonName(nome);
  if (!want || cpfDigits.length !== 11) return null;
  const hits = rows.filter((row) => {
    if (!taxIdDigitsMatch(row.tax_id, cpfDigits)) return false;
    return normalizePersonName(portalDisplayName(row)) === want;
  });
  return hits.length === 1 ? hits[0] : null;
}

export function uniqueUserIds(...ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}
