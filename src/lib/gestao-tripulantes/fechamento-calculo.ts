/**
 * Cálculo comparativo de fechamento offshore (DP / folha).
 * Ciclo NxN: embarque N deve folgar N. Dobra e FI saem de dt_inicio + dt_fim.
 * Sem as duas datas o embarque não entra no cômputo automático.
 */

import { isRotacaoPrevista } from '@/lib/gestao-tripulantes/embarque-status';
import { mapDbTipoToCodigo } from '@/lib/gestao-tripulantes/escala-tipos';
import { parseCivilDate } from '@/lib/gestao-tripulantes/escala-contagem';
import {
  extractEscalaDias,
  type CamposEscalaColaborador,
} from '@/lib/gestao-tripulantes/regime-escala';

export const STATUS_DIA_FECHAMENTO = [
  'ON',
  'DBA',
  'FI',
  'TRE',
  'FER',
  'AFAST',
  'STB',
  'OFF-C',
  'FOLGA',
  'ON*',
  '',
] as const;

export type StatusDiaFechamento = (typeof STATUS_DIA_FECHAMENTO)[number];

export interface EventoEscalaCalculo {
  id?: string;
  tipo: string | null;
  data_embarque: string | null;
  data_desembarque?: string | null;
  data_prevista_desembarque?: string | null;
  observacoes?: string | null;
}

export interface AfastamentoCalculo {
  tipo_afastamento?: string | null;
  data_inicio: string | null;
  data_fim?: string | null;
  data_prevista_retorno?: string | null;
}

export interface PeriodoFechamento {
  dataInicio: Date;
  dataFim: Date;
}

export interface CicloEmbarqueCalculo {
  data_inicio: string;
  data_fim: string;
  fim_previsto: boolean;
  dias_totais: number;
  dias_on: number;
  dias_dba: number;
  dias_folga_esperada: number;
  dias_folga_real: number;
  dias_fi_deficit: number;
  escala_ok: boolean;
  soma_ok: boolean;
  alertas: string[];
}

export interface ChecagensFechamento {
  escala_ok: boolean;
  soma_ok: boolean;
  sem_dt_inicio: number;
  sem_dt_fim: number;
  alertas: string[];
}

export interface CalculoFechamentoColaborador {
  regime_escala: string;
  dias_embarque_escala: number;
  dias_folga_escala: number;
  aplica_dobra_automatica: boolean;
  dias_on: number;
  dias_dba: number;
  dias_fi: number;
  dias_fi_evento: number;
  dias_fi_deficit: number;
  dias_tre: number;
  dias_fer: number;
  dias_stb: number;
  dias_folga: number;
  dias_offc: number;
  dias_afast: number;
  embarques: CicloEmbarqueCalculo[];
  statusPorDia: Record<string, StatusDiaFechamento>;
  checagens: ChecagensFechamento;
}

export interface TotaisConsolidadosFechamento {
  totalColaboradores: number;
  totalON: number;
  totalDBA: number;
  totalFI: number;
  totalFIEvento: number;
  totalFIDeficit: number;
  totalTRE: number;
  totalFER: number;
  totalSTB: number;
  totalFOLGA: number;
  totalOFFC: number;
  colaboradoresComAlerta: number;
}

export interface RubricasDiasFechamento {
  matricula: string;
  cpf: string;
  nome: string;
  cargo: string;
  centro_custo: string;
  regime_escala: string;
  escala_embarque: number;
  escala_folga: number;
  rubricas: {
    dias_embarcado: number;
    dias_dobra: number;
    dias_folga_indenizada: number;
    dias_folga: number;
    dias_standby: number;
    dias_treinamento: number;
    dias_ferias: number;
  };
  embarques: CicloEmbarqueCalculo[];
  checagens: ChecagensFechamento;
}

const TIPOS_MARCADOR_UM_DIA = new Set(['fi', 'stb', 'tre', 'offc', 'dba', 'ferias', 'afastamento']);
const TIPOS_A_BORDO = new Set(['normal', 'previsto', 'dba']);

export function ymdFromDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function startOfCivilDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function addCivilDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
}

export function civilDayIndex(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export function daysInclusive(start: Date, end: Date): number {
  const a = startOfCivilDay(start);
  const b = startOfCivilDay(end);
  if (b.getTime() < a.getTime()) return 0;
  return civilDayIndex(b) - civilDayIndex(a) + 1;
}

export function eachCivilDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cur = startOfCivilDay(start);
  const last = startOfCivilDay(end);
  while (cur.getTime() <= last.getTime()) {
    out.push(cur);
    cur = addCivilDays(cur, 1);
  }
  return out;
}

