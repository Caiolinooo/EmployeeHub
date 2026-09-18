/**
 * GT v2 — trilha de auditoria da escala (gt_escala_edicoes) + rollback.
 *
 * Contrato (R7 "tudo imediato + fila de revisão"):
 * - Toda escrita em gt_historico_embarques (POST/PUT/DELETE /embarques) aplica
 *   NA HORA (comportamento atual preservado) e grava uma linha de auditoria
 *   com before/after image. A gravação da auditoria é BEST-EFFORT: nunca
 *   falha o save do operador.
 * - Aprovores revisam a fila e podem REJEITAR (rollback automático) ou
 *   REVERTER manualmente qualquer edição aplicada.
 *
 * Tabela gt_escala_edicoes: RLS ligado, ZERO policies (apenas service_role /
 * supabaseAdmin). Migration: supabase/migrations/20260916_000001_gt_fechamento_v2.sql
 */

import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { TokenPayload } from '@/lib/auth';
import { resolveAuthUserId } from '@/lib/gestao-tripulantes/aso-agendamento-auth';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import { invalidateManScheduleCache } from '@/lib/gestao-tripulantes/man-schedule-cache';
import { sincronizarDatasEscalaColaborador } from '@/lib/gestao-tripulantes/embarques-datas-sync';
import {
  computarRecorte,
  type FlagsRecorte,
  type FragmentoRecorte,
  type RecorteAcao,
  type ResultadoRecorte,
} from '@/lib/gestao-tripulantes/escala-recorte';

export const ESCALA_EDICAO_OPERACOES = [
  'create',
  'update',
  'delete',
  'restore',
  'rejeicao',
  'reversao',
] as const;

export type EscalaEdicaoOperacao = (typeof ESCALA_EDICAO_OPERACOES)[number];

export const ESCALA_EDICAO_STATUS = ['aplicada', 'revertida', 'rejeitada'] as const;

export type EscalaEdicaoStatus = (typeof ESCALA_EDICAO_STATUS)[number];

export interface EscalaEdicaoAtor {
  id?: string | null;
  nome?: string | null;
  cpf?: string | null;
  role?: string | null;
  ip?: string | null;
}

/** Campos vigiados de gt_historico_embarques (before/after image). */
export interface EmbarqueSnapshot {
  id?: string | null;
  colaborador_id?: string | null;
  tipo?: string | null;
  data_embarque?: string | null;
  data_desembarque?: string | null;
  data_prevista_desembarque?: string | null;
  local_embarque?: string | null;
  local_desembarque?: string | null;
  observacoes?: string | null;
  exibir_dia_inicio?: boolean | null;
  origem?: string | null;
  deleted_at?: string | null;
  updated_at?: string | null;
}

export type EmbarqueRow = Record<string, unknown> & { id?: string };

export interface EscalaEdicaoRow {
  id: string;
  embarque_id: string | null;
  colaborador_id: string | null;
  operacao: EscalaEdicaoOperacao;
  status: EscalaEdicaoStatus;
  dados_anteriores: EmbarqueSnapshot | Record<string, unknown> | null;
  dados_novos: EmbarqueSnapshot | Record<string, unknown> | null;
  motivo: string | null;
  ator_id: string | null;
  ator_nome: string | null;
  ator_cpf: string | null;
  ator_role: string | null;
  ip: string | null;
  revisada_por_id: string | null;
  revisada_por_nome: string | null;
  revisada_em: string | null;
  created_at: string | null;
  [key: string]: unknown;
}

const SELECT_EMBARQUE_SNAPSHOT =
  'id, colaborador_id, tipo, data_embarque, data_desembarque, data_prevista_desembarque, ' +
  'local_embarque, local_desembarque, observacoes, exibir_dia_inicio, origem, deleted_at, updated_at';

/** Campos que o rollback de um 'update' restaura na linha do embarque. */
const CAMPOS_RESTORE: Array<keyof EmbarqueSnapshot> = [
  'tipo',
  'data_embarque',
  'data_desembarque',
  'data_prevista_desembarque',
  'local_embarque',
  'local_desembarque',
  'observacoes',
  'exibir_dia_inicio',
  'origem',
];

export function snapshotEmbarque(row: EmbarqueRow | null | undefined): EmbarqueSnapshot | null {
  if (!row) return null;
  return {
    id: (row.id as string) ?? null,
    colaborador_id: (row.colaborador_id as string) ?? null,
    tipo: (row.tipo as string) ?? null,
    data_embarque: (row.data_embarque as string) ?? null,
    data_desembarque: (row.data_desembarque as string) ?? null,
    data_prevista_desembarque: (row.data_prevista_desembarque as string) ?? null,
    local_embarque: (row.local_embarque as string) ?? null,
    local_desembarque: (row.local_desembarque as string) ?? null,
    observacoes: (row.observacoes as string) ?? null,
    exibir_dia_inicio:
      row.exibir_dia_inicio === undefined || row.exibir_dia_inicio === null
        ? null
        : Boolean(row.exibir_dia_inicio),
    origem: (row.origem as string) ?? null,
    deleted_at: (row.deleted_at as string) ?? null,
    updated_at: (row.updated_at as string) ?? null,
  };
}

