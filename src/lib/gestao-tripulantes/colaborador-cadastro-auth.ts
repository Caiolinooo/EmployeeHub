import { userHasGrant } from '@/lib/effective-permissions-server';
import { podeRegistrarDesligamento } from './desligamento-auth';

export { MENSAGEM_CADASTRO_NEGADO } from './colaborador-cadastro';

/** Feature JSONB / ACL (also implied by GT manage|admin and dp manage|admin) that opens the DP cadastro. */
export const CADASTRO_DP_GRANT = 'gestao-tripulantes.cadastro.manage';

/**
 * Cadastro DP gate: ADMIN/MANAGER/SUPERADMIN, DP/RH sector + GT module, or an explicit
 * grant (`gestao-tripulantes.cadastro.manage` feature/ACL). Covers colaboradores and the
 * auxiliary lookups (departamentos, cargos, empresas, embarcações, centros de custo).
 */
export async function podeMutarCadastroColaborador(
  userId: string,
  role: string | undefined,
): Promise<boolean> {
  if (await podeRegistrarDesligamento(userId, role)) return true;
  return userHasGrant(userId, [CADASTRO_DP_GRANT]);
}
