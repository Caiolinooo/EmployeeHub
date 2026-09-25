import { supabaseAdmin } from '@/lib/supabase';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { namesCorroborate, portalDisplayName } from '@/lib/employee-hub/portal-user-match';
import { normalizePersonName } from './names';
import type { CollaboratorIdentity } from './types';
import {
  CATALOG_COLAB_SELECT,
  CATALOG_USER_SELECT,
  cargoNomeFromEmbed,
  digitsOrNull,
  firstNonEmpty,
  nameLookupTokens,
  phonesMatch,
  pickUniqueNameMatch,
  taxIdOrFilter,
} from './identity-match';

export { CATALOG_USER_SELECT, catalogUserSelectIsSafe } from './identity-match';
export { normalizePersonName } from './names';

interface UserRow {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  tax_id?: string | null;
  phone_number?: string | null;
  position?: string | null;
  department?: string | null;
  sector_id?: string | null;
}

interface ColabRow {
  id: string;
  nome_completo?: string | null;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  user_id?: string | null;
  cargo_nome?: string | null;
  cargo?: { nome?: string | null } | Array<{ nome?: string | null }> | null;
}

function normalizeColabRow(row: ColabRow | null | undefined): ColabRow | null {
  if (!row) return null;
  return {
    ...row,
    cargo_nome: cargoNomeFromEmbed(row.cargo) || row.cargo_nome || null,
  };
}

