/**
 * Serviço do GT Fechamento v2 (R7) — auditoria das edições de escala.
 * Camada REUTILIZÁVEL (lib pura, sem next/server) para as rotas
 * /escala-edicoes e para qualquer consumidor futuro.
 *
 * Divisão de responsabilidade (uma única implementação de cada mecânica):
 * - REGISTRAR edição (best-effort) e ROLLBACK (rejeitar/reverter): delegam para
 *   `escala-audit-writer.ts` — a implementação canônica usada por
 *   POST/PUT/DELETE /embarques e por /escala-edicoes/[id]/rejeitar|reverter.
 *   Falha de auditoria NUNCA derruba o save do operador.
 * - LISTAGEM paginada da fila (mais novas primeiro, nome resolvido):
 *   implementada AQUI (variante reutilizável do GET /escala-edicoes).
 *
 * Tabela gt_escala_edicoes: RLS ligado, ZERO policies — apenas service_role /
 * supabaseAdmin. Migration: supabase/migrations/20260916_000001_gt_fechamento_v2.sql
 * Leituras paginadas (PostgREST trunca em 1000 linhas — db-max-rows).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import {
  ESCALA_EDICAO_OPERACOES,
  ESCALA_EDICAO_STATUS,
  registrarEdicaoEscala,
  reverterEdicaoEscala,
  type EscalaEdicaoAtor,
  type EscalaEdicaoOperacao,
  type EscalaEdicaoRow,
  type EscalaEdicaoStatus,
} from '@/lib/gestao-tripulantes/escala-audit-writer';

export const OPERACOES_ESCALA_EDICAO = ESCALA_EDICAO_OPERACOES;
export const STATUS_ESCALA_EDICAO = ESCALA_EDICAO_STATUS;

export type OperacaoEscalaEdicao = EscalaEdicaoOperacao;
export type StatusEscalaEdicao = EscalaEdicaoStatus;
export type AtorEscalaEdicao = EscalaEdicaoAtor;

export function isOperacaoEscalaEdicao(v: unknown): v is OperacaoEscalaEdicao {
  return (OPERACOES_ESCALA_EDICAO as readonly string[]).includes(String(v || ''));
}

export function isStatusEscalaEdicao(v: unknown): v is StatusEscalaEdicao {
  return (STATUS_ESCALA_EDICAO as readonly string[]).includes(String(v || ''));
}

export interface RegistrarEscalaEdicaoInput {
  embarqueId?: string | null;
  colaboradorId?: string | null;
  operacao: OperacaoEscalaEdicao;
  status?: StatusEscalaEdicao;
  dadosAnteriores?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  motivo?: string | null;
  ator?: AtorEscalaEdicao | null;
  ip?: string | null;
}

export type EscalaEdicaoRowComNome = EscalaEdicaoRow & { colaborador_nome: string | null };

/**
 * Grava a linha de auditoria da edição. BEST-EFFORT: erro é logado e a função
 * retorna { ok:false } sem lançar — o save do embarque nunca falha por aqui.
 * Delega ao audit-writer (mesmo insert usado pelas rotas de embarques).
 */