/**
 * Ator da auditoria: payload do JWT verificado + IP (x-forwarded-for /
 * x-real-ip). Nome/CPF vêm de users_unified (first_name+last_name / tax_id —
 * nunca `full_name`/`cpf`, que não existem nessa tabela).
 */
export async function carregarAtorEscala(
  payload: TokenPayload,
  request: NextRequest,
): Promise<EscalaEdicaoAtor> {
  const userId = resolveAuthUserId(payload);
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const ator: EscalaEdicaoAtor = { id: userId || null, role: payload.role || null, ip };
  if (!userId) return ator;
  try {
    const { data } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, name, tax_id, role')
      .eq('id', userId)
      .maybeSingle();
    const row = (data || {}) as {
      first_name?: string | null;
      last_name?: string | null;
      name?: string | null;
      tax_id?: string | null;
      role?: string | null;
    };
    const composto = `${row.first_name || ''} ${row.last_name || ''}`.trim();
    ator.nome = composto || (row.name || '').trim() || payload.email || null;
    ator.cpf = row.tax_id || null;
    ator.role = row.role || ator.role;
  } catch (err) {
    console.error('[escala-audit] falha ao carregar ator (best-effort):', err);
  }
  return ator;
}

/** Linha do embarque por id — inclusive soft-deleted (para rollback). */
export async function buscarEmbarquePorId(
  id: string,
): Promise<EmbarqueRow | null> {
  const { data } = await supabaseAdmin
    .from('gt_historico_embarques')
    .select(SELECT_EMBARQUE_SNAPSHOT)
    .eq('id', id)
    .maybeSingle();
  return (data as unknown as EmbarqueRow) || null;
}

/**
 * Linhas vivas do mesmo colaborador que sobrepõem o período (inclui abertas,
 * data_desembarque NULL). Paginado + ordem determinística (PostgREST trunca
 * em 1000 linhas — db-max-rows).
 */
export async function buscarSobrepostos(
  colaboradorId: string,
  ini: string,
  fim: string,
  excluirId?: string,
): Promise<EmbarqueRow[]> {
  const res = await paginarSelect<EmbarqueRow>(async (from, to) => {
    // Builder reconstruído por página (idioma do repositório) com ordem
    // determinística: created_at desc, id desempata.
    let query = supabaseAdmin
      .from('gt_historico_embarques')
      .select(SELECT_EMBARQUE_SNAPSHOT)
      .eq('colaborador_id', colaboradorId)
      .is('deleted_at', null)
      .lte('data_embarque', fim)
      .or(`data_desembarque.is.null,data_desembarque.gte.${ini}`)
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });
    if (excluirId) query = query.neq('id', excluirId);
    const r = await query.range(from, to);
    return { data: (r.data ?? null) as unknown as EmbarqueRow[] | null, error: r.error };
  });
  if (res.error) console.error('[escala-audit] erro ao buscar sobrepostos:', res.error);
  return res.rows;
}

function montarHashEdicao(input: {
  embarqueId?: string | null;
  operacao: EscalaEdicaoOperacao;
  atorId?: string | null;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
}): string {
  const base = [
    'GT_ESCALA_EDICAO',
    input.embarqueId || '-',
    input.operacao,
    input.atorId || '-',
    JSON.stringify(input.dadosAnteriores ?? null),
    JSON.stringify(input.dadosNovos ?? null),
  ].join(':');
  return crypto.createHash('sha256').update(base).digest('hex');
}

export interface RegistrarEdicaoInput {
  embarqueId?: string | null;
  colaboradorId?: string | null;
  operacao: EscalaEdicaoOperacao;
  status?: EscalaEdicaoStatus;
  dadosAnteriores?: EmbarqueSnapshot | Record<string, unknown> | null;
  dadosNovos?: EmbarqueSnapshot | Record<string, unknown> | null;
  motivo?: string | null;
  ator?: EscalaEdicaoAtor | null;
}

/**
 * Grava UMA linha em gt_escala_edicoes e devolve o ID inserido (null se a
 * auditoria falhou). BEST-EFFORT: erro é logado e engolido — o save do
 * operador nunca falha por causa da auditoria. Chamadores antigos que tratavam
 * o retorno como boolean continuam válidos: um id truthy é sucesso.
 */
export async function registrarEdicaoEscala(input: RegistrarEdicaoInput): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('gt_escala_edicoes')
      .insert({
        embarque_id: input.embarqueId || null,
        colaborador_id: input.colaboradorId || null,
        operacao: input.operacao,
        status: input.status || 'aplicada',
        dados_anteriores: input.dadosAnteriores ?? null,
        dados_novos: input.dadosNovos ?? null,
        motivo: input.motivo || null,
        ator_id: input.ator?.id || null,
        ator_nome: input.ator?.nome || null,
        ator_cpf: input.ator?.cpf || null,
        ator_role: input.ator?.role || null,
        ip: input.ator?.ip || null,
        hash: montarHashEdicao({
          embarqueId: input.embarqueId,
          operacao: input.operacao,
          atorId: input.ator?.id,
          dadosAnteriores: input.dadosAnteriores,
          dadosNovos: input.dadosNovos,
        }),
        created_at: now,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[escala-audit] falha ao gravar auditoria (best-effort):', error.message);
      return null;
    }
    return (data as { id?: string } | null)?.id || null;
  } catch (err) {
    console.error('[escala-audit] exceção ao gravar auditoria (best-effort):', err);
    return null;
  }
}

