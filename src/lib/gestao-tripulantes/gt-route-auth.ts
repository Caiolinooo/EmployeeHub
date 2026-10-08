import { NextRequest, NextResponse } from 'next/server';
import { checkAclPermission, extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { userHasGrant } from '@/lib/effective-permissions-server';
import { podeMutarCadastroColaborador } from './colaborador-cadastro-auth';
import { isFechamentoRole } from './fechamento-assinatura';

/** Catálogo `module-grants.ts`: soma quem configura o módulo (marcadores, logs, fechamento) ao gate de papel. */
export const GT_CONFIG_GRANT = 'gestao-tripulantes.configuracoes.manage';

/** 401 when the bearer token is missing or invalid; null when authenticated. */
export function exigirTokenGt(request: NextRequest): NextResponse | null {
  const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
  if (!token) {
    return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
  }
  if (!verifyToken(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
  return null;
}

export type AcaoFechamento = 'periodo' | 'marcas' | 'revisao';

/** Fechamento: gestor, ACL `gestao-tripulantes.fechamento.<acao>` ou a mesma feature JSONB de /admin/users. */
export async function podeAcaoFechamento(
  userId: string,
  role: string | undefined,
  acao: AcaoFechamento,
): Promise<boolean> {
  if (isFechamentoRole(role)) return true;
  if (!userId) return false;
  const nome = `fechamento.${acao}`;
  if (await checkAclPermission(userId, String(role || '').toUpperCase(), 'gestao-tripulantes', nome)) {
    return true;
  }
  return userHasGrant(userId, [`gestao-tripulantes.${nome}`]);
}

/** 401/403 unless the caller passes the DP cadastro gate (`podeMutarCadastroColaborador`). */
export async function exigirCadastroDp(request: NextRequest): Promise<NextResponse | null> {
  const unauthenticated = exigirTokenGt(request);
  if (unauthenticated) return unauthenticated;
  const payload = verifyToken(extractTokenFromHeader(request.headers.get('authorization') || undefined)!);
  if (!payload || !(await podeMutarCadastroColaborador(payload.userId, payload.role))) {
    return NextResponse.json(
      { error: 'Acesso negado. Sem permissão para gerenciar o cadastro do DP.' },
      { status: 403 },
    );
  }
  return null;
}
