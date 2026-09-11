import { supabaseAdmin } from '@/lib/supabase';
import {
  isDesligamentoGestorRole,
  setorPermiteDesligamento,
  type SetorDesligamento,
} from './desligamento-setor';

export {
  isDesligamentoGestorRole,
  MENSAGEM_DESLIGAMENTO_NEGADO,
  setorEhDp,
  setorPermiteDesligamento,
  type SetorDesligamento,
} from './desligamento-setor';

export async function podeRegistrarDesligamento(
  userId: string,
  role: string | undefined,
): Promise<boolean> {
  if (isDesligamentoGestorRole(role)) return true;
  if (!userId) return false;

  const { data: user, error: userError } = await supabaseAdmin
    .from('users_unified')
    .select('sector_id')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user?.sector_id) return false;

  const { data: sector, error: sectorError } = await supabaseAdmin
    .from('sectors')
    .select('name, allowed_modules')
    .eq('id', user.sector_id)
    .maybeSingle();

  if (sectorError || !sector) return false;
  return setorPermiteDesligamento(sector as SetorDesligamento);
}
