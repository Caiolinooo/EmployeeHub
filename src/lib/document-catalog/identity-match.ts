/**
 * Pure identity helpers for the collaborator document catalog.
 * `users_unified` has `tax_id` + `email` + `phone_number` — never `cpf`.
 */

import { formatCpf, normalizeCpf } from '@/lib/utils/identity';
import { namesCorroborate } from '@/lib/employee-hub/portal-user-match';
import { gtColaboradoresTableSelectIsSafe } from '@/lib/gestao-tripulantes/gt-colaboradores-columns';

/** PostgREST select for portal users. Must never include `cpf` / `full_name` / `phone`. */
export const CATALOG_USER_SELECT =
  'id, email, first_name, last_name, name, tax_id, position, department, sector_id, phone_number';

/**
 * Table columns on `gt_colaboradores` only.
 * `cargo_nome` / `empresa_nome` / `embarcacao_nome` are aliases on
 * `gt_vw_colaboradores_completo` — selecting them on the table makes
 * PostgREST error and `fetchColaboradorById` return null → HTTP 404
 * "Colaborador não encontrado" on GET /api/document-catalog?colaboradorId=.
 */
export const CATALOG_COLAB_SELECT =
  'id, nome_completo, cpf, email, telefone, user_id, cargo:gt_cargos(nome)';

export function catalogUserSelectIsSafe(select: string = CATALOG_USER_SELECT): boolean {
  return !/(^|[,\s])cpf([,\s]|$)/i.test(select)
    && !/(^|[,\s])full_name([,\s]|$)/i.test(select)
    && !/(^|[,\s])phone([,\s]|$)/i.test(select);
}

export function catalogColabSelectIsSafe(select: string = CATALOG_COLAB_SELECT): boolean {
  return gtColaboradoresTableSelectIsSafe(select);
}

export type CatalogColabSelectRow = {
  id: string;
  nome_completo?: string | null;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  user_id?: string | null;
  cargo_nome?: string | null;
  cargo?: { nome?: string | null } | { nome?: string | null }[] | null;
};

export function flattenCatalogColabRow(row: CatalogColabSelectRow): {
  id: string;
  nome_completo: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  user_id: string | null;
  cargo_nome: string | null;
} {
  const cargo = Array.isArray(row.cargo) ? row.cargo[0] : row.cargo;
  return {
    id: row.id,
    nome_completo: row.nome_completo ?? null,
    cpf: row.cpf ?? null,
    email: row.email ?? null,
    telefone: row.telefone ?? null,
    user_id: row.user_id ?? null,
    cargo_nome: row.cargo_nome ?? cargo?.nome ?? null,
  };
}

export function digitsOrNull(raw: string | null | undefined): string | null {
  const digits = normalizeCpf(raw || '');
  return digits.length === 11 ? digits : null;
}

export function taxIdOrFilter(digits: string): string {
  const formatted = formatCpf(digits);
  return `tax_id.eq.${digits},tax_id.eq.${formatted}`;
}

export function phoneDigits(raw: string | null | undefined): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export function phonesMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = phoneDigits(left);
  const b = phoneDigits(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.slice(-8) === b.slice(-8);
}

export function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = (value || '').trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function nameLookupTokens(fullName: string | null | undefined): {
  first: string;
  last: string;
} | null {
  const normalized = String(fullName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = normalized.split(' ').filter((token) => token.length >= 3);
  if (tokens.length < 2) return null;
  return { first: tokens[0], last: tokens[tokens.length - 1] };
}

/** Accept a unique GT/portal name hit when first+last corroborate. */
export function pickUniqueNameMatch<T>(
  candidates: T[],
  candidateName: (row: T) => string | null | undefined,
  expectedName: string | null | undefined
): T | null {
  if (!expectedName) return null;
  const matches = candidates.filter((row) => namesCorroborate(candidateName(row), expectedName));
  return matches.length === 1 ? matches[0] : null;
}