function userDisplayName(user: UserRow): string | null {
  return firstNonEmpty(
    `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    user.name,
    portalDisplayName({
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      email: user.email || null,
    })
  );
}

function identityFromUser(user: UserRow, colab?: ColabRow | null): CollaboratorIdentity {
  const fullName = firstNonEmpty(userDisplayName(user), colab?.nome_completo);
  const email = firstNonEmpty(user.email, colab?.email);
  return {
    userId: user.id,
    colaboradorId: colab?.id || null,
    cpfDigits: digitsOrNull(user.tax_id) || digitsOrNull(colab?.cpf),
    email,
    emailLower: email ? email.toLowerCase() : null,
    fullName,
    fullNameNormalized: normalizePersonName(fullName),
    position: firstNonEmpty(user.position, colab?.cargo_nome),
    department: user.department || null,
    sectorId: user.sector_id || null,
  };
}

function identityFromColab(colab: ColabRow, user?: UserRow | null): CollaboratorIdentity {
  if (user) return identityFromUser(user, colab);
  const email = firstNonEmpty(colab.email);
  return {
    userId: null,
    colaboradorId: colab.id,
    cpfDigits: digitsOrNull(colab.cpf),
    email,
    emailLower: email ? email.toLowerCase() : null,
    fullName: colab.nome_completo || null,
    fullNameNormalized: normalizePersonName(colab.nome_completo),
    position: colab.cargo_nome || null,
    department: null,
    sectorId: null,
  };
}

async function findColaboradorByUserId(userId: string): Promise<ColabRow | null> {
  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select(CATALOG_COLAB_SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(2);
  if (error) {
    console.error('[document-catalog] findColaboradorByUserId:', error.message);
    return null;
  }
  return normalizeColabRow(data?.[0]);
}

async function findColaboradorByPhone(phone: string | null | undefined): Promise<ColabRow | null> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  const tail = digits.slice(-8);
  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select(CATALOG_COLAB_SELECT)
    .is('deleted_at', null)
    .ilike('telefone', `%${tail}%`)
    .limit(10);
  if (error) {
    console.error('[document-catalog] findColaboradorByPhone:', error.message);
    return null;
  }
  const matches = (data || []).filter((row) => phonesMatch(row.telefone, phone));
  return matches.length === 1 ? normalizeColabRow(matches[0]) : null;
}

async function findColaboradorByUniqueName(fullName: string | null | undefined): Promise<ColabRow | null> {
  const tokens = nameLookupTokens(fullName);
  if (!tokens) return null;
  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select(CATALOG_COLAB_SELECT)
    .is('deleted_at', null)
    .ilike('nome_completo', `%${tokens.first}%`)
    .ilike('nome_completo', `%${tokens.last}%`)
    .limit(20);
  if (error) {
    console.error('[document-catalog] findColaboradorByUniqueName:', error.message);
    return null;
  }
  return normalizeColabRow(pickUniqueNameMatch(data || [], (row) => row.nome_completo, fullName));
}

async function findColaboradorByCpfOrEmailOrPhone(
  cpfDigits: string | null,
  emailLower: string | null,
  phone: string | null | undefined,
  fullName: string | null | undefined
): Promise<ColabRow | null> {
  if (cpfDigits) {
    const hit = await findColaboradorByCpf(cpfDigits);
    if (hit) {
      const { data, error } = await supabaseAdmin
        .from('gt_colaboradores')
        .select(CATALOG_COLAB_SELECT)
        .eq('id', hit.id)
        .maybeSingle();
      if (error) console.error('[document-catalog] colab by cpf id:', error.message);
      if (data) return normalizeColabRow(data);
    }
  }
  if (emailLower) {
    const { data, error } = await supabaseAdmin
      .from('gt_colaboradores')
      .select(CATALOG_COLAB_SELECT)
      .is('deleted_at', null)
      .ilike('email', emailLower)
      .limit(2);
    if (error) console.error('[document-catalog] colab by email:', error.message);
    if (data?.length === 1) return normalizeColabRow(data[0]);
    if ((data || []).length > 1 && fullName) {
      const named = pickUniqueNameMatch(data || [], (row) => row.nome_completo, fullName);
      if (named) return normalizeColabRow(named);
    }
  }
  const byPhone = await findColaboradorByPhone(phone);
  if (byPhone) return byPhone;
  return findColaboradorByUniqueName(fullName);
}

async function findUserByCpfOrEmailOrPhone(
  cpfDigits: string | null,
  emailLower: string | null,
  phone: string | null | undefined,
  fullName: string | null | undefined
): Promise<UserRow | null> {
  if (cpfDigits) {
    const { data, error } = await supabaseAdmin
      .from('users_unified')
      .select(CATALOG_USER_SELECT)
      .or(taxIdOrFilter(cpfDigits))
      .limit(5);
    if (error) {
      console.error('[document-catalog] user by tax_id:', error.message);
    } else {
      const match = (data || []).find((row) => digitsOrNull(row.tax_id) === cpfDigits);
      if (match) return match;
    }
  }
  if (emailLower) {
    const { data, error } = await supabaseAdmin
      .from('users_unified')
      .select(CATALOG_USER_SELECT)
      .ilike('email', emailLower)
      .limit(2);
    if (error) console.error('[document-catalog] user by email:', error.message);
    else if (data?.length === 1) return data[0];
  }
  const phoneDigitsValue = String(phone || '').replace(/\D/g, '');
  if (phoneDigitsValue.length >= 8) {
    const tail = phoneDigitsValue.slice(-8);
    const { data, error } = await supabaseAdmin
      .from('users_unified')
      .select(CATALOG_USER_SELECT)
      .ilike('phone_number', `%${tail}%`)
      .limit(10);
    if (error) {
      console.error('[document-catalog] user by phone:', error.message);
    } else {
      const matches = (data || []).filter((row) => phonesMatch(row.phone_number, phone));
      if (matches.length === 1) return matches[0];
    }
  }
  const tokens = nameLookupTokens(fullName);
  if (!tokens) return null;
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select(CATALOG_USER_SELECT)
    .ilike('first_name', `${tokens.first}%`)
    .ilike('last_name', `%${tokens.last}%`)
    .limit(20);
  if (error) {
    console.error('[document-catalog] user by name:', error.message);
    return null;
  }
  return pickUniqueNameMatch(
    data || [],
    (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.name,
    fullName
  );
}

async function fetchPortalUserById(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select(CATALOG_USER_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[document-catalog] users_unified by id:', error.message);
    return null;
  }
  return data;
}

async function fetchColaboradorById(colaboradorId: string): Promise<ColabRow | null> {
  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select(CATALOG_COLAB_SELECT)
    .eq('id', colaboradorId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('[document-catalog] gt_colaboradores by id:', error.message);
    return null;
  }
  return normalizeColabRow(data);
}

export async function resolveCollaboratorIdentity(opts: {
  userId?: string | null;
  colaboradorId?: string | null;
}): Promise<CollaboratorIdentity | null> {
  const userId = opts.userId || null;
  const colaboradorId = opts.colaboradorId || null;
  if (!userId && !colaboradorId) return null;

  let user: UserRow | null = null;
  let colab: ColabRow | null = null;

  if (userId) {
    user = await fetchPortalUserById(userId);
    if (user) {
      colab = await findColaboradorByUserId(user.id);
    }
  }

  if (colaboradorId && !colab) {
    colab = await fetchColaboradorById(colaboradorId);
  }

  if (user && !colab) {
    colab = await findColaboradorByCpfOrEmailOrPhone(
      digitsOrNull(user.tax_id),
      user.email ? user.email.toLowerCase() : null,
      user.phone_number,
      userDisplayName(user)
    );
  }

  if (colab && !user) {
    if (colab.user_id) {
      user = await fetchPortalUserById(colab.user_id);
    }
    if (!user) {
      user = await findUserByCpfOrEmailOrPhone(
        digitsOrNull(colab.cpf),
        colab.email ? colab.email.toLowerCase() : null,
        colab.telefone,
        colab.nome_completo
      );
    }
  }

  if (user && colab && colab.user_id && colab.user_id !== user.id) {
    if (!namesCorroborate(userDisplayName(user), colab.nome_completo)) {
      console.warn('[document-catalog] skip GT row with conflicting user_id');
      colab = null;
    }
  }

  if (user) return identityFromUser(user, colab);
  if (colab) return identityFromColab(colab, user);
  return null;
}
