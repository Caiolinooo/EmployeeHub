import { podeRegistrarDesligamento } from './desligamento-auth';

export { MENSAGEM_CADASTRO_NEGADO } from './colaborador-cadastro';

/** Same gate as desligamento: ADMIN/MANAGER/SUPERADMIN or DP/RH sector + GT module. */
export async function podeMutarCadastroColaborador(
  userId: string,
  role: string | undefined,
): Promise<boolean> {
  return podeRegistrarDesligamento(userId, role);
}
