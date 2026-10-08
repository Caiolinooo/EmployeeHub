import { normalizeRole, roleBypassesGate } from '@/lib/effective-feature';

export const DOCS_VIEW_ALL = 'gestao-tripulantes.documents.view_all';
export const DOCS_VIEW_OWN = 'gestao-tripulantes.documents.view_own';

export const MENSAGEM_DOCUMENTOS_RESTRITOS = 'Sem acesso aos documentos deste colaborador (escopo ou empresa restrita)';

/** `todos` = documentos pessoais de qualquer colaborador; `proprios` = só os vinculados ao usuário. */
export type EscopoDocumentos = 'todos' | 'proprios';

export interface EscopoDocumentosGt {
  escopo: EscopoDocumentos;
  /** `gt_colaboradores.id` com `user_id` = viewer (ativo ou não). */
  colaboradorIds: string[];
}

export interface EntradaEscopoDocumentos {
  role: string | null | undefined;
  /** Setor DP/RH com o módulo `gestao-tripulantes` (`setorPermiteDesligamento`). */
  setorDp: boolean;
  /** Feature JSONB / ACL `documents.view_all` (inclui o default de role semeado no ACL). */
  viewAll: boolean;
  /** `view_all` revogado no usuário (`viewAllNegadoNoUsuario`). */
  viewAllNegado: boolean;
}

/** Revogação explícita do usuário: `false` no JSONB **ou** ACL `granted = false`. */
export function viewAllNegadoNoUsuario(
  features: Record<string, unknown> | null | undefined,
  aclDeniedNames: readonly string[] | null | undefined,
): boolean {
  return features?.[DOCS_VIEW_ALL] === false || !!aclDeniedNames?.includes(DOCS_VIEW_ALL);
}

/**
 * Terceiros: ADMIN, `view_all` explícito, MANAGER (contrato legado) ou setor DP/RH + GT.
 * Deny explícito de `view_all` vence setor/role (exceto ADMIN). Os demais, internos ou externos, só os próprios.
 */
export function decidirEscopoDocumentos(e: EntradaEscopoDocumentos): EscopoDocumentos {
  if (roleBypassesGate(e.role, 'admin')) return 'todos';
  if (e.viewAllNegado) return 'proprios';
  if (e.viewAll || normalizeRole(e.role) === 'MANAGER' || e.setorDp) return 'todos';
  return 'proprios';
}

export function escopoVeColaborador(e: EscopoDocumentosGt, colaboradorId: string | null | undefined): boolean {
  if (e.escopo === 'todos') return true;
  return !!colaboradorId && e.colaboradorIds.includes(colaboradorId);
}

export function escopoVeUsuario(
  e: EscopoDocumentosGt,
  viewerId: string,
  subjectUserId: string | null | undefined,
): boolean {
  return e.escopo === 'todos' || (!!subjectUserId && subjectUserId === viewerId);
}
