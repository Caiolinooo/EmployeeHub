/**
 * Serviço do GT Fechamento v2 — período manual por mês (R2) e lista de
 * marcados (R5). Camada REUTILIZÁVEL (lib pura, sem next/server) para as rotas
 * /fechamento/periodo, /fechamento/marcacoes e para qualquer consumidor futuro.
 *
 * Divisão de responsabilidade (uma única implementação de cada mecânica):
 * - LEITURA do período/marcações: delega para `fechamento-periodo-resolver.ts`
 *   (mesma fonte usada por GET /relatorio-mensal e /aprovar — explicit >
 *   config > mês civil).
 * - ESCRITA (upsert de período/marcações, confirmação da lista): implementada
 *   AQUI, com as mesmas validações validadas das rotas.
 * - Nomes de colaboradores: delega para `escala-audit-writer.resolverNomesColaboradores`
 *   (mesmo helper das rotas — paginado).
 *
 * Tabelas (RLS ligado, ZERO policies — acesso apenas via supabaseAdmin):
 * - gt_fechamento_periodos  (mes_referencia PK, data_inicio/data_fim, lista_confirmada)
 * - gt_fechamento_marcacoes (UNIQUE(mes_referencia, colaborador_id), marcado)
 *
 * Todas as leituras em massa são PAGINADAS (PostgREST trunca em 1000 linhas,
 * db-max-rows=1000) com order() determinístico.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import {
  carregarMarcacoesDoMes,
  carregarPeriodoConfigurado,
} from '@/lib/gestao-tripulantes/fechamento-periodo-resolver';
import { resolverNomesColaboradores } from '@/lib/gestao-tripulantes/escala-audit-writer';

export interface FechamentoPeriodoNormalizado {
  mesReferencia: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  listaConfirmada: boolean;
  definidoPorNome: string | null;
}

export interface MarcadoFechamento {
  colaboradorId: string;
  nome: string;
  marcado: boolean;
  marcadoPorNome: string | null;
}

export type ResultadoEscrita = { ok: true } | { ok: false; error: string };

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function normalizarMesReferencia(value: unknown): string | null {
  const v = String(value || '').trim().slice(0, 7);
  return MES_REGEX.test(v) ? v : null;
}

/** Aceita apenas YYYY-MM-DD civil real (1990–2100, padrão dos filtros GT). */
export function normalizarDataIso(value: unknown): string | null {
  const v = String(value || '').trim().slice(0, 10);
  if (!DATA_REGEX.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (y < 1990 || y > 2100) return null;
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return v;
}

function toDate(v: string): number {
  const [y, m, d] = v.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Lê a linha de período do mês (PK mes_referencia). Delega ao resolver
 * (fonte canônica das rotas). Erro/ausente → null (fail-soft).
 */
export async function carregarPeriodoFechamento(
  mesReferencia: string,
): Promise<FechamentoPeriodoNormalizado | null> {
  const mes = normalizarMesReferencia(mesReferencia);
  if (!mes) return null;
  const row = await carregarPeriodoConfigurado(mes);
  if (!row || !row.data_inicio || !row.data_fim) return null;
  return {
    mesReferencia: row.mes_referencia,
    dataInicio: String(row.data_inicio).slice(0, 10),
    dataFim: String(row.data_fim).slice(0, 10),
    listaConfirmada: row.lista_confirmada === true,
    definidoPorNome: row.definido_por_nome || null,
  };
}

/** Upsert do período do mês (PUT /fechamento/periodo). Valida faixa e formato. */
export async function salvarPeriodoFechamento(input: {
  mesReferencia: string;
  dataInicio: string;
  dataFim: string;
  listaConfirmada?: boolean;
  definidoPor?: string | null;
  definidoPorNome?: string | null;
}): Promise<ResultadoEscrita & { periodo?: FechamentoPeriodoNormalizado }> {
  const mes = normalizarMesReferencia(input.mesReferencia);
  const ini = normalizarDataIso(input.dataInicio);
  const fim = normalizarDataIso(input.dataFim);
  if (!mes) return { ok: false, error: 'mesReferencia inválido (use YYYY-MM).' };
  if (!ini) return { ok: false, error: 'dataInicio inválida (use YYYY-MM-DD).' };
  if (!fim) return { ok: false, error: 'dataFim inválida (use YYYY-MM-DD).' };
  if (toDate(fim) < toDate(ini)) {
    return { ok: false, error: 'dataFim deve ser maior ou igual a dataInicio.' };
  }

  const payload: Record<string, unknown> = {
    mes_referencia: mes,
    data_inicio: ini,
    data_fim: fim,
    updated_at: new Date().toISOString(),
  };
  // listaConfirmada só é tocado quando explicitamente enviado — PUT sem a flag
  // NÃO desconfirma uma lista já confirmada.
  if (typeof input.listaConfirmada === 'boolean') payload.lista_confirmada = input.listaConfirmada;
  if (input.definidoPor !== undefined) payload.definido_por = input.definidoPor || null;
  if (input.definidoPorNome !== undefined) payload.definido_por_nome = input.definidoPorNome || null;

  const { error } = await supabaseAdmin
    .from('gt_fechamento_periodos')
    .upsert(payload, { onConflict: 'mes_referencia' });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    periodo: {
      mesReferencia: mes,
      dataInicio: ini,
      dataFim: fim,
      listaConfirmada: input.listaConfirmada === true,
      definidoPorNome: input.definidoPorNome || null,
    },
  };
}

/**
 * Lista completa de marcações do mês com nome resolvido (mesma mecânica das
 * rotas: linhas paginadas do resolver + nomes em lote do audit-writer).
 */
export async function carregarMarcadosFechamento(mesReferencia: string): Promise<{
  listaConfirmada: boolean;
  marcados: MarcadoFechamento[];
  error?: string;
}> {
  const mes = normalizarMesReferencia(mesReferencia);
  if (!mes) return { listaConfirmada: false, marcados: [], error: 'mesReferencia inválido (use YYYY-MM).' };

  const periodo = await carregarPeriodoFechamento(mes);
  const rows = await carregarMarcacoesDoMes(mes);
  const nomes = await resolverNomesColaboradores(rows.map((r) => r.colaborador_id));
  const marcados = rows.map((row) => ({
    colaboradorId: row.colaborador_id,
    nome: nomes.get(row.colaborador_id) || '(colaborador removido)',
    marcado: row.marcado === true,
    marcadoPorNome: row.marcado_por_nome || null,
  }));
  return { listaConfirmada: periodo?.listaConfirmada === true, marcados };
}

/** Ids com marcado=true no mês (base set do fechamento quando lista confirmada). */
export async function carregarIdsMarcados(mesReferencia: string): Promise<string[]> {
  const mes = normalizarMesReferencia(mesReferencia);
  if (!mes) return [];
  const pag = await paginarSelect<{ colaborador_id: string }>(async (from, to) => {
    const r = await supabaseAdmin
      .from('gt_fechamento_marcacoes')
      .select('colaborador_id')
      .eq('mes_referencia', mes)
      .eq('marcado', true)
      .order('colaborador_id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (pag.error) {
    console.error('[gt-fechamento-periodos] Erro ao carregar ids marcados:', pag.error);
    return [];
  }
  return [...new Set(pag.rows.map((r) => r.colaborador_id))];
}

/** Upsert em lote das marcações (POST /fechamento/marcacoes). */
export async function salvarMarcacoesFechamento(input: {
  mesReferencia: string;
  listaConfirmada?: boolean;
  itens: Array<{ colaboradorId: string; marcado: boolean }>;
  ator?: { id?: string | null; nome?: string | null } | null;
}): Promise<ResultadoEscrita & { salvos?: number; listaConfirmada?: boolean }> {
  const mes = normalizarMesReferencia(input.mesReferencia);
  if (!mes) return { ok: false, error: 'mesReferencia inválido (use YYYY-MM).' };
  const itens = (input.itens || []).filter(
    (it) => it && typeof it.colaboradorId === 'string' && it.colaboradorId.length > 0,
  );
  if (itens.length === 0 && typeof input.listaConfirmada !== 'boolean') {
    return { ok: false, error: 'Informe itens e/ou listaConfirmada.' };
  }

  if (itens.length > 0) {
    const now = new Date().toISOString();
    const rows = itens.map((it) => ({
      mes_referencia: mes,
      colaborador_id: it.colaboradorId,
      marcado: it.marcado !== false,
      marcado_por: input.ator?.id || null,
      marcado_por_nome: input.ator?.nome || null,
      updated_at: now,
    }));
    // Upsert em fatias (limite prático de payload do PostgREST).
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabaseAdmin
        .from('gt_fechamento_marcacoes')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'mes_referencia,colaborador_id' });
      if (error) return { ok: false, error: error.message };
    }
  }

  if (typeof input.listaConfirmada === 'boolean') {
    const existente = await carregarPeriodoFechamento(mes);
    if (existente) {
      const { error } = await supabaseAdmin
        .from('gt_fechamento_periodos')
        .update({ lista_confirmada: input.listaConfirmada, updated_at: new Date().toISOString() })
        .eq('mes_referencia', mes);
      if (error) return { ok: false, error: error.message };
    } else if (input.listaConfirmada) {
      // Confirmar a lista exige período definido — NUNCA inventar datas.
      return {
        ok: false,
        error: 'Defina o período do mês (PUT /fechamento/periodo) antes de confirmar a lista.',
      };
    }
  }

  const periodoFinal = await carregarPeriodoFechamento(mes);
  return {
    ok: true,
    salvos: itens.length,
    listaConfirmada: periodoFinal?.listaConfirmada === true,
  };
}

/**
 * R5 auxiliar: nomes de embarcação (vírgula separada) → ids de gt_embarcacoes.
 * PAGINADO; case-insensitive; nome sem match não volta id. Disponível para
 * consumidores que precisam do filtro em nível de banco (`.in('embarcacao_id', ids)`);
 * o gerador do relatório mantém o contrato por NOME (filtro em memória, igual
 * ao filtro single-embarcacao pré-existente).
 */
export async function resolverIdsEmbarcacoesPorNome(nomes: string[]): Promise<string[]> {
  const alvos = new Set(
    (nomes || [])
      .map((n) => String(n || '').trim().toLowerCase())
      .filter(Boolean),
  );
  if (alvos.size === 0) return [];
  const pag = await paginarSelect<{ id: string; nome: string | null }>(async (from, to) => {
    const r = await supabaseAdmin
      .from('gt_embarcacoes')
      .select('id, nome')
      .order('id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (pag.error) {
    console.error('[gt-fechamento-periodos] Erro ao carregar embarcacoes:', pag.error);
    return [];
  }
  const out: string[] = [];
  for (const row of pag.rows) {
    const nome = String(row.nome || '').trim().toLowerCase();
    if (nome && alvos.has(nome)) out.push(row.id);
  }
  return out;
}