/**
 * Lote best-effort: grava todas as linhas EM ORDEM (sequencial — a resposta das
 * rotas devolve os ids na ordem de gravação) e retorna os ids inseridos.
 * Falha de item individual é logada e pulada; nunca lança.
 */
export async function registrarEdicoesEscala(itens: RegistrarEdicaoInput[]): Promise<string[]> {
  const ids: string[] = [];
  for (const item of itens) {
    try {
      const id = await registrarEdicaoEscala(item);
      if (id) ids.push(id);
    } catch (err) {
      console.error('[escala-audit] lote: item falhou (best-effort):', err);
    }
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/* Recorte de marcações (v5.80) — execução dos efeitos computados por  */
/* escala-recorte.ts sobre gt_historico_embarques + trilha por efeito. */
/* ------------------------------------------------------------------ */

export interface EfeitoRecorteExecutado {
  /** Linha original analisada. */
  row: EmbarqueRow;
  acao: RecorteAcao;
  /** Auditorias gravadas por ESTE efeito (ordem de gravação). */
  edicoes: string[];
  /** Fragmentos criados (somente acao 'dividir'), já com id do banco. */
  fragmentos: EmbarqueRow[];
  /** true se algo foi gravado na linha original (update/soft-delete). */
  afetado: boolean;
}

const MOTIVO_RECORTE_HEAD =
  'Recorte: ponta anterior preservada (substituição por evento sobreposto)';
const MOTIVO_RECORTE_TAIL =
  'Recorte: ponta posterior preservada (substituição por evento sobreposto)';
const MOTIVO_FRAGMENTO_RECORTE = 'Fragmento gerado por recorte/exclusão parcial';

/** Motivos de delete/fragmento configuráveis pelas rotas (POST/PUT/DELETE). */
export interface MotivosRecorte {
  delete?: string;
  fragmento?: string;
}

async function softDeletarEmbarque(
  id: string,
  now: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('gt_historico_embarques')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id);
  return { ok: !error, error: error?.message };
}

/**
 * Compensação do recorte 'dividir' que falhou no meio: soft-delete dos
 * fragmentos já criados para não sobrar ponta órfã sobre a original
 * preservada (nunca deixar original + fragmento vivos sobrepostos). Só é
 * chamada com a original INTATA — falha aqui é best-effort e logada com o id
 * para limpeza manual.
 */
async function compensarFragmentosParciais(
  linhas: EmbarqueRow[],
  now: string,
): Promise<void> {
  for (const linha of linhas) {
    if (!linha?.id) continue;
    const { error } = await supabaseAdmin
      .from('gt_historico_embarques')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', String(linha.id));
    if (error) {
      console.error(
        '[escala-audit] COMPENSAÇÃO FALHOU — fragmento do recorte segue VIVO (limpar manualmente):',
        String(linha.id),
        error.message,
      );
    }
  }
}

/**
 * Trilha explícita de recorte 'dividir' NÃO aplicado (best-effort). Sem ela a
 * fila de revisão não distingue "nada a fazer" de "tentativa falhou e foi
 * compensada" — e a original segue VIVA sob o evento recém-salvo. Grava
 * operacao 'update' com before==after (a original não mudou): reverter esta
 * linha é no-op seguro, e 'update' cabe no CHECK de operacao da tabela
 * (create/update/delete/restore/rejeicao/reversao). Nenhum 'delete'/'create'
 * dos pedaços é gravado — o efeito não aconteceu.
 */
async function registrarFalhaRecorte(input: {
  embarqueId: string;
  colaboradorId: string | null;
  antes: EmbarqueSnapshot | null;
  motivo: string;
  detalhe: string;
  janela: string;
  ator: EscalaEdicaoAtor;
}): Promise<void> {
  const imutavel = input.antes ? { ...input.antes } : null;
  await registrarEdicaoEscala({
    embarqueId: input.embarqueId,
    colaboradorId: input.colaboradorId,
    operacao: 'update',
    status: 'aplicada',
    dadosAnteriores: imutavel,
    dadosNovos: imutavel,
    motivo:
      `RECORTE NÃO APLICADO (${input.detalhe}) — janela do recorte: ${input.janela}; ` +
      `original preservada intacta, nenhum fragmento deixado vivo. Pedido original: ${input.motivo}`,
    ator: input.ator,
  });
}

/**
 * INSERT de um fragmento de recorte — cópia de tipo/local_embarque/
 * local_desembarque/observacoes/exibir_dia_inicio da linha original,
 * origem='local'. Fragmento ABERTO (fim null — tail de linha a bordo
 * recortada) recebe também `data_prevista_desembarque` da original: sem
 * data_desembarque E sem prevista o fragmento sai do automático do
 * fechamento e gera alerta (regra do módulo: "Sempre data_embarque +
 * data_desembarque (ou prevista)"; AGENTS.md — NxN). Head/tail fechados têm
 * fim real e não precisam da prevista. Mesmo fallback de colunas novas do
 * POST (ambiente sem exibir_dia_inicio/updated_at). Retorna a linha com id
 * (para a trilha 'create' com dados_novos) ou null em falha (best-effort).
 */
async function inserirFragmentoRecorte(
  base: EmbarqueRow,
  frag: FragmentoRecorte,
  ctx: { colaboradorId: string | null; now: string },
): Promise<EmbarqueRow | null> {
  const row: Record<string, unknown> = {
    colaborador_id: ctx.colaboradorId || (base.colaborador_id as string) || null,
    tipo: base.tipo ?? 'normal',
    data_embarque: frag.inicio,
    data_desembarque: frag.fim,
    local_embarque: (base.local_embarque as string) || '',
    local_desembarque: (base.local_desembarque as string) || '',
    observacoes: (base.observacoes as string) || '',
    exibir_dia_inicio: base.exibir_dia_inicio !== false,
    origem: 'local',
    created_at: ctx.now,
    updated_at: ctx.now,
  };
  if (frag.fim === null) {
    row.data_prevista_desembarque = (base.data_prevista_desembarque as string) || null;
  }
  let ins = await supabaseAdmin.from('gt_historico_embarques').insert(row).select('*').single();
  if (ins.error && /exibir_dia_inicio|updated_at/i.test(ins.error.message || '')) {
    const retry = { ...row };
    if (/exibir_dia_inicio/i.test(ins.error.message || '')) delete retry.exibir_dia_inicio;
    if (/updated_at/i.test(ins.error.message || '')) delete retry.updated_at;
    ins = await supabaseAdmin.from('gt_historico_embarques').insert(retry).select('*').single();
  }
  if (ins.error) {
    console.error('[escala-audit] falha ao inserir fragmento do recorte:', ins.error.message);
    return null;
  }
  return (ins.data as EmbarqueRow) || null;
}

/**
 * Aplica o recorte computado por `computarRecorte` (escala-recorte.ts) a UMA
 * linha sobreposta e grava a trilha de auditoria POR EFEITO (best-effort —
 * nunca falha o save do operador):
 * - 'nada'            → nada é gravado (linha não sobreposta — defensivo);
 * - 'apagar'          → soft-delete da linha + auditoria 'delete';
 * - 'encurtar_fim'    → UPDATE data_desembarque + auditoria 'update' (head preservado);
 * - 'encurtar_inicio' → UPDATE data_embarque + auditoria 'update' (tail preservado);
 * - 'dividir'         → CREATE dos 2 fragmentos (head/tail) + soft-delete da
 *   original + auditoria 'delete' e 'create' cada. TUDO-OU-NADA: os
 *   fragmentos vêm ANTES do soft-delete e qualquer falha compensa o que já
 *   foi criado, deixa a original intacta (afetado=false, sem trilha dos
 *   pedaços) e grava uma linha 'update' de recorte NÃO aplicado na trilha.
 *
 * Usado por POST/PUT /embarques (substituição same-type com flags) e por
 * DELETE /embarques/[id] modo 'periodo' (flags {false,false}).
 */
export async function aplicarRecorteEmSobreposto(input: {
  row: EmbarqueRow;
  periodo: { inicio: string; fim: string };
  apagarAnteriores?: boolean;
  apagarPosteriores?: boolean;
  ator: EscalaEdicaoAtor;
  colaboradorId: string | null;
  now: string;
  motivos?: MotivosRecorte;
}): Promise<EfeitoRecorteExecutado> {
  const { row, periodo, ator, colaboradorId, now } = input;
  const flags: FlagsRecorte = {
    apagarAnteriores: input.apagarAnteriores === true,
    apagarPosteriores: input.apagarPosteriores === true,
  };
  const motivos: MotivosRecorte = input.motivos || {};
  const resultado: EfeitoRecorteExecutado = {
    row,
    acao: 'nada',
    edicoes: [],
    fragmentos: [],
    afetado: false,
  };
  if (!row?.id) return resultado;

  const recorte: ResultadoRecorte = computarRecorte(
    {
      data_embarque: String(row.data_embarque ?? ''),
      data_desembarque: row.data_desembarque == null ? null : String(row.data_desembarque),
    },
    periodo,
    flags,
  );
  resultado.acao = recorte.acao;
  if (recorte.acao === 'nada') return resultado;
  const embarqueId = String(row.id);
  const antes = snapshotEmbarque(row);

  try {
    if (recorte.acao === 'apagar') {
      const del = await softDeletarEmbarque(embarqueId, now);
      if (!del.ok) {
        console.error('[escala-audit] falha ao soft-deletar no recorte:', del.error);
        return resultado;
      }
      resultado.afetado = true;
      const id = await registrarEdicaoEscala({
        embarqueId,
        colaboradorId: colaboradorId || (row.colaborador_id as string) || null,
        operacao: 'delete',
        status: 'aplicada',
        dadosAnteriores: antes,
        dadosNovos: { ...(antes || {}), deleted_at: now },
        motivo: motivos.delete || 'Substituído pelo evento salvo (overlap-replace)',
        ator,
      });
      if (id) resultado.edicoes.push(id);
      return resultado;
    }

    if (recorte.acao === 'encurtar_fim' || recorte.acao === 'encurtar_inicio') {
      const updates: Record<string, unknown> = { updated_at: now };
      if (recorte.acao === 'encurtar_fim') updates.data_desembarque = recorte.novaDataDesembarque;
      else updates.data_embarque = recorte.novaDataEmbarque;
      const { error } = await supabaseAdmin
        .from('gt_historico_embarques')
        .update(updates)
        .eq('id', embarqueId);
      if (error) {
        console.error('[escala-audit] falha ao encurtar embarque no recorte:', error.message);
        return resultado;
      }
      resultado.afetado = true;
      const depois = { ...(antes || {}) };
      if (recorte.acao === 'encurtar_fim') depois.data_desembarque = recorte.novaDataDesembarque;
      else depois.data_embarque = recorte.novaDataEmbarque;
      const id = await registrarEdicaoEscala({
        embarqueId,
        colaboradorId: colaboradorId || (row.colaborador_id as string) || null,
        operacao: 'update',
        status: 'aplicada',
        dadosAnteriores: antes,
        dadosNovos: { ...depois, updated_at: now },
        motivo:
          recorte.acao === 'encurtar_fim'
            ? MOTIVO_RECORTE_HEAD
            : MOTIVO_RECORTE_TAIL,
        ator,
      });
      if (id) resultado.edicoes.push(id);
      return resultado;
    }

    // 'dividir': TUDO-OU-NADA. Os fragmentos (head/tail) são inseridos ANTES
    // do soft-delete da original: se qualquer passo falhar, a original NUNCA
    // chega a ser apagada e os fragmentos já criados são soft-deletados.
    // Apagar a original primeiro e seguir com só uma ponta viva apagaria
    // silenciosamente um pedaço do ciclo do operador, com trilha idêntica à de
    // um recorte legítimo. A ORDEM DA TRILHA continua delete → creates (o
    // rollback LIFO reverte os creates primeiro; só então o delete da original
    // passa a guarda de sobreposição).
    const ctx = { colaboradorId, now };
    const criados: Array<{ frag: FragmentoRecorte; linha: EmbarqueRow }> = [];
    let detalheFalha = '';
    for (const frag of recorte.fragmentos) {
      const linha = await inserirFragmentoRecorte(row, frag, ctx);
      if (!linha) {
        detalheFalha = `falha ao inserir o fragmento ${frag.papel} [${frag.inicio}..${frag.fim || 'aberto'}]`;
        break;
      }
      criados.push({ frag, linha });
    }
    if (!detalheFalha) {
      const del = await softDeletarEmbarque(embarqueId, now);
      if (!del.ok) {
        detalheFalha = 'falha ao soft-deletar a original após criar os fragmentos';
        console.error('[escala-audit] falha ao soft-deletar original no recorte (dividir):', del.error);
      }
    }
    if (detalheFalha) {
      // Nada é aplicado: original permanece viva; fragmentos parciais removidos;
      // trilha registra a tentativa falhada (nunca delete/create dos pedaços).
      await compensarFragmentosParciais(criados.map((c) => c.linha), now);
      await registrarFalhaRecorte({
        embarqueId,
        colaboradorId: colaboradorId || (row.colaborador_id as string) || null,
        antes,
        motivo: motivos.delete || 'Substituído pelo evento salvo (overlap-replace)',
        detalhe: detalheFalha,
        janela: recorte.fragmentos.map((f) => `[${f.inicio}..${f.fim || 'aberto'}]`).join(' + '),
        ator,
      });
      return resultado;
    }
    resultado.afetado = true;
    resultado.fragmentos.push(...criados.map((c) => c.linha));
    const idDelete = await registrarEdicaoEscala({
      embarqueId,
      colaboradorId: colaboradorId || (row.colaborador_id as string) || null,
      operacao: 'delete',
      status: 'aplicada',
      dadosAnteriores: antes,
      dadosNovos: { ...(antes || {}), deleted_at: now },
      motivo: motivos.delete || 'Substituído pelo evento salvo (overlap-replace)',
      ator,
    });
    if (idDelete) resultado.edicoes.push(idDelete);
    for (const { frag, linha } of criados) {
      const idFrag = await registrarEdicaoEscala({
        embarqueId: (linha.id as string) || null,
        colaboradorId: colaboradorId || (row.colaborador_id as string) || null,
        operacao: 'create',
        status: 'aplicada',
        dadosAnteriores: null,
        dadosNovos: snapshotEmbarque(linha),
        motivo:
          `${MOTIVO_FRAGMENTO_RECORTE} — ${frag.papel === 'head' ? 'ponta anterior' : 'ponta posterior'} ` +
          `[${frag.inicio}..${frag.fim || 'aberto'}] (original ${embarqueId})`,
        ator,
      });
      if (idFrag) resultado.edicoes.push(idFrag);
    }
    return resultado;
  } catch (err) {
    console.error('[escala-audit] exceção ao aplicar recorte (best-effort):', err);
    return resultado;
  }
}

/**
 * A edição pertence ao próprio usuário (ator_id) e ainda está 'aplicada' com
 * embarque? Base do AUTODESFAZER (v5.80): o autor comum pode desfazer a
 * PRÓPRIA edição sem ser gestor. A verificação de "mais recente ainda
 * 'aplicada'" (guarda de SUPERSESSÃO) permanece dentro de reverterEdicaoEscala
 * — se houver edição posterior, o autor recebe 409 (fail-closed).
 */
export async function edicaoEhDoProprioAutorAplicada(
  edicaoId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!edicaoId || !userId) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from('gt_escala_edicoes')
      .select('ator_id, embarque_id, status')
      .eq('id', edicaoId)
      .maybeSingle();
    if (error || !data) return false;
    const ed = data as { ator_id?: string | null; embarque_id?: string | null; status?: string | null };
    return (
      ed.status === 'aplicada' &&
      Boolean(ed.embarque_id) &&
      Boolean(ed.ator_id) &&
      ed.ator_id === userId
    );
  } catch (err) {
    console.error('[escala-audit] erro ao verificar autor da edição:', err);
    return false;
  }
}

