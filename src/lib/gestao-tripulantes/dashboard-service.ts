import { supabaseAdmin } from '@/lib/supabase';
import type { GTDashboardResumo } from '@/types/gestao-tripulantes';
import { adicionarDiasLocalISO, dataLocalISO } from '@/lib/gestao-tripulantes/aso-vencimentos';
import { listarDocumentosAlertas } from '@/lib/gestao-tripulantes/documentos-alertas';
import {
  afastamentoToEscalaEvento,
  aplicarStatusEscalaHoje,
  classifyScheduleDayCode,
  isEmbarcadoPobDayCode,
  resolverStatusEscalaHoje,
  type EscalaEventoDia,
  type StatusEmbarqueLive,
  type StatusEscalaHoje,
} from '@/lib/gestao-tripulantes/embarque-status';
import {
  somarDocsPorStatusPrimario,
  type DocumentoAgrupavel,
} from '@/lib/gestao-tripulantes/documento-historico';

const PAGE_SIZE = 1000;
const DOC_IN_CHUNK = 120;
const COLAB_ID_IN_LIMIT = 120;

interface ColabAtivoRow {
  id: string;
  centro_custo_id: string | null;
}

/** Ativo + não deletado; CC inativo exclui; CC nulo entra. */
export async function listarColaboradoresDashboardAtivos(): Promise<{
  ids: string[];
  total: number;
  error?: string;
}> {
  const colabs: ColabAtivoRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('id, centro_custo_id')
      .is('deleted_at', null)
      .eq('ativo', true)
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      return { ids: [], total: 0, error: error.message };
    }
    const page = (data || []) as ColabAtivoRow[];
    colabs.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const inactiveCc = await supabaseAdmin.from('gt_centros_custo').select('id').eq('ativo', false);
  if (inactiveCc.error) {
    return { ids: [], total: 0, error: inactiveCc.error.message };
  }

  const inactiveCcIds = new Set((inactiveCc.data || []).map((r) => r.id as string));
  const ativos = colabs.filter(
    (c) => !c.centro_custo_id || !inactiveCcIds.has(c.centro_custo_id),
  );

  return {
    ids: ativos.map((c) => c.id),
    total: ativos.length,
  };
}

async function paginarSelect<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error?: string }> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows };
}

export interface ListarStatusEscalaHojeOptions {
  colaboradorIds?: string[];
  fallbackById?: Map<string, string | null>;
}

function shouldFilterEventsByColabId(ids: string[] | undefined): ids is string[] {
  return Boolean(ids && ids.length > 0 && ids.length <= COLAB_ID_IN_LIMIT);
}

/**
 * Today's Man Schedule cell (+ afastamentos overlay) per collaborator.
 * When `colaboradorIds` is omitted, only people with a non-empty cell are returned
 * (so stored `status_embarque` can still apply to everyone else).
 */