export function overlapInclusive(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): { start: Date; end: Date } | null {
  const start = startOfCivilDay(aStart).getTime() > startOfCivilDay(bStart).getTime()
    ? startOfCivilDay(aStart)
    : startOfCivilDay(bStart);
  const end = startOfCivilDay(aEnd).getTime() < startOfCivilDay(bEnd).getTime()
    ? startOfCivilDay(aEnd)
    : startOfCivilDay(bEnd);
  if (end.getTime() < start.getTime()) return null;
  return { start, end };
}

function isFeriasTipo(tipo: string | null | undefined): boolean {
  const t = String(tipo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t === 'ferias' || t === 'fer';
}

export function resolverFimEvento(ev: EventoEscalaCalculo): {
  fim: Date | null;
  fimPrevisto: boolean;
  semDtFim: boolean;
} {
  const start = parseCivilDate(ev.data_embarque);
  if (!start) return { fim: null, fimPrevisto: false, semDtFim: true };

  if (ev.data_desembarque) {
    const fim = parseCivilDate(ev.data_desembarque);
    return { fim, fimPrevisto: false, semDtFim: !fim };
  }
  if (ev.data_prevista_desembarque) {
    const fim = parseCivilDate(ev.data_prevista_desembarque);
    return { fim, fimPrevisto: true, semDtFim: !fim };
  }

  const codigo = mapDbTipoToCodigo(ev.tipo);
  if (TIPOS_MARCADOR_UM_DIA.has(codigo)) {
    return { fim: start, fimPrevisto: false, semDtFim: false };
  }

  return { fim: null, fimPrevisto: false, semDtFim: true };
}

interface EventoNormalizado {
  ev: EventoEscalaCalculo;
  codigo: string;
  start: Date;
  end: Date;
  fimPrevisto: boolean;
  previsto: boolean;
  aBordo: boolean;
}

function normalizarEventos(eventos: EventoEscalaCalculo[]): {
  usable: EventoNormalizado[];
  semDtInicio: number;
  semDtFim: number;
} {
  const usable: EventoNormalizado[] = [];
  let semDtInicio = 0;
  let semDtFim = 0;

  for (const ev of eventos) {
    const start = parseCivilDate(ev.data_embarque);
    if (!start) {
      semDtInicio += 1;
      continue;
    }
    const resolved = resolverFimEvento(ev);
    if (!resolved.fim) {
      semDtFim += 1;
      continue;
    }
    const end = startOfCivilDay(resolved.fim.getTime() < start.getTime() ? start : resolved.fim);
    const codigo = mapDbTipoToCodigo(ev.tipo);
    const previsto = isRotacaoPrevista(ev.tipo, ev.observacoes);
    usable.push({
      ev,
      codigo,
      start: startOfCivilDay(start),
      end,
      fimPrevisto: resolved.fimPrevisto,
      previsto,
      aBordo: TIPOS_A_BORDO.has(codigo) && !previsto,
    });
  }

  usable.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  return { usable, semDtInicio, semDtFim };
}

function scoreEventoNoDia(item: EventoNormalizado, day: Date): number {
  const startsToday = ymdFromDate(item.start) === ymdFromDate(day);
  const especifico = item.codigo !== 'normal' && item.codigo !== 'previsto';
  return (startsToday ? 1_000_000 : 0) + civilDayIndex(item.start) * 10 + (especifico ? 5 : 0) + (item.ev.id ? 1 : 0);
}

function pickEventoDoDia(eventos: EventoNormalizado[], day: Date): EventoNormalizado | null {
  let best: EventoNormalizado | null = null;
  let bestScore = -1;
  const t = day.getTime();
  for (const item of eventos) {
    if (t < item.start.getTime() || t > item.end.getTime()) continue;
    const score = scoreEventoNoDia(item, day);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

function statusDeEventoABordo(
  item: EventoNormalizado,
  day: Date,
  maxDiasRegulares: number,
  aplicaDobraAutomatica: boolean,
): StatusDiaFechamento {
  if (item.codigo === 'dba') return 'DBA';
  if (item.previsto || item.codigo === 'previsto') return 'ON*';
  const diaCorrido = daysInclusive(item.start, day);
  if (aplicaDobraAutomatica && maxDiasRegulares > 0 && diaCorrido > maxDiasRegulares) {
    return 'DBA';
  }
  return 'ON';
}

function statusDeEvento(item: EventoNormalizado, day: Date, maxDiasRegulares: number, aplicaDobra: boolean): StatusDiaFechamento {
  switch (item.codigo) {
    case 'fi':
      return 'FI';
    case 'dba':
      return 'DBA';
    case 'tre':
      return 'TRE';
    case 'stb':
      return 'STB';
    case 'offc':
      return 'OFF-C';
    case 'ferias':
      return 'FER';
    case 'afastamento':
      return 'AFAST';
    case 'previsto':
    case 'normal':
      return statusDeEventoABordo(item, day, maxDiasRegulares, aplicaDobra);
    default:
      return statusDeEventoABordo(item, day, maxDiasRegulares, aplicaDobra);
  }
}

function findAfastamentoDoDia(afastamentos: AfastamentoCalculo[], day: Date): StatusDiaFechamento | '' {
  const t = day.getTime();
  for (const af of afastamentos) {
    const start = parseCivilDate(af.data_inicio);
    if (!start) continue;
    const end = parseCivilDate(af.data_fim) || parseCivilDate(af.data_prevista_retorno);
    if (!end) continue;
    const a = startOfCivilDay(start);
    const b = startOfCivilDay(end);
    if (t >= a.getTime() && t <= b.getTime()) {
      return isFeriasTipo(af.tipo_afastamento) ? 'FER' : 'AFAST';
    }
  }
  return '';
}

function contarStatus(statusPorDia: Record<string, StatusDiaFechamento>): {
  dias_on: number;
  dias_dba: number;
  dias_fi_evento: number;
  dias_tre: number;
  dias_fer: number;
  dias_stb: number;
  dias_folga: number;
  dias_offc: number;
  dias_afast: number;
} {
  const acc = {
    dias_on: 0,
    dias_dba: 0,
    dias_fi_evento: 0,
    dias_tre: 0,
    dias_fer: 0,
    dias_stb: 0,
    dias_folga: 0,
    dias_offc: 0,
    dias_afast: 0,
  };
  for (const status of Object.values(statusPorDia)) {
    switch (status) {
      case 'ON':
        acc.dias_on += 1;
        break;
      case 'DBA':
        acc.dias_dba += 1;
        break;
      case 'FI':
        acc.dias_fi_evento += 1;
        break;
      case 'TRE':
        acc.dias_tre += 1;
        break;
      case 'FER':
        acc.dias_fer += 1;
        break;
      case 'STB':
        acc.dias_stb += 1;
        break;
      case 'FOLGA':
        acc.dias_folga += 1;
        break;
      case 'OFF-C':
        acc.dias_offc += 1;
        break;
      case 'AFAST':
        acc.dias_afast += 1;
        break;
      case 'ON*':
      case '':
        break;
      default: {
        const _never: never = status;
        void _never;
        break;
      }
    }
  }
  return acc;
}

function clipCount(start: Date, end: Date, period: PeriodoFechamento, predicate: (day: Date) => boolean): number {
  const ov = overlapInclusive(start, end, period.dataInicio, period.dataFim);
  if (!ov) return 0;
  let n = 0;
  for (const day of eachCivilDay(ov.start, ov.end)) {
    if (predicate(day)) n += 1;
  }
  return n;
}

export function calcularFechamentoColaborador(
  colaborador: CamposEscalaColaborador,
  eventos: EventoEscalaCalculo[],
  afastamentos: AfastamentoCalculo[],
  periodo: PeriodoFechamento,
): CalculoFechamentoColaborador {
  const escala = extractEscalaDias(colaborador);
  const periodStart = startOfCivilDay(periodo.dataInicio);
  const periodEnd = startOfCivilDay(periodo.dataFim);
  const period = { dataInicio: periodStart, dataFim: periodEnd };

  const { usable, semDtInicio, semDtFim } = normalizarEventos(eventos);
  const days = eachCivilDay(periodStart, periodEnd);
  const statusPorDia: Record<string, StatusDiaFechamento> = {};

  for (const day of days) {
    const afast = findAfastamentoDoDia(afastamentos, day);
    if (afast) {
      statusPorDia[ymdFromDate(day)] = afast;
      continue;
    }
    const picked = pickEventoDoDia(usable, day);
    if (picked) {
      statusPorDia[ymdFromDate(day)] = statusDeEvento(
        picked,
        day,
        escala.diasEmbarque,
        escala.aplicaDobraAutomatica,
      );
    }
  }

  const aBordo = usable.filter((item) => item.aBordo);
  const ciclos: CicloEmbarqueCalculo[] = [];
  const alertas: string[] = [];

  for (let i = 0; i < aBordo.length; i += 1) {
    const cur = aBordo[i];
    const next = aBordo[i + 1] ?? null;
    const restStartPreview = addCivilDays(cur.end, 1);
    const restEndPreview = next
      ? addCivilDays(next.start, -1)
      : addCivilDays(cur.end, Math.max(escala.diasFolga, 0));
    const aboardOverlaps = overlapInclusive(cur.start, cur.end, periodStart, periodEnd);
    const restOverlaps = restEndPreview.getTime() >= restStartPreview.getTime()
      ? overlapInclusive(restStartPreview, restEndPreview, periodStart, periodEnd)
      : null;
    if (!aboardOverlaps && !restOverlaps) continue;

    const diasTotais = daysInclusive(cur.start, cur.end);
    const aplica = escala.aplicaDobraAutomatica && escala.diasEmbarque > 0;
    const dbaFull = cur.codigo === 'dba'
      ? diasTotais
      : (aplica ? Math.max(0, diasTotais - escala.diasEmbarque) : 0);
    const onFull = diasTotais - dbaFull;

    const restStart = addCivilDays(cur.end, 1);
    let restEnd: Date | null = null;
    let restActual = 0;
    if (next) {
      restEnd = addCivilDays(next.start, -1);
      restActual = restEnd.getTime() >= restStart.getTime() ? daysInclusive(restStart, restEnd) : 0;
    } else if (escala.diasFolga > 0) {
      restEnd = addCivilDays(cur.end, escala.diasFolga);
      restActual = daysInclusive(restStart, restEnd);
    }

    const fiDeficit = aplica && escala.diasFolga > 0 && next
      ? Math.max(0, escala.diasFolga - restActual)
      : 0;

    if (restStart && restEnd && restEnd.getTime() >= restStart.getTime()) {
      for (const day of eachCivilDay(restStart, restEnd)) {
        if (day.getTime() < periodStart.getTime() || day.getTime() > periodEnd.getTime()) continue;
        const key = ymdFromDate(day);
        if (!statusPorDia[key]) statusPorDia[key] = 'FOLGA';
      }
    }

    const cicloAlertas: string[] = [];
    if (aplica && diasTotais !== escala.diasEmbarque) {
      cicloAlertas.push(
        diasTotais > escala.diasEmbarque
          ? `embarque ${diasTotais}d > escala ${escala.diasEmbarque}d (${dbaFull} DBA)`
          : `embarque ${diasTotais}d < escala ${escala.diasEmbarque}d`,
      );
    }
    if (aplica && next && restActual !== escala.diasFolga) {
      cicloAlertas.push(
        restActual < escala.diasFolga
          ? `folga ${restActual}d < escala ${escala.diasFolga}d (${fiDeficit} FI)`
          : `folga ${restActual}d > escala ${escala.diasFolga}d`,
      );
    }
    if (cur.fimPrevisto) cicloAlertas.push('fim previsto (sem data_desembarque)');

    const somaOk = onFull + dbaFull === diasTotais;
    const escalaOk = cicloAlertas.filter((a) => !a.startsWith('fim previsto')).length === 0;
    if (!somaOk) cicloAlertas.push('soma ON+DBA diverge do intervalo dt_inicio/dt_fim');

    const diasOnPeriodo = clipCount(
      cur.start,
      cur.end,
      period,
      (day) => statusPorDia[ymdFromDate(day)] === 'ON',
    );
    const diasDbaPeriodo = clipCount(
      cur.start,
      cur.end,
      period,
      (day) => statusPorDia[ymdFromDate(day)] === 'DBA',
    );

    ciclos.push({
      data_inicio: ymdFromDate(cur.start),
      data_fim: ymdFromDate(cur.end),
      fim_previsto: cur.fimPrevisto,
      dias_totais: diasTotais,
      dias_on: diasOnPeriodo,
      dias_dba: diasDbaPeriodo,
      dias_folga_esperada: escala.diasFolga,
      dias_folga_real: restActual,
      dias_fi_deficit: fiDeficit,
      escala_ok: escalaOk,
      soma_ok: somaOk,
      alertas: cicloAlertas,
    });
    alertas.push(...cicloAlertas.map((a) => `${ymdFromDate(cur.start)}–${ymdFromDate(cur.end)}: ${a}`));
  }

  const counts = contarStatus(statusPorDia);
  const fiDeficitTotal = ciclos.reduce((sum, c) => sum + c.dias_fi_deficit, 0);
  const diasFi = counts.dias_fi_evento + Math.max(0, fiDeficitTotal - counts.dias_fi_evento);

  if (semDtInicio) alertas.push(`${semDtInicio} evento(s) sem dt início`);
  if (semDtFim) alertas.push(`${semDtFim} embarque(s) sem dt fim — cômputo automático ignorado`);

  const escalaOk = ciclos.every((c) => c.escala_ok) && semDtFim === 0;
  const somaOk = ciclos.every((c) => c.soma_ok);

  return {
    regime_escala: escala.label,
    dias_embarque_escala: escala.diasEmbarque,
    dias_folga_escala: escala.diasFolga,
    aplica_dobra_automatica: escala.aplicaDobraAutomatica,
    dias_on: counts.dias_on,
    dias_dba: counts.dias_dba,
    dias_fi: diasFi,
    dias_fi_evento: counts.dias_fi_evento,
    dias_fi_deficit: fiDeficitTotal,
    dias_tre: counts.dias_tre,
    dias_fer: counts.dias_fer,
    dias_stb: counts.dias_stb,
    dias_folga: counts.dias_folga,
    dias_offc: counts.dias_offc,
    dias_afast: counts.dias_afast,
    embarques: ciclos,
    statusPorDia,
    checagens: {
      escala_ok: escalaOk,
      soma_ok: somaOk,
      sem_dt_inicio: semDtInicio,
      sem_dt_fim: semDtFim,
      alertas,
    },
  };
}

export function statusSemanaFechamento(
  statusPorDia: Record<string, StatusDiaFechamento>,
  weekStart: Date,
): StatusDiaFechamento {
  const start = startOfCivilDay(weekStart);
  const end = addCivilDays(start, 6);
  const prioridade: StatusDiaFechamento[] = ['FER', 'AFAST', 'DBA', 'ON', 'FI', 'TRE', 'STB', 'OFF-C', 'FOLGA', 'ON*'];
  const seen = new Set<StatusDiaFechamento>();
  for (const day of eachCivilDay(start, end)) {
    const st = statusPorDia[ymdFromDate(day)];
    if (st) seen.add(st);
  }
  for (const st of prioridade) {
    if (seen.has(st)) return st;
  }
  return '';
}

export function somarTotaisFechamento(
  calculos: CalculoFechamentoColaborador[],
): Omit<TotaisConsolidadosFechamento, 'totalColaboradores'> {
  return calculos.reduce(
    (acc, c) => {
      acc.totalON += c.dias_on;
      acc.totalDBA += c.dias_dba;
      acc.totalFI += c.dias_fi;
      acc.totalFIEvento += c.dias_fi_evento;
      acc.totalFIDeficit += c.dias_fi_deficit;
      acc.totalTRE += c.dias_tre;
      acc.totalFER += c.dias_fer;
      acc.totalSTB += c.dias_stb;
      acc.totalFOLGA += c.dias_folga;
      acc.totalOFFC += c.dias_offc;
      if (!c.checagens.escala_ok || !c.checagens.soma_ok || c.checagens.alertas.length > 0) {
        acc.colaboradoresComAlerta += 1;
      }
      return acc;
    },
    {
      totalON: 0,
      totalDBA: 0,
      totalFI: 0,
      totalFIEvento: 0,
      totalFIDeficit: 0,
      totalTRE: 0,
      totalFER: 0,
      totalSTB: 0,
      totalFOLGA: 0,
      totalOFFC: 0,
      colaboradoresComAlerta: 0,
    },
  );
}

export function montarRubricasFolha(
  ident: { matricula: string; cpf: string; nome: string; cargo: string; centro_custo: string },
  calc: CalculoFechamentoColaborador,
): RubricasDiasFechamento {
  return {
    matricula: ident.matricula,
    cpf: ident.cpf,
    nome: ident.nome,
    cargo: ident.cargo,
    centro_custo: ident.centro_custo,
    regime_escala: calc.regime_escala,
    escala_embarque: calc.dias_embarque_escala,
    escala_folga: calc.dias_folga_escala,
    rubricas: {
      dias_embarcado: calc.dias_on,
      dias_dobra: calc.dias_dba,
      dias_folga_indenizada: calc.dias_fi,
      dias_folga: calc.dias_folga,
      dias_standby: calc.dias_stb,
      dias_treinamento: calc.dias_tre,
      dias_ferias: calc.dias_fer,
    },
    embarques: calc.embarques,
    checagens: calc.checagens,
  };
}
