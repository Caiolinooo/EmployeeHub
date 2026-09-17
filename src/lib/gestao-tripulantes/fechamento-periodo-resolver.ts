/**
 * GT v2 — resolução de período do fechamento (R2) + lista de marcados (R5)
 * + exposição de pendências do próximo período (R1/R4).
 *
 * Fonte do período (determinística, nesta ordem):
 * 1. dataInicio+dataFim explícitos na query  → fonte 'explicit'
 * 2. gt_fechamento_periodos do mes_referencia → fonte 'config'
 * 3. mês civil do mes_referencia (âncora BRT) → fonte 'mes'
 *
 * Quando a linha do mês tem lista_confirmada=true, SOMENTE os marcados
 * (gt_fechamento_marcacoes.marcado=true) entram naquele fechamento
 * (lista vazia confirmada = ninguém entra — transmitido na resposta via
 * marcados.total=0 para a UI alertar).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';
import { ymdFromDate } from '@/lib/gestao-tripulantes/fechamento-calculo';

export type FontePeriodoFechamento = 'explicit' | 'config' | 'mes';

export interface PeriodoResolvido {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  fonte: FontePeriodoFechamento;
  listaConfirmada: boolean;
  definidoPorNome: string | null;
}

export interface PeriodoConfigRow {
  mes_referencia: string;
  data_inicio: string;
  data_fim: string;
  lista_confirmada: boolean;
  definido_por_nome: string | null;
}

export interface MarcadoRow {
  id: string;
  mes_referencia: string;
  colaborador_id: string;
  marcado: boolean;
  marcado_por: string | null;
  marcado_por_nome: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Mês de referência default ancorado em BRT (-3h, sem DST). */