/**
 * Resolve nomes de colaboradores em lote (paginado; PostgREST trunca em 1000).
 * gt_escala_edicoes não tem FK para gt_colaboradores, então o join é manual.
 */
export async function resolverNomesColaboradores(
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const limpos = Array.from(new Set((ids || []).filter((i): i is string => Boolean(i))));
  const mapa = new Map<string, string>();
  if (limpos.length === 0) return mapa;
  const res = await paginarSelect<{ id: string; nome_completo: string | null }>(
    async (from, to) => {
      const r = await supabaseAdmin
        .from('gt_colaboradores')
        .select('id, nome_completo')
        .in('id', limpos)
        .order('id')
        .range(from, to);
      return { data: r.data, error: r.error };
    },
  );
  if (res.error) {
    console.error('[escala-audit] erro ao resolver nomes de colaboradores:', res.error);
    return mapa;
  }
  for (const row of res.rows) mapa.set(row.id, row.nome_completo || '');
  return mapa;
}

export type ResultadoReversao =
  | { ok: true; edicao: EscalaEdicaoRow; embarqueId: string | null; colaboradorId: string | null }
  | { ok: false; status: number; error: string };

/** Operações-fonte da trilha; 'rejeicao'/'reversao' são linhas DE trilha (não edições). */
const EDICOES_FONTE: EscalaEdicaoOperacao[] = ['create', 'update', 'delete', 'restore'];

