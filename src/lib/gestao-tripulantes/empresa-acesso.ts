/**
 * ACL por empresa — Gestão de Tripulantes.
 *
 * Modelo: o documento/colaborador herda `gt_colaboradores.empresa_id`.
 * A tabela `gt_user_empresa_acesso` guarda as empresas liberadas por usuário:
 *   - 0 linhas  → SEM restrição (comportamento legado: vê tudo);
 *   - 1+ linhas → só acessa colaboradores dessas empresas.
 * Colaborador sem empresa (empresa_id NULL) permanece visível a todos —
 * decisão para não sumir com cadastros legados.
 * ADMIN / MANAGER / SUPERADMIN fazem bypass.
 * As variantes de documento/colaborador aplicam antes o escopo `documents.view_all|view_own`
 * (`documento-escopo.ts`, vale também para MANAGER com deny explícito): escopo próprio só passa
 * nos colaboradores vinculados ao usuário.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { escopoVeColaborador, resolverEscopoDocumentosGt } from './documento-escopo';

export interface EmpresaAcessoUser {
  id: string;
  role?: string | null;
}

const ROLES_BYPASS = new Set(['ADMIN', 'MANAGER', 'SUPERADMIN']);

export function roleBypassEmpresa(role?: string | null): boolean {
  return ROLES_BYPASS.has((role || '').toUpperCase());
}

/**
 * Retorna a lista de empresa_ids liberadas, ou null quando o usuário
 * não tem NENHUMA restrição configurada (0 linhas = vê tudo).
 */
export async function getEmpresasRestricaoUsuario(userId: string): Promise<string[] | null> {
  const { data, error } = await supabaseAdmin
    .from('gt_user_empresa_acesso')
    .select('empresa_id')
    .eq('user_id', userId);

  if (error) {
    // Falha ao ler restrição: falha FECHADA é mais segura para dados restritos,
    // mas quebraria o portal inteiro se a tabela faltar — loga e segue sem restrição.
    console.error('[empresa-acesso] erro ao ler restrições:', error);
    return null;
  }
  if (!data || data.length === 0) return null;
  return data.map(r => r.empresa_id as string);
}

/**
 * Pode ver um colaborador/documento cuja empresa é `empresaId`?
 * null em empresaId = colaborador sem empresa → visível a todos.
 */
export async function usuarioPodeVerEmpresa(
  user: EmpresaAcessoUser,
  empresaId: string | null | undefined
): Promise<boolean> {
  if (roleBypassEmpresa(user.role)) return true;
  const restricao = await getEmpresasRestricaoUsuario(user.id);
  if (!restricao) return true; // sem restrição configurada
  if (!empresaId) return true; // colaborador sem empresa fica visível
  return restricao.includes(empresaId);
}

/**
 * Monta a cláusula OR do PostgREST para o filtro de empresa:
 * `empresa_id.is.null` (sem empresa → visível a todos) + `empresa_id.in.(...)`.
 */
export function montarOrClauseEmpresa(empresaIds: string[], coluna = 'empresa_id'): string {
  const lista = empresaIds.join(',');
  return `${coluna}.is.null,${coluna}.in.(${lista})`;
}

/**
 * Aplica o filtro de empresa num builder PostgREST já em mãos.
 * Sem restrição (null) → builder intacto.
 * Com restrição → empresa IN (...) OR empresa IS NULL.
 *
 * Síncrono de propósito. O builder é thenable. Devolvê-lo de uma função
 * async executa o select. O caller recebe `{ data, error }` e o próximo
 * `.or()` quebra com `query.or is not a function` (GET /colaboradores 500).
 */
export function aplicarFiltroEmpresa<Q>(
  query: Q,
  empresaIds: string[] | null,
  coluna = 'empresa_id'
): Q {
  if (!empresaIds) return query;
  return (query as { or: (filters: string) => Q }).or(montarOrClauseEmpresa(empresaIds, coluna));
}

/**
 * Variante para rotas de documento: resolve a empresa do colaborador dono
 * do documento e aplica usuarioPodeVerEmpresa. Doc inexistente → true
 * (a rota responde 404 como sempre).
 */
export async function usuarioPodeVerDocumentoGt(
  user: EmpresaAcessoUser,
  documentoId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('gt_documentos')
    .select('colaborador_id, gt_colaboradores(empresa_id)')
    .eq('id', documentoId)
    .maybeSingle();
  if (error || !data) return true;
  const escopo = await resolverEscopoDocumentosGt(user.id, user.role);
  if (!escopoVeColaborador(escopo, data.colaborador_id)) return false;
  const empresaId = (data.gt_colaboradores as any)?.empresa_id ?? null;
  return usuarioPodeVerEmpresa(user, empresaId);
}

/**
 * Variante por colaborador: para as rotas de upload (alvo = colaborador).
 */
export async function usuarioPodeVerColaborador(
  user: EmpresaAcessoUser,
  colaboradorId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('empresa_id')
    .eq('id', colaboradorId)
    .maybeSingle();
  if (error || !data) return true;
  if (!escopoVeColaborador(await resolverEscopoDocumentosGt(user.id, user.role), colaboradorId)) return false;
  return usuarioPodeVerEmpresa(user, data.empresa_id);
}

/**
 * Intersecta uma lista de colaborador_ids com os permitidos pela ACL
 * de empresa do usuário. Útil quando a rota já tem ids em mãos.
 * Retorna null quando não há restrição (sem filtro necessário).
 */
export async function idsColaboradoresPermitidos(
  user: EmpresaAcessoUser,
  colaboradorIds: string[]
): Promise<string[] | null> {
  const escopo = await resolverEscopoDocumentosGt(user.id, user.role);
  if (escopo.escopo === 'proprios') {
    colaboradorIds = colaboradorIds.filter((id) => escopoVeColaborador(escopo, id));
  }
  const restricao = roleBypassEmpresa(user.role) ? null : await getEmpresasRestricaoUsuario(user.id);
  if (!restricao) return escopo.escopo === 'proprios' ? colaboradorIds : null;
  if (colaboradorIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id, empresa_id')
    .in('id', colaboradorIds);

  if (error) {
    console.error('[empresa-acesso] erro ao carregar empresas de colaboradores:', error);
    return [];
  }
  return (data || [])
    .filter(c => !c.empresa_id || restricao.includes(c.empresa_id))
    .map(c => c.id as string);
}

/**
 * Mantém só as linhas cujo colaborador o usuário pode ver (escopo + empresa).
 * Linha sem colaborador (quarentena, evento órfão) só passa sem restrição nenhuma.
 */
export async function filtrarPorColaboradorPermitido<T>(
  user: EmpresaAcessoUser,
  rows: T[],
  colaboradorDe: (row: T) => string | null | undefined,
): Promise<T[]> {
  const ids = [...new Set(rows.map(colaboradorDe).filter((id): id is string => !!id))];
  const permitidos = await idsColaboradoresPermitidos(user, ids);
  if (!permitidos) return rows;
  const visiveis = new Set(permitidos);
  return rows.filter((row) => {
    const id = colaboradorDe(row);
    return !!id && visiveis.has(id);
  });
}