export function mesReferenciaAtualBRT(agora = Date.now()): string {
  return new Date(agora - 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export function normalizarMesReferencia(valor?: string | null): string | null {
  const v = String(valor || '').trim();
  return RE_MES.test(v) ? v : null;
}

function dataIsoValida(v: string | null | undefined): v is string {
  if (!v || !RE_DATA.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return !Number.isNaN(dt.getTime()) && dt.getDate() === d && dt.getMonth() === m - 1;
}

/** Limites civis do mês (1º dia 00:00 → último dia 23:59:59.999, hora local). */
export function limitesMesCivil(mesAno: string): { dataInicio: string; dataFim: string } {
  const [y, m] = mesAno.split('-').map(Number);
  const inicio = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const fim = new Date(y, m, 0, 23, 59, 59, 999);
  return { dataInicio: ymdFromDate(inicio), dataFim: ymdFromDate(fim) };
}

export async function carregarPeriodoConfigurado(
  mesReferencia: string,
): Promise<PeriodoConfigRow | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('gt_fechamento_periodos')
      .select('mes_referencia, data_inicio, data_fim, lista_confirmada, definido_por_nome')
      .eq('mes_referencia', mesReferencia)
      .maybeSingle();
    if (error) {
      console.error('[fechamento-periodo-resolver] gt_fechamento_periodos:', error.message);
      return null;
    }
    return (data as PeriodoConfigRow) || null;
  } catch (err) {
    console.error('[fechamento-periodo-resolver] gt_fechamento_periodos (exceção):', err);
    return null;
  }
}

/**
 * Resolve o período na ordem explicit > config > mês civil.
 * Datas explícitas parciais (só uma das duas) caem para a próxima fonte.
 */
export async function resolverPeriodoFechamento(opts: {
  mesAno: string;
  dataInicio?: string | null;
  dataFim?: string | null;
}): Promise<PeriodoResolvido> {
  if (dataIsoValida(opts.dataInicio) && dataIsoValida(opts.dataFim)) {
    return {
      dataInicio: opts.dataInicio,
      dataFim: opts.dataFim,
      fonte: 'explicit',
      listaConfirmada: false,
      definidoPorNome: null,
    };
  }

  const config = await carregarPeriodoConfigurado(opts.mesAno);
  if (config && dataIsoValida(config.data_inicio) && dataIsoValida(config.data_fim)) {
    return {
      dataInicio: config.data_inicio,
      dataFim: config.data_fim,
      fonte: 'config',
      listaConfirmada: Boolean(config.lista_confirmada),
      definidoPorNome: config.definido_por_nome || null,
    };
  }

  const civil = limitesMesCivil(opts.mesAno);
  return {
    dataInicio: civil.dataInicio,
    dataFim: civil.dataFim,
    fonte: 'mes',
    listaConfirmada: false,
    definidoPorNome: null,
  };
}

/** Linhas de gt_fechamento_marcacoes do mês (paginado, ordem determinística). */
export async function carregarMarcacoesDoMes(mesReferencia: string): Promise<MarcadoRow[]> {
  const res = await paginarSelect<MarcadoRow>(async (from, to) => {
    const r = await supabaseAdmin
      .from('gt_fechamento_marcacoes')
      .select(
        'id, mes_referencia, colaborador_id, marcado, marcado_por, marcado_por_nome, created_at, updated_at',
      )
      .eq('mes_referencia', mesReferencia)
      .order('colaborador_id')
      .range(from, to);
    return { data: r.data, error: r.error };
  });
  if (res.error) {
    console.error('[fechamento-periodo-resolver] gt_fechamento_marcacoes:', res.error);
    return [];
  }
  return res.rows;
}

export interface MarcadosDoMes {
  listaConfirmada: boolean;
  idsMarcados: string[];
  total: number;
}

/** Lista confirmada → SOMENTE marcados entram no fechamento daquele mês. */
export async function carregarMarcadosDoMes(mesReferencia: string): Promise<MarcadosDoMes> {
  const config = await carregarPeriodoConfigurado(mesReferencia);
  const listaConfirmada = Boolean(config?.lista_confirmada);
  if (!listaConfirmada) {
    return { listaConfirmada: false, idsMarcados: [], total: 0 };
  }
  const rows = await carregarMarcacoesDoMes(mesReferencia);
  const idsMarcados = rows.filter((r) => r.marcado).map((r) => r.colaborador_id);
  return { listaConfirmada: true, idsMarcados, total: idsMarcados.length };
}

export interface PendenciaProximoPeriodo {
  fiDeficit: number;
  dbaDias: string[];
  folgaAberta: boolean;
  proximoEmbarque?: string | null;
}

export interface PendenciaPorColaborador {
  colaboradorId: string;
  nome: string;
  fiDeficitPendente: number;
  dbaDiasPendentes: string[];
  folgaAberta: boolean;
  proximoEmbarque: string | null;
}

export interface PendenciasFechamento {
  porColaborador: PendenciaPorColaborador[];
  totais: { fi: number; dba: number };
}

interface LinhaRelatorioComPendencias {
  cpf: string;
  nome: string;
  colaborador_id?: string;
  pendenciasProximoPeriodo?: PendenciaProximoPeriodo | null;
}

interface RelatorioComPendencias {
  colaboradoresTotais: LinhaRelatorioComPendencias[];
  totaisPendencias?: { fi: number; dba: number } | null;
}

/**
 * Extrai as pendências (R1/R4) do resultado do gerador. O motor
 * (fechamento-calculo.ts) expõe `pendenciasProximoPeriodo` por colaborador e
 * `totaisPendencias` no agregado; enquanto o campo não existir (engine antiga
 * em hot-reload), a resposta traz totais zerados sem quebrar a rota.
 * `cpf → id` resolvido em lote (paginado) quando a linha não traz o id.
 */
export async function extrairPendenciasDoRelatorio(
  report: unknown,
): Promise<PendenciasFechamento> {
  const vazio: PendenciasFechamento = { porColaborador: [], totais: { fi: 0, dba: 0 } };
  const r = report as RelatorioComPendencias | null | undefined;
  if (!r || !Array.isArray(r.colaboradoresTotais)) return vazio;

  const linhas = r.colaboradoresTotais.filter(
    (l) => l && typeof l === 'object' && l.pendenciasProximoPeriodo,
  );
  if (linhas.length === 0) return vazio;

  const semId = linhas.filter((l) => !l.colaborador_id && l.cpf);
  const idsPorCpf = new Map<string, string>();
  if (semId.length > 0) {
    const res = await paginarSelect<{ id: string; cpf: string | null }>(async (from, to) => {
      const qry = await supabaseAdmin
        .from('gt_colaboradores')
        .select('id, cpf')
        .order('id')
        .range(from, to);
      return { data: qry.data, error: qry.error };
    });
    if (!res.error) {
      for (const row of res.rows) {
        const digits = String(row.cpf || '').replace(/\D/g, '');
        if (digits) idsPorCpf.set(digits, row.id);
      }
    }
  }

  const porColaborador: PendenciaPorColaborador[] = linhas.map((l) => {
    const p = l.pendenciasProximoPeriodo as PendenciaProximoPeriodo;
    const dbaDias = Array.isArray(p.dbaDias) ? p.dbaDias.map(String) : [];
    return {
      colaboradorId: l.colaborador_id || idsPorCpf.get(String(l.cpf || '').replace(/\D/g, '')) || '',
      nome: l.nome || '',
      fiDeficitPendente: Number(p.fiDeficit) || 0,
      dbaDiasPendentes: dbaDias,
      folgaAberta: Boolean(p.folgaAberta),
      proximoEmbarque: p.proximoEmbarque ?? null,
    };
  });

  const totaisCalculados = {
    fi: porColaborador.reduce((acc, p) => acc + p.fiDeficitPendente, 0),
    dba: porColaborador.reduce((acc, p) => acc + p.dbaDiasPendentes.length, 0),
  };

  return {
    porColaborador,
    totais:
      r.totaisPendencias && typeof r.totaisPendencias === 'object'
        ? {
            fi: Number(r.totaisPendencias.fi) || totaisCalculados.fi,
            dba: Number(r.totaisPendencias.dba) || totaisCalculados.dba,
          }
        : totaisCalculados,
  };
}

/**
 * Nome seguro para o arquivo XLSX: reflete multi-embarcações + período.
 */
export function montarNomeArquivoFechamento(opts: {
  mesAno: string;
  embarcacoes: string[];
  embarcacao?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  fonte: FontePeriodoFechamento;
}): string {
  const base = (opts.embarcacoes.length > 0
    ? opts.embarcacoes.join('-')
    : opts.embarcacao || 'Todas'
  )
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  const periodo =
    opts.fonte === 'mes' || !opts.dataInicio || !opts.dataFim
      ? ''
      : `_${opts.dataInicio}_a_${opts.dataFim}`;
  return `relatorio_fechamento_${opts.mesAno}_${base}${periodo || ''}.xlsx`;
}