export async function listarStatusEscalaHoje(
  hoje = dataLocalISO(),
  options: ListarStatusEscalaHojeOptions = {},
): Promise<{
  byId: Map<string, StatusEscalaHoje>;
  error?: string;
}> {
  const scopedIds = options.colaboradorIds;
  const eligible = scopedIds ? new Set(scopedIds) : null;
  if (eligible && eligible.size === 0) return { byId: new Map() };

  const filterById = shouldFilterEventsByColabId(scopedIds);
  const idList = filterById ? scopedIds : undefined;

  const [embRes, afRes] = await Promise.all([
    paginarSelect<{
      id: string;
      colaborador_id: string;
      tipo: string | null;
      data_embarque: string | null;
      data_desembarque: string | null;
      data_prevista_desembarque: string | null;
      observacoes: string | null;
    }>(async (from, to) => {
      let q = supabaseAdmin
        .from('gt_historico_embarques')
        .select('id, colaborador_id, tipo, data_embarque, data_desembarque, data_prevista_desembarque, observacoes')
        .is('deleted_at', null)
        .lte('data_embarque', hoje);
      if (idList) q = q.in('colaborador_id', idList);
      const r = await q.range(from, to);
      return {
        data: (Array.isArray(r.data) ? r.data : null) as {
          id: string;
          colaborador_id: string;
          tipo: string | null;
          data_embarque: string | null;
          data_desembarque: string | null;
          data_prevista_desembarque: string | null;
          observacoes: string | null;
        }[] | null,
        error: r.error,
      };
    }),
    paginarSelect<{
      id: string;
      colaborador_id: string;
      tipo_afastamento: string | null;
      data_inicio: string | null;
      data_fim: string | null;
      data_prevista_retorno: string | null;
      motivo: string | null;
    }>(async (from, to) => {
      let q = supabaseAdmin
        .from('gt_afastamentos')
        .select('id, colaborador_id, tipo_afastamento, data_inicio, data_fim, data_prevista_retorno, motivo')
        .is('deleted_at', null);
      if (idList) q = q.in('colaborador_id', idList);
      const r = await q.range(from, to);
      return {
        data: (Array.isArray(r.data) ? r.data : null) as {
          id: string;
          colaborador_id: string;
          tipo_afastamento: string | null;
          data_inicio: string | null;
          data_fim: string | null;
          data_prevista_retorno: string | null;
          motivo: string | null;
        }[] | null,
        error: r.error,
      };
    }),
  ]);

  if (embRes.error) return { byId: new Map(), error: embRes.error };
  if (afRes.error) return { byId: new Map(), error: afRes.error };

  const byColab = new Map<string, EscalaEventoDia[]>();
  const push = (colabId: string, ev: EscalaEventoDia) => {
    if (eligible && !eligible.has(colabId)) return;
    const arr = byColab.get(colabId) || [];
    arr.push(ev);
    byColab.set(colabId, arr);
  };

  for (const row of embRes.rows) {
    push(row.colaborador_id, {
      id: row.id,
      tipo: row.tipo,
      data_embarque: row.data_embarque,
      data_desembarque: row.data_desembarque,
      data_prevista_desembarque: row.data_prevista_desembarque,
      observacoes: row.observacoes,
    });
  }

  for (const af of afRes.rows) {
    push(af.colaborador_id, afastamentoToEscalaEvento(af));
  }

  const byId = new Map<string, StatusEscalaHoje>();
  const considerIds = eligible ? [...eligible] : [...byColab.keys()];
  for (const colabId of considerIds) {
    const events = byColab.get(colabId) || [];
    const resolved = resolverStatusEscalaHoje(events, hoje, options.fallbackById?.get(colabId) ?? null);
    if (!eligible && !options.fallbackById?.has(colabId)) {
      const kind = classifyScheduleDayCode(resolved.dayCode);
      if (kind === 'vazio' || kind === 'previsto' || kind === 'outro') continue;
    }
    byId.set(colabId, resolved);
  }
  return { byId };
}

/**
 * Eligible collaborators whose Man Schedule cell for today is exact `ON`
 * (never `ON*` / `*` / STB / DBA / UTR / DHC).
 */
export async function listarIdsEmbarcadosHoje(
  hoje = dataLocalISO(),
  eligibleIds?: string[],
): Promise<{
  ids: string[];
  error?: string;
}> {
  let eligibleList = eligibleIds;
  if (!eligibleList) {
    const ativos = await listarColaboradoresDashboardAtivos();
    if (ativos.error) return { ids: [], error: ativos.error };
    eligibleList = ativos.ids;
  }
  if (eligibleList.length === 0) return { ids: [] };

  const live = await listarStatusEscalaHoje(hoje, { colaboradorIds: eligibleList });
  if (live.error) return { ids: [], error: live.error };
  const ids = [...live.byId.entries()]
    .filter(([, v]) => isEmbarcadoPobDayCode(v.dayCode))
    .map(([id]) => id);
  return { ids };
}

export async function listarIdsStandbyHoje(
  hoje = dataLocalISO(),
  eligibleIds?: string[],
): Promise<{ ids: string[]; error?: string }> {
  let eligibleList = eligibleIds;
  if (!eligibleList) {
    const ativos = await listarColaboradoresDashboardAtivos();
    if (ativos.error) return { ids: [], error: ativos.error };
    eligibleList = ativos.ids;
  }
  if (eligibleList.length === 0) return { ids: [] };

  const live = await listarStatusEscalaHoje(hoje, { colaboradorIds: eligibleList });
  if (live.error) return { ids: [], error: live.error };
  const ids = [...live.byId.entries()]
    .filter(([, v]) => v.status === 'standby')
    .map(([id]) => id);
  return { ids };
}

export async function listarIdsComStatusEscalaHoje(
  status: StatusEmbarqueLive,
  hoje = dataLocalISO(),
): Promise<{ ids: string[]; error?: string }> {
  const live = await listarStatusEscalaHoje(hoje);
  if (live.error) return { ids: [], error: live.error };

  const liveMatch: string[] = [];
  const classified = new Set<string>();
  for (const [id, v] of live.byId) {
    classified.add(id);
    if (v.status === status) liveMatch.push(id);
  }

  const stored: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('id')
      .is('deleted_at', null)
      .eq('status_embarque', status)
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { ids: [], error: error.message };
    const page = data || [];
    for (const row of page) {
      if (!classified.has(row.id as string)) stored.push(row.id as string);
    }
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { ids: [...liveMatch, ...stored] };
}