/** Normaliza um campo vigiado da linha crua para comparação com o snapshot. */
function normalizarCampoSnapshot(campo: keyof EmbarqueSnapshot, row: EmbarqueRow): unknown {
  const v = (row as Record<string, unknown>)[campo as string];
  if (campo === 'exibir_dia_inicio') {
    return v === undefined || v === null ? null : Boolean(v);
  }
  return v ?? null;
}

/**
 * O estado atual da linha corresponde ao after-image (dados_novos) da edição?
 * Compara apenas CAMPOS_RESTORE presentes no snapshot (updated_at/deleted_at
 * mudam a cada escrita e nunca comparam).
 * Retorno: true = corresponde; false = diverge; null = sem after-image
 * verificável (nenhum campo vigiado presente no snapshot).
 */
function compararLinhaComSnapshot(
  row: EmbarqueRow,
  snapshot: EmbarqueSnapshot | Record<string, unknown> | null,
): boolean | null {
  if (!snapshot) return null;
  const snap = snapshot as EmbarqueSnapshot;
  let comparados = 0;
  for (const campo of CAMPOS_RESTORE) {
    if (!(campo in snap)) continue;
    comparados++;
    const esperado = (snap as Record<string, unknown>)[campo as string] ?? null;
    const atual = normalizarCampoSnapshot(campo, row);
    if (campo === 'exibir_dia_inicio') {
      if (esperado !== atual) return false;
    } else if (String(esperado ?? '') !== String(atual ?? '')) {
      return false;
    }
  }
  return comparados > 0 ? true : null;
}

