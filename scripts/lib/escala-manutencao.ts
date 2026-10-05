/**
 * Núcleo compartilhado dos scripts de manutenção da escala (GT).
 *
 * Por que existe: os scripts de limpeza (`limpa-sobrepostos`,
 * `dedupe-embarques-locais`) rodavam com leitura NÃO paginada — o PostgREST
 * deste projeto trunca em 1000 linhas (db-max-rows), então eles analisavam um
 * subconjunto arbitrário das ~2.900 linhas vivas e soft-deletavam em lote SEM
 * trilha em gt_escala_edicoes e SEM resincronizar as datas de
 * gt_colaboradores (o único escritor dessas colunas era o pull MIO, desligado
 * na v5.77.0). Resultado: escala "sumiu" da grade sem reversão possível e
 * colunas de último/próximo embarque congeladas.
 *
 * Tudo aqui reutiliza as funções puras do portal (`derivarDatasEscala`,
 * `resolverEmbarcacaoAtual`, `paginarSelect`) — a regra de derivação e a de
 * paginação NÃO são reimplementadas.
 */
import crypto from 'crypto';
import path from 'path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import {
  derivarDatasEscala,
  type EventoEscalaDatasLike,
} from '../../src/lib/gestao-tripulantes/embarques-datas';
import {
  resolverEmbarcacaoAtual,
  type EmbarcacaoCatalogo,
} from '../../src/lib/gestao-tripulantes/embarcacao-atual';
import { dataLocalISO } from '../../src/lib/gestao-tripulantes/validade-civil';
import { paginarSelect } from '../../src/lib/gestao-tripulantes/supabase-paginacao';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

export const SELECT_EVENTO =
  'id, colaborador_id, tipo, data_embarque, data_desembarque, data_prevista_desembarque, ' +
  'local_embarque, local_desembarque, observacoes, exibir_dia_inicio, origem, deleted_at, ' +
  'created_at, updated_at';