export async function overlayStatusEscalaHoje<T extends { id: string }>(
  rows: T[],
  hoje = dataLocalISO(),
): Promise<{
  rows: Array<T & { status_embarque: StatusEmbarqueLive; standby: boolean; escala_codigo_hoje: string }>;
  error?: string;
}> {
  if (rows.length === 0) return { rows: [] };
  const fallbackById = new Map<string, string | null>();
  for (const row of rows) {
    const stored = (row as { status_embarque?: string | null }).status_embarque;
    fallbackById.set(row.id, stored ?? null);
  }
  const live = await listarStatusEscalaHoje(hoje, {
    colaboradorIds: rows.map((r) => r.id),
    fallbackById,
  });
  if (live.error) return { rows: aplicarStatusEscalaHoje(rows, new Map()), error: live.error };
  return { rows: aplicarStatusEscalaHoje(rows, live.byId) };
}

const DOC_GROUP_SELECT =
  'id, colaborador_id, tipo_documento, subtipo, titulo, descricao, origem, data_emissao, data_validade, status_validacao, created_at';

/** Primary-only vencido/vencendo (obsolete siblings of a valid course do not count). */
async function countDocsPorValidadeCivil(
  colaboradorIds: string[],
  hoje: string,
  _limite: string,
): Promise<{ vencidos: number; vencendo: number; error?: string }> {
  void _limite;
  if (colaboradorIds.length === 0) return { vencidos: 0, vencendo: 0 };

  const docs: DocumentoAgrupavel[] = [];
  for (let i = 0; i < colaboradorIds.length; i += DOC_IN_CHUNK) {
    const part = colaboradorIds.slice(i, i + DOC_IN_CHUNK);
    let from = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('gt_documentos')
        .select(DOC_GROUP_SELECT)
        .in('colaborador_id', part)
        .is('deleted_at', null)
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { vencidos: 0, vencendo: 0, error: error.message };
      const page = (data || []) as DocumentoAgrupavel[];
      docs.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  const summed = somarDocsPorStatusPrimario(docs, hoje);
  return { vencidos: summed.vencidos, vencendo: summed.vencendo };
}

export async function getDashboardData(): Promise<{
  success: boolean;
  data?: GTDashboardResumo;
  error?: string;
}> {
  try {
    const ativos = await listarColaboradoresDashboardAtivos();
    if (ativos.error) {
      console.error('Erro ao buscar colaboradores do dashboard:', ativos.error);
      return { success: false, error: ativos.error };
    }

    const hoje = dataLocalISO();
    const limite = adicionarDiasLocalISO(30);
    const [docs, asosPendentes, live, alertas] = await Promise.all([
      countDocsPorValidadeCivil(ativos.ids, hoje, limite),
      supabaseAdmin
        .from('gt_documentos')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('status_revisao', 'pendente_revisao'),
      listarStatusEscalaHoje(hoje, { colaboradorIds: ativos.ids }),
      listarDocumentosAlertas({ colaboradorIds: ativos.ids }),
    ]);

    if (docs.error) {
      console.error('Erro ao contar documentos do dashboard:', docs.error);
      return { success: false, error: docs.error };
    }
    if (asosPendentes.error) {
      console.error('Erro ao contar ASOs pendentes:', asosPendentes.error);
      return { success: false, error: asosPendentes.error.message };
    }
    if (live.error) {
      console.error('Erro ao contar embarcados (POB) do dashboard:', live.error);
      return { success: false, error: live.error };
    }

    let totalEmbarcados = 0;
    let totalDisponiveis = 0;
    for (const v of live.byId.values()) {
      if (isEmbarcadoPobDayCode(v.dayCode)) totalEmbarcados += 1;
      if (v.status === 'standby') totalDisponiveis += 1;
    }

    return {
      success: true,
      data: {
        total_colaboradores: ativos.total,
        total_embarcados: totalEmbarcados,
        total_disponiveis: totalDisponiveis,
        total_docs_vencidos: docs.vencidos,
        total_docs_vencendo: docs.vencendo,
        total_docs_vencidos_historico: alertas.totais.vencidos_historico,
        asos_pendentes_revisao: asosPendentes.count || 0,
      },
    };
  } catch (error) {
    console.error('Erro inesperado no dashboard-service:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
