/**
 * Resolve `users_unified` for a GT colaborador.
 * Identity on the portal is `tax_id` + `email` — never `cpf` / `full_name`.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { formatCpf, normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import {
  PORTAL_USER_SELECT,
  normalizeEmail,
  pickUniqueEmailMatch,
  pickUniqueNameCpfMatch,
  pickUniqueTaxIdMatch,
  resolveModuleUserIds,
  shouldAcceptPrimaryMatch,
  shouldBackfillUserId,
  uniqueUserIds,
  normalizePersonName,
  type PortalUser,
  type PortalUserLookup,
  type PortalUserResolution,
} from '@/lib/employee-hub/portal-user-match';

export {
  PORTAL_USER_SELECT,
  portalDisplayName,
  type PortalUser,
  type PortalUserLookup,
  type PortalUserMatchReason,
  type PortalUserResolution,
} from '@/lib/employee-hub/portal-user-match';

function asPortalUser(row: PortalUser | null | undefined): PortalUser | null {
  if (!row?.id) return null;
  return row;
}

async function fetchPortalUserById(userId: string): Promise<PortalUser | null> {
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select(PORTAL_USER_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return asPortalUser(data as PortalUser | null);
}

async function fetchPortalUserByTaxId(cpfDigits: string): Promise<PortalUser | null> {
  if (cpfDigits.length !== 11) return null;
  const masked = formatCpf(cpfDigits);
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select(PORTAL_USER_SELECT)
    .or(`tax_id.eq.${cpfDigits},tax_id.eq.${masked}`)
    .limit(5);
  if (error || !data?.length) return null;
  return pickUniqueTaxIdMatch(data as PortalUser[], cpfDigits);
}

async function fetchPortalUserByEmail(email: string): Promise<PortalUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) return null;
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select(PORTAL_USER_SELECT)
    .ilike('email', normalized)
    .limit(5);
  if (error || !data?.length) return null;
  return pickUniqueEmailMatch(data as PortalUser[], normalized);
}

async function fetchPortalUserByNameAndCpf(
  nome: string,
  cpfDigits: string,
): Promise<PortalUser | null> {
  const normalized = normalizePersonName(nome);
  const first = normalized.split(' ')[0] || '';
  if (first.length < 3 || cpfDigits.length !== 11) return null;
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select(PORTAL_USER_SELECT)
    .ilike('first_name', first)
    .limit(25);
  if (error || !data?.length) return null;
  return pickUniqueNameCpfMatch(data as PortalUser[], nome, cpfDigits);
}

async function maybeBackfillColaboradorUserId(
  colaboradorId: string,
  currentUserId: string | null | undefined,
  matchedUserId: string,
): Promise<void> {
  if (!shouldBackfillUserId(currentUserId, matchedUserId)) return;
  try {
    await supabaseAdmin
      .from('gt_colaboradores')
      .update({ user_id: matchedUserId, updated_at: new Date().toISOString() })
      .eq('id', colaboradorId)
      .is('user_id', null);
  } catch {
    // fail-safe: ficha still returns the resolved user
  }
}

function skipUncorroborated(kind: string, userId: string): void {
  console.warn(`[employee-hub] skip uncorroborated ${kind} portal match`, userId);
}

export async function resolvePortalUser(lookup: PortalUserLookup): Promise<PortalUserResolution> {
  const cpf = normalizeCpf(lookup.cpf || '');
  const email = normalizeEmail(lookup.email);
  const nome = lookup.nome || '';
  const identityCtx = {
    colaboradorNome: nome,
    colaboradorCpf: cpf,
    colaboradorEmail: email,
  };

  try {
    if (lookup.userId) {
      const byId = await fetchPortalUserById(lookup.userId);
      if (byId) {
        const [byTax, byEmail] = await Promise.all([
          fetchPortalUserByTaxId(cpf),
          fetchPortalUserByEmail(email),
        ]);
        return {
          user: byId,
          reason: 'user_id',
          moduleUserIds: resolveModuleUserIds({
            primary: byId,
            primaryReason: 'user_id',
            byTax,
            byEmail,
            ...identityCtx,
          }),
        };
      }
    }

    const [byTax, byEmail] = await Promise.all([
      fetchPortalUserByTaxId(cpf),
      fetchPortalUserByEmail(email),
    ]);

    if (byTax) {
      if (shouldAcceptPrimaryMatch(byTax, 'tax_id', { nome, cpf, email })) {
        await maybeBackfillColaboradorUserId(lookup.colaboradorId, lookup.userId, byTax.id);
        return {
          user: byTax,
          reason: 'tax_id',
          moduleUserIds: resolveModuleUserIds({
            primary: byTax,
            primaryReason: 'tax_id',
            byTax,
            byEmail,
            ...identityCtx,
          }),
        };
      }
      skipUncorroborated('tax_id', byTax.id);
    }

    if (byEmail) {
      if (shouldAcceptPrimaryMatch(byEmail, 'email', { nome, cpf, email })) {
        await maybeBackfillColaboradorUserId(lookup.colaboradorId, lookup.userId, byEmail.id);
        return {
          user: byEmail,
          reason: 'email',
          moduleUserIds: uniqueUserIds(byEmail.id),
        };
      }
      skipUncorroborated('email', byEmail.id);
    }

    const byName = await fetchPortalUserByNameAndCpf(nome, cpf);
    if (byName) {
      await maybeBackfillColaboradorUserId(lookup.colaboradorId, lookup.userId, byName.id);
      return {
        user: byName,
        reason: 'name_cpf',
        moduleUserIds: uniqueUserIds(byName.id),
      };
    }
  } catch {
    return { user: null, reason: null, moduleUserIds: [] };
  }

  return { user: null, reason: null, moduleUserIds: [] };
}
