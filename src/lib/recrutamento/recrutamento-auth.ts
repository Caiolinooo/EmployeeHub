import { supabaseAdmin } from '@/lib/supabase';
import { checkAclPermission } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';

const MODULO_RECRUTAMENTO = 'recrutamento';
export type NivelRecrutamento = 'view' | 'manage' | 'admin';

const GESTOR = (role: string | undefined): boolean => {
  const r = (role || '').toUpperCase();
  return r === 'ADMIN' || r === 'ADMINISTRADOR' || r === 'SUPERADMIN' || r === 'MANAGER';
};

/**
 * ADMIN/MANAGER, ACL recrutamento.nivel, setor com módulo recrutamento nos allowed_modules,
 * ou um dos `grants` (ações `recrutamento.*` de module-grants), que só somam.
 */
export async function podeNivelRecrutamento(
  userId: string,
  role: string | undefined,
  nivel: NivelRecrutamento,
  grants: readonly string[] = [],
): Promise<boolean> {
  if (GESTOR(role)) return true;
  if (!userId) return false;

  if (await checkAclPermission(userId, role || '', MODULO_RECRUTAMENTO, nivel)) return true;
  if (grants.length > 0 && (await canWithGrant(userId, role, grants))) return true;

  const { data: user } = await supabaseAdmin
    .from('users_unified')
    .select('sector_id')
    .eq('id', userId)
    .maybeSingle();
  if (!user?.sector_id) return false;

  const { data: sector } = await supabaseAdmin
    .from('sectors')
    .select('allowed_modules')
    .eq('id', user.sector_id)
    .maybeSingle();
  const mods = Array.isArray(sector?.allowed_modules) ? sector.allowed_modules : [];
  return mods.some((m: unknown) => String(m || '').trim().toLowerCase() === MODULO_RECRUTAMENTO);
}
