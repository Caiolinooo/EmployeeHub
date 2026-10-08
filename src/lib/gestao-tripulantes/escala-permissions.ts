import { loadEffectivePermissions } from '@/lib/effective-permissions-server';
import { isDesligamentoGestorRole } from './desligamento-setor';

export const MENSAGEM_ESCALA_NEGADA =
  'Acesso negado. Edição da escala exige o módulo Gestão de Tripulantes ou Man Schedule.';

/** Editar a escala local: gestor, ou módulo GT / Man Schedule efetivo (usuário, setor ou ACL). */
export async function podeEditarEscalaGt(
  userId: string,
  role: string | undefined,
): Promise<boolean> {
  if (isDesligamentoGestorRole(role)) return true;
  if (!userId) return false;
  const snapshot = await loadEffectivePermissions(userId);
  if (!snapshot) return false;
  return snapshot.modules['gestao-tripulantes'] === true || snapshot.modules['man-schedule'] === true;
}
