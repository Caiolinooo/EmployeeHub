/**
 * Permissões do módulo Indicadores (R&S) — espelha o padrão do gate ASO
 * logística (aso-agendamento-logistica.ts + aso-agendamento-auth.ts):
 *
 *   1. ADMIN → sempre permitido;
 *   2. ACL: checkAclPermission(userId, role, 'indicadores', nivel);
 *   3. Setor do usuário com nome R&S-like E `sectors.allowed_modules`
 *      incluindo 'indicadores' (módulo sozinho não basta).
 *
 * As consultas de setor usam supabaseAdmin (service_role) — as tabelas do
 * módulo têm RLS ligado e ZERO policies.
 */
import { checkAclPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export type NivelIndicadores = 'view' | 'edit' | 'import';

const MODULO_INDICADORES = 'indicadores';
// R&S-like: recrutamento, seleção/selecao, R&S ou RH.
const RS_SETOR_REGEX = /(recrutamento|sele[çc][ãa]o|r&s|rh)/i;

export interface SetorIndicadores {
  name?: string | null;
  allowed_modules?: unknown;
}

export function setorEhRS(name: string | null | undefined): boolean {
  return RS_SETOR_REGEX.test(String(name || ''));
}

export function setorTemModuloIndicadores(allowed: unknown): boolean {
  const list = Array.isArray(allowed) ? allowed : [];
  return list.some((m) => String(m || '').trim().toLowerCase() === MODULO_INDICADORES);
}

async function podeNivelIndicadores(
  userId: string,
  role: string | undefined,
  nivel: NivelIndicadores,
) {
  if ((role || '').toUpperCase() === 'ADMIN') return true;
  if (!userId) return false;

  if (await checkAclPermission(userId, role || '', MODULO_INDICADORES, nivel)) return true;

  const { data: user } = await supabaseAdmin
    .from('users_unified')
    .select('sector_id')
    .eq('id', userId)
    .maybeSingle();
  if (!user?.sector_id) return false;

  const { data: sector } = await supabaseAdmin
    .from('sectors')
    .select('name, allowed_modules')
    .eq('id', user.sector_id)
    .maybeSingle();
  if (!sector) return false;

  return setorEhRS((sector as SetorIndicadores).name) && setorTemModuloIndicadores((sector as SetorIndicadores).allowed_modules);
}

/** GET planilhas / GET linhas. */
export function podeVerIndicadores(userId: string, role: string | undefined) {
  return podeNivelIndicadores(userId, role, 'view');
}

/** POST/PUT/DELETE linhas + PUT aba. */
export function podeEditarIndicadores(userId: string, role: string | undefined) {
  return podeNivelIndicadores(userId, role, 'edit');
}

/** analyze / confirm / DELETE planilha. */
export function podeImportarIndicadores(userId: string, role: string | undefined) {
  return podeNivelIndicadores(userId, role, 'import');
}