/**
 * Guarda de SUPERSESSÃO: existe outra edição-fonte APLICADA, mais recente, para
 * o mesmo embarque? Reverter a mais antiga primeiro descartaria silenciosamente
 * o efeito da mais nova e deixaria a fila contraditória com o estado da linha.
 * Linhas de trilha ('rejeicao'/'reversao') não contam — permitir rejeitar A
 * depois de B já revertida é fluxo legítimo.
 * Retorno: null = pode prosseguir; senão o erro (409/500) da reversão.
 */
async function verificarEdicaoSuperada(
  embarqueId: string,
  edicao: EscalaEdicaoRow,
): Promise<ResultadoReversao | null> {
  if (!edicao.created_at) return null; // sem carimbo não há comparação cronológica
  const res = await paginarSelect<{ id: string }>(async (from, to) => {
    const r = await supabaseAdmin
      .from('gt_escala_edicoes')
      .select('id')
      .eq('embarque_id', embarqueId)
      .eq('status', 'aplicada')
      .in('operacao', EDICOES_FONTE)
      .gt('created_at', edicao.created_at as string)
      .neq('id', edicao.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);
    return { data: (r.data ?? null) as Array<{ id: string }> | null, error: r.error };
  });
  if (res.error) {
    // Fail-closed: sem conseguir verificar, não sobrescrevemos estado possívelmente mais novo.
    return {
      ok: false,
      status: 500,
      error:
        'Não foi possível verificar edições posteriores deste embarque — reversão não aplicada (tente novamente).',
    };
  }
  if (res.rows.length > 0) {
    return {
      ok: false,
      status: 409,
      error:
        'Edição superada por edição posterior do mesmo embarque — rejeite/reverta as edições mais recentes primeiro.',
    };
  }
  return null;
}