export interface EventoManutencao extends EventoEscalaDatasLike {
  id: string;
  colaborador_id: string;
  tipo: string | null;
  data_prevista_desembarque: string | null;
  local_embarque: string | null;
  local_desembarque: string | null;
  observacoes: string | null;
  exibir_dia_inicio: boolean | null;
  origem: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ColaboradorEscala {
  id: string;
  nome_completo: string;
  data_ultimo_embarque: string | null;
  data_ultimo_desembarque: string | null;
  data_proximo_embarque: string | null;
  embarcacao_atual_id: string | null;
}

export type TrilhaOperacao = 'create' | 'update' | 'delete' | 'restore';

export function criarClientSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase credentials (.env.local)');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Leitura paginada e determinística (ordem por id) — nunca trunca em 1000. */
export async function listarEventos(
  sb: SupabaseClient,
  filtro: { somenteVivos?: boolean; origem?: string } = {},
): Promise<EventoManutencao[]> {
  const { rows, error } = await paginarSelect<EventoManutencao>(async (from, to) => {
    let q = sb.from('gt_historico_embarques').select(SELECT_EVENTO).order('id');
    if (filtro.somenteVivos) q = q.is('deleted_at', null);
    if (filtro.origem) q = q.eq('origem', filtro.origem as string);
    const r = await q.range(from, to);
    return { data: r.data as EventoManutencao[] | null, error: r.error };
  });
  if (error) throw new Error(`gt_historico_embarques: ${error}`);
  return rows;
}

export async function listarColaboradoresEscala(sb: SupabaseClient): Promise<ColaboradorEscala[]> {
  const { rows, error } = await paginarSelect<ColaboradorEscala>(async (from, to) => {
    const r = await sb
      .from('gt_colaboradores')
      .select(
        'id, nome_completo, data_ultimo_embarque, data_ultimo_desembarque, data_proximo_embarque, embarcacao_atual_id',
      )
      .order('id')
      .range(from, to);
    return { data: r.data as ColaboradorEscala[] | null, error: r.error };
  });
  if (error) throw new Error(`gt_colaboradores: ${error}`);
  return rows;
}

export async function listarEmbarcacoes(sb: SupabaseClient): Promise<EmbarcacaoCatalogo[]> {
  const { data, error } = await sb.from('gt_embarcacoes').select('id, nome');
  if (error) throw new Error(`gt_embarcacoes: ${error.message}`);
  return (data || []) as EmbarcacaoCatalogo[];
}

const CAMPOS_DATA = [
  'data_ultimo_embarque',
  'data_ultimo_desembarque',
  'data_proximo_embarque',
] as const;

/**
 * Patch das colunas de escala que divergem do derivado dos eventos vivos, ou
 * null quando já estão em dia. Mesma regra de `embarques-datas-sync.ts`.
 */
export function diffDatasEscala(
  colaborador: ColaboradorEscala,
  eventos: EventoEscalaDatasLike[],
  embarcacoes: EmbarcacaoCatalogo[],
  hoje: string,
): Record<string, unknown> | null {
  const datas = derivarDatasEscala(eventos);
  const patch: Record<string, unknown> = {};
  for (const campo of CAMPOS_DATA) {
    if ((colaborador[campo] ?? null) !== (datas[campo] ?? null)) patch[campo] = datas[campo];
  }
  const acao = resolverEmbarcacaoAtual(eventos, embarcacoes, hoje);
  if (acao.acao === 'definir' && acao.embarcacaoId !== colaborador.embarcacao_atual_id) {
    patch.embarcacao_atual_id = acao.embarcacaoId;
  } else if (acao.acao === 'limpar' && colaborador.embarcacao_atual_id) {
    patch.embarcacao_atual_id = null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Recalcula data_ultimo_embarque / data_ultimo_desembarque / data_proximo_embarque
 * (e a embarcação atual) dos colaboradores informados. Com `aplicar=false` nada
 * é gravado — devolve só o que mudaria.
 */
export async function sincronizarDatasEscala(
  sb: SupabaseClient,
  colaboradorIds: string[],
  opcoes: { aplicar: boolean; embarcacoes: EmbarcacaoCatalogo[]; hoje?: string } ,
): Promise<{ colaborador: ColaboradorEscala; patch: Record<string, unknown> }[]> {
  const hoje = opcoes.hoje || dataLocalISO();
  const divergentes: { colaborador: ColaboradorEscala; patch: Record<string, unknown> }[] = [];
  const agora = new Date().toISOString();

  const CONCURRENCIA = 8;

  const sincronizarUm = async (id: string): Promise<{ colaborador: ColaboradorEscala; patch: Record<string, unknown> } | null> => {
    const { data: colab, error: colabErr } = await sb
      .from('gt_colaboradores')
      .select(
        'id, nome_completo, data_ultimo_embarque, data_ultimo_desembarque, data_proximo_embarque, embarcacao_atual_id',
      )
      .eq('id', id)
      .maybeSingle();
    if (colabErr) {
      console.error(`  sync: leitura de gt_colaboradores ${id}: ${colabErr.message}`);
      return null;
    }
    if (!colab) return null;

    const { data: eventos, error: evErr } = await sb
      .from('gt_historico_embarques')
      .select('tipo, data_embarque, data_desembarque, local_desembarque')
      .eq('colaborador_id', id)
      .is('deleted_at', null);
    if (evErr) {
      console.error(`  sync: leitura de eventos de ${id}: ${evErr.message}`);
      return null;
    }

    const patch = diffDatasEscala(
      colab as ColaboradorEscala,
      (eventos || []) as EventoEscalaDatasLike[],
      opcoes.embarcacoes,
      hoje,
    );
    if (!patch) return null;

    if (opcoes.aplicar) {
      const { error } = await sb
        .from('gt_colaboradores')
        .update({ ...patch, updated_at: agora })
        .eq('id', id);
      if (error) console.error(`  sync: gravação de ${id}: ${error.message}`);
    }
    return { colaborador: colab as ColaboradorEscala, patch };
  };

  for (let i = 0; i < colaboradorIds.length; i += CONCURRENCIA) {
    const resultados = await Promise.all(
      colaboradorIds.slice(i, i + CONCURRENCIA).map((id) => sincronizarUm(id)),
    );
    for (const r of resultados) if (r) divergentes.push(r);
  }

  return divergentes;
}

/** Mesma normalização de `snapshotEmbarque` (escala-audit-writer.ts). */
export function montarSnapshot(ev: EventoManutencao): Record<string, unknown> {
  return {
    id: ev.id,
    colaborador_id: ev.colaborador_id,
    tipo: ev.tipo,
    data_embarque: ev.data_embarque,
    data_desembarque: ev.data_desembarque,
    data_prevista_desembarque: ev.data_prevista_desembarque,
    local_embarque: ev.local_embarque,
    local_desembarque: ev.local_desembarque,
    observacoes: ev.observacoes,
    exibir_dia_inicio: ev.exibir_dia_inicio === null ? null : Boolean(ev.exibir_dia_inicio),
    origem: ev.origem,
    deleted_at: ev.deleted_at,
    updated_at: ev.updated_at,
  };
}

/** Mesmo hash de `montarHashEdicao` (escala-audit-writer.ts). */
export function montarHashEdicao(
  embarqueId: string,
  operacao: string,
  atorId: string | null,
  antes: unknown,
  depois: unknown,
): string {
  const base = [
    'GT_ESCALA_EDICAO',
    embarqueId,
    operacao,
    atorId || '-',
    JSON.stringify(antes ?? null),
    JSON.stringify(depois ?? null),
  ].join(':');
  return crypto.createHash('sha256').update(base).digest('hex');
}

export interface ItemTrilha {
  ev: EventoManutencao;
  operacao: TrilhaOperacao;
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
  motivo: string;
  atorNome: string;
}

/**
 * Grava a trilha de auditoria no MESMO formato do portal, para que o que um
 * script mexeu entre na Fila de Revisão e possa ser revertido por ela.
 * Best-effort por item: falhar a trilha nunca desfaz a operação já aplicada.
 */
export async function gravarTrilhas(
  sb: SupabaseClient,
  itens: ItemTrilha[],
  createdAt: string,
): Promise<number> {
  let gravadas = 0;
  for (const item of itens) {
    const { error } = await sb.from('gt_escala_edicoes').insert({
      embarque_id: item.ev.id,
      colaborador_id: item.ev.colaborador_id,
      operacao: item.operacao,
      status: 'aplicada',
      dados_anteriores: item.antes,
      dados_novos: item.depois,
      motivo: item.motivo,
      ator_nome: item.atorNome,
      ator_role: 'sistema',
      hash: montarHashEdicao(item.ev.id, item.operacao, null, item.antes, item.depois),
      created_at: createdAt,
    });
    if (error) console.error(`  trilha ${item.ev.id}: ${error.message}`);
    else gravadas += 1;
  }
  return gravadas;
}

/** Soft-delete em lotes (o PostgREST tem limite de tamanho de URL). */
export async function softDeletarLote(
  sb: SupabaseClient,
  ids: string[],
  now: string,
): Promise<number> {
  const LOTE = 100;
  let total = 0;
  for (let i = 0; i < ids.length; i += LOTE) {
    const { error } = await sb
      .from('gt_historico_embarques')
      .update({ deleted_at: now, updated_at: now })
      .in(
        'id',
        ids.slice(i, i + LOTE),
      );
    if (error) {
      console.error(`  soft-delete lote ${i}: ${error.message}`);
      continue;
    }
    total += Math.min(LOTE, ids.length - i);
  }
  return total;
}

/** Soft-delete → linha viva de volta, em lotes. */
export async function restaurarLote(
  sb: SupabaseClient,
  ids: string[],
  now: string,
): Promise<number> {
  const LOTE = 100;
  let total = 0;
  for (let i = 0; i < ids.length; i += LOTE) {
    const { error } = await sb
      .from('gt_historico_embarques')
      .update({ deleted_at: null, updated_at: now })
      .in(
        'id',
        ids.slice(i, i + LOTE),
      );
    if (error) {
      console.error(`  restore lote ${i}: ${error.message}`);
      continue;
    }
    total += Math.min(LOTE, ids.length - i);
  }
  return total;
}