export async function registrarEscalaEdicao(
  input: RegistrarEscalaEdicaoInput,
): Promise<{ ok: boolean; error?: string }> {
  let ok = false;
  try {
    ok = await registrarEdicaoEscala({
      embarqueId: input.embarqueId,
      colaboradorId: input.colaboradorId,
      operacao: input.operacao,
      status: input.status,
      dadosAnteriores: input.dadosAnteriores ?? null,
      dadosNovos: input.dadosNovos ?? null,
      motivo: input.motivo ?? null,
      ator: { ...(input.ator || {}), ip: input.ator?.ip || input.ip || null },
    });
  } catch (err) {
    console.error('[gt-escala-edicoes] Erro inesperado ao registrar edição:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return ok ? { ok: true } : { ok: false, error: 'Falha ao gravar auditoria da edição (best-effort).' };
}

export interface ListarEscalaEdicoesFiltro {
  status?: string | null;
  colaboradorId?: string | null;
  page?: number;
  pageSize?: number;
}

/**
 * Fila paginada (mais novas primeiro, desempate por id) com nome do
 * colaborador resolvido em lote. Uma página é <= pageSize (<= 200) — range()
 * direto; o count usa query separada com os mesmos filtros.
 */
export async function listarEscalaEdicoes(filtro: ListarEscalaEdicoesFiltro = {}): Promise<{
  rows: EscalaEdicaoRowComNome[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
}> {
  const page = Math.max(1, Number(filtro.page) > 0 ? Math.floor(Number(filtro.page)) : 1);
  const pageSize = Math.min(200, Math.max(1, Number(filtro.pageSize) > 0 ? Math.floor(Number(filtro.pageSize)) : 50));

  const statusFiltro = filtro.status && isStatusEscalaEdicao(filtro.status) ? filtro.status : null;
  const aplicarFiltros = (query: any): any => {
    let q = query;
    if (statusFiltro) q = q.eq('status', statusFiltro);
    if (filtro.colaboradorId) q = q.eq('colaborador_id', filtro.colaboradorId);
    return q;
  };

  try {
    const { count, error: countErr } = await aplicarFiltros(
      supabaseAdmin.from('gt_escala_edicoes').select('id', { count: 'exact', head: true }),
    );
    if (countErr) {
      return { rows: [], total: 0, page, pageSize, totalPages: 0, error: countErr.message };
    }
    const total = count || 0;

    const from = (page - 1) * pageSize;
    const { data, error } = await aplicarFiltros(
      supabaseAdmin
        .from('gt_escala_edicoes')
        .select('*'),
    )
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      return { rows: [], total, page, pageSize, totalPages: 0, error: error.message };
    }
    const rows = (data || []) as EscalaEdicaoRow[];
    const ids = rows.map(
      (r) =>
        r.colaborador_id ||
        (r.dados_novos as { colaborador_id?: string } | null)?.colaborador_id ||
        (r.dados_anteriores as { colaborador_id?: string } | null)?.colaborador_id ||
        null,
    );
    const nomes = await resolverNomesColaboradores(ids);

    return {
      rows: rows.map((r) => ({
        ...r,
        colaborador_nome: nomes.get(String(ids[rows.indexOf(r)] || '')) || null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (err) {
    return {
      rows: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      error: err instanceof Error ? err.message : String(err),
  };
  }
}

// resolverNomesColaboradores é importado no topo via audit-writer? — não:
// vive no mesmo módulo; reexportado abaixo para uso local tipado.
import { resolverNomesColaboradores } from '@/lib/gestao-tripulantes/escala-audit-writer';

export interface RevisarEscalaEdicaoInput {
  modo: 'rejeicao' | 'reversao';
  motivo?: string | null;
  revisadaPor?: { id?: string | null; nome?: string | null };
}

export type RevisarEscalaEdicaoResult =
  | { ok: true; edicao: EscalaEdicaoRow }
  | { ok: false; error: string; httpStatus: number };

/**
 * Mecânica compartilhada de rollback, reutilizável por
 * POST /escala-edicoes/[id]/rejeitar (modo 'rejeicao') e
 * POST /escala-edicoes/[id]/reverter (modo 'reversao').
 * Delega a `reverterEdicaoEscala` do audit-writer (implementação canônica das
 * rotas): rollback imediato em gt_historico_embarques
 * (update→restaura dados_anteriores; delete→reabre a linha; create→soft-delete
 * da linha criada; restore→volta o soft-delete), status 'revertida' +
 * revisada_* + motivo, e a própria linha de auditoria ('rejeicao'/'reversao').
 * Sempre invalida o cache do Man Schedule e ressincroniza as datas de escala.
 */
export async function revisarEscalaEdicao(
  id: string,
  input: RevisarEscalaEdicaoInput,
): Promise<RevisarEscalaEdicaoResult> {
  if (!id) return { ok: false, error: 'id obrigatório.', httpStatus: 400 };
  if (input.modo !== 'rejeicao' && input.modo !== 'reversao') {
    return { ok: false, error: 'modo inválido (use rejeicao ou reversao).', httpStatus: 400 };
  }
  const resultado = await reverterEdicaoEscala({
    edicaoId: id,
    motivo: (input.motivo || '').trim(),
    ator: {
      id: input.revisadaPor?.id || null,
      nome: input.revisadaPor?.nome || null,
    },
    operacao: input.modo,
  });
  if (!resultado.ok) {
    return { ok: false, error: resultado.error, httpStatus: resultado.status };
  }
  return { ok: true, edicao: resultado.edicao };
}