/**
 * Guarda de SOBREPOSIÇÃO para rollback de 'delete': ressuscitar uma linha
 * soft-deletada não pode criar dois eventos vivos sobrepostos (o fechamento
 * colapsa apenas ciclos IDÊNTICOS — duplicados corrompem NxN/FI da folha).
 * Retorno: null = pode prosseguir; senão o erro 409 da reversão.
 */
async function verificarSobreposicaoParaRestaurar(
  edicao: EscalaEdicaoRow,
  row: EmbarqueRow,
  embarqueId: string,
): Promise<ResultadoReversao | null> {
  const anteriores = (edicao.dados_anteriores || {}) as EmbarqueSnapshot;
  const colaboradorId =
    (row.colaborador_id as string) || anteriores.colaborador_id || edicao.colaborador_id || null;
  const ini = String((row.data_embarque as string) || anteriores.data_embarque || '').slice(0, 10);
  const fimBruto = String(
    (row.data_desembarque as string) || anteriores.data_desembarque || '',
  ).slice(0, 10);
  if (!colaboradorId || !ini) return null; // nada verificável — segue o rollback
  // Linha aberta (data_desembarque NULL) sobrepõe tudo a partir de ini.
  const fim = fimBruto || '2999-12-31';
  const vivos = await buscarSobrepostos(colaboradorId, ini, fim, embarqueId);
  if (vivos.length === 0) return null;
  const detalhe = vivos
    .slice(0, 3)
    .map((r) => `${String(r.data_embarque || '?')}→${String(r.data_desembarque || 'aberto')}`)
    .join('; ');
  return {
    ok: false,
    status: 409,
    error:
      `Reversão recusada: ${vivos.length} evento(s) vivo(s) sobrepõem este período (${detalhe}) — ` +
      'resolva a sobreposição antes de restaurar (nunca deixamos dois eventos vivos sobrepostos).',
  };
}

/**
 * Rollback de uma edição aplicada (rejeição da fila ou reversão manual).
 *
 * Mecânica por operação auditada:
 * - create  → soft-delete da linha criada;
 * - update  → restaura campos de dados_anteriores na linha (se não deletada);
 * - delete  → remove o soft-delete (deleted_at = null);
 * - restore → volta o soft-delete (inverso exato).
 *
 * Guardas anti-overwrite de before-image obsoleta (409 — nada é sobrescrito):
 * - SUPERSESSÃO: existe edição-fonte mais recente ainda 'aplicada' para o
 *   mesmo embarque → recusa (rejeite/reverta as mais novas primeiro).
 * - update: a linha precisa ainda corresponder a dados_novos (after-image);
 *   divergiu → recusa.
 * - delete: un-delete só sem eventos vivos sobrepostos ao período (nunca dois
 *   eventos vivos sobrepostos — duplicaria ciclos no fechamento).
 *
 * Sempre: status da edição → 'revertida' + revisada_* + motivo, e a própria
 * reversão grava sua linha de auditoria (operacao 'rejeicao'|'reversao').
 */
export async function reverterEdicaoEscala(input: {
  edicaoId: string;
  motivo: string;
  ator: EscalaEdicaoAtor;
  operacao: 'rejeicao' | 'reversao';
}): Promise<ResultadoReversao> {
  const { edicaoId, motivo, ator, operacao } = input;

  const { data: edicaoData, error: edicaoErr } = await supabaseAdmin
    .from('gt_escala_edicoes')
    .select('*')
    .eq('id', edicaoId)
    .maybeSingle();
  if (edicaoErr) {
    return { ok: false, status: 500, error: edicaoErr.message };
  }
  const edicao = edicaoData as EscalaEdicaoRow | null;
  if (!edicao) {
    return { ok: false, status: 404, error: 'Edição não encontrada na fila de auditoria.' };
  }
  if (edicao.status !== 'aplicada') {
    return {
      ok: false,
      status: 409,
      error: `Edição já está '${edicao.status}' — apenas edições 'aplicada' podem ser revertidas.`,
    };
  }
  if (!ESCALA_EDICAO_OPERACOES.includes(edicao.operacao as EscalaEdicaoOperacao)) {
    return { ok: false, status: 400, error: `Operação auditada inválida: ${edicao.operacao}` };
  }
  if (edicao.operacao === 'rejeicao' || edicao.operacao === 'reversao') {
    return { ok: false, status: 400, error: 'Linhas de rejeição/reversão não são revertíveis.' };
  }

  const embarqueId = edicao.embarque_id || null;
  const colaboradorId = edicao.colaborador_id || null;
  const now = new Date().toISOString();
  let antesDoRollback: EmbarqueSnapshot | null = null;
  let depoisDoRollback: EmbarqueSnapshot | null = null;

  if (embarqueId) {
    const row = await buscarEmbarquePorId(embarqueId);
    antesDoRollback = snapshotEmbarque(row);

    // Guarda 1 (supersessão): uma edição-fonte mais recente ainda 'aplicada'
    // para o mesmo embarque torna este rollback um overwrite de before-image
    // obsoleto — recusar (409) em vez de clobber silencioso.
    const superada = await verificarEdicaoSuperada(embarqueId, edicao);
    if (superada) return superada;

    // Guarda 2 por operação (estado do embarque vs. o que esta edição produziu).
    if (edicao.operacao === 'update') {
      if (row && !row.deleted_at) {
        const corresponde = compararLinhaComSnapshot(row, edicao.dados_novos);
        if (corresponde === false) {
          return {
            ok: false,
            status: 409,
            error:
              'Reversão recusada: o embarque não corresponde mais ao estado registrado por esta edição (escrita posterior) — ajuste manualmente se necessário.',
          };
        }
        // corresponde === null: sem after-image verificável — a guarda
        // cronológica acima é a proteção remanescente.
      }
    } else if (edicao.operacao === 'delete' && row) {
      // Ressuscitar (un-delete) só sem eventos vivos sobrepostos. Sem linha no
      // banco o un-delete é no-op — guarda desnecessária.
      const conflito = await verificarSobreposicaoParaRestaurar(edicao, row, embarqueId);
      if (conflito) return conflito;
    }

    try {
      if (edicao.operacao === 'create') {
        // Desfazer criação = soft-delete da linha criada.
        if (row && !row.deleted_at) {
          const { error } = await supabaseAdmin
            .from('gt_historico_embarques')
            .update({ deleted_at: now, updated_at: now })
            .eq('id', embarqueId);
          if (error) return { ok: false, status: 500, error: error.message };
        }
      } else if (edicao.operacao === 'update') {
        // Desfazer update = restaurar campos anteriores (linha viva).
        const anteriores = (edicao.dados_anteriores || {}) as EmbarqueSnapshot;
        if (row && !row.deleted_at) {
          const restore: Record<string, unknown> = { updated_at: now };
          for (const campo of CAMPOS_RESTORE) {
            if (campo in anteriores) restore[campo] = anteriores[campo] ?? null;
          }
          const { error } = await supabaseAdmin
            .from('gt_historico_embarques')
            .update(restore)
            .eq('id', embarqueId);
          if (error) return { ok: false, status: 500, error: error.message };
        }
      } else if (edicao.operacao === 'delete') {
        // Desfazer exclusão = remove o soft-delete.
        const { error } = await supabaseAdmin
          .from('gt_historico_embarques')
          .update({ deleted_at: null, updated_at: now })
          .eq('id', embarqueId);
        if (error) return { ok: false, status: 500, error: error.message };
      } else if (edicao.operacao === 'restore') {
        // Desfazer restore = volta o soft-delete.
        const { error } = await supabaseAdmin
          .from('gt_historico_embarques')
          .update({ deleted_at: now, updated_at: now })
          .eq('id', embarqueId);
        if (error) return { ok: false, status: 500, error: error.message };
      }

      const depois = await buscarEmbarquePorId(embarqueId);
      depoisDoRollback = snapshotEmbarque(depois);
    } catch (err) {
      console.error('[escala-audit] exceção no rollback:', err);
      return { ok: false, status: 500, error: 'Falha ao desfazer a edição na escala.' };
    }
  }

  // Marca a edição da fila como revertida.
  const { error: updErr } = await supabaseAdmin
    .from('gt_escala_edicoes')
    .update({
      status: 'revertida',
      motivo: motivo,
      revisada_por_id: ator.id || null,
      revisada_por_nome: ator.nome || null,
      revisada_em: now,
    })
    .eq('id', edicaoId);
  if (updErr) {
    console.error('[escala-audit] rollback aplicado mas falhou marcar revisão:', updErr.message);
    return {
      ok: false,
      status: 500,
      error: 'Rollback aplicado, mas não foi possível atualizar a fila de auditoria.',
    };
  }

  // A própria reversão entra na trilha (best-effort).
  await registrarEdicaoEscala({
    embarqueId,
    colaboradorId,
    operacao,
    status: 'aplicada',
    dadosAnteriores: antesDoRollback,
    dadosNovos: depoisDoRollback,
    motivo,
    ator,
  });

  // Escala mudou: cache do realtime e datas do colaborador seguem a linha.
  try {
    invalidateManScheduleCache();
    await sincronizarDatasEscalaColaborador(colaboradorId);
  } catch (err) {
    console.error('[escala-audit] pós-rollback cache/sync (best-effort):', err);
  }

  return { ok: true, edicao: { ...edicao, status: 'revertida' }, embarqueId, colaboradorId };
}
