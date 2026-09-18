/**
 * Cálculo comparativo de fechamento offshore (DP / folha).
 * Ciclo NxN: embarque N deve folgar N. Dobra e FI saem de dt_inicio + dt_fim.
 * Sem as duas datas o embarque não entra no cômputo automático.
 * Regra do dono: o DIA DO DESEMBARQUE conta como o 1º dia de folga — a
 * janela a bordo é [data_embarque, data_desembarque - 1] e a janela de folga
 * nasce no próprio data_desembarque.
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

/**
 * R1/R4 — parte do ciclo NxN que escapa do período definido (janela de folga
 * que cruza data_fim). FI/DBA pendentes NÃO debitem este período: viram
 * "pendência do próximo período" (adição entre períodos — o mês seguinte
 * computa a fatia dele quando a janela cai inteira nele).
 * - fiDeficit: déficit FI da(s) janela(s) além de data_fim (esperado − folga
 *   real, incluindo os dias de escala que a janela curta nem alcançou a ter).
 * - dbaDias: dias de DBA explícito dentro da janela além de data_fim (trabalho
 *   que reduzirá a folga do próximo período).
 * - folgaAberta: último embarque sem próximo — folga em andamento (regra do
 *   dono: informativo, NÃO gera FI).
 * - proximoEmbarque: data do próximo embarque que corta a janela pendente.
 */
export interface PendenciasProximoPeriodo {
  fiDeficit: number;
  dbaDias: string[];
  folgaAberta: boolean;
  proximoEmbarque?: string;
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
  pendenciasProximoPeriodo: PendenciasProximoPeriodo;
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
    // Afastamento aberto (sem data_fim/previsão): janela de 90d, mesma regra
    // do overlay da grade (embarque-status.ts) — senão o DP conta ON para
    // quem está de licença/férias sem retorno definido.
    const end = parseCivilDate(af.data_fim) || parseCivilDate(af.data_prevista_retorno);
    const b = end
      ? startOfCivilDay(end).getTime()
      : start.getTime() + 90 * 24 * 60 * 60 * 1000;
    const a = startOfCivilDay(start);
    if (t >= a.getTime() && t <= b) {
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

/**
 * Folga realizada = dias civis da janela menos os dias de DBA explícito dentro
 * dela: DBA é trabalho extra, não folga — reduz a folga e aumenta o déficit FI.
 * Usa o conjunto global de dias DBA (não o statusPorDia, que só cobre o
 * período): DBA em janela que cruza o mês conta igualmente como trabalho.
 * Demais marcações (STB/FER/AFAST...) NÃO reduzem aqui (mantido: só alertam
 * via "folga > escala" ou pintam o dia com o próprio status).
 */
function contarFolgaRealEfetiva(
  restStart: Date,
  restEnd: Date,
  dbaDays: Set<string>,
): number {
  let n = 0;
  for (const day of eachCivilDay(restStart, restEnd)) {
    if (dbaDays.has(ymdFromDate(day))) continue;
    n += 1;
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

  // Dias de DBA explícito (qualquer data, inclusive fora do período): trabalho
  // dentro da janela de folga de um ciclo nunca conta como folga realizada.
  const dbaDays = new Set<string>();
  for (const item of usable) {
    if (item.codigo !== 'dba') continue;
    for (const day of eachCivilDay(item.start, item.end)) {
      dbaDays.add(ymdFromDate(day));
    }
  }

  for (const day of days) {
    const afast = findAfastamentoDoDia(afastamentos, day);
    if (afast) {
      statusPorDia[ymdFromDate(day)] = afast;
      continue;
    }
    const picked = pickEventoDoDia(usable, day);
    if (picked) {
      // Regra do dono: o dia do desembarque é o 1º dia de folga — não é dia
      // a bordo (nem ON, nem dobra automática). A janela de folga do ciclo
      // nasce nele (restStart = cur.end); DBA/FI/STB explícitos continuam
      // valendo normalmente nesse dia.
      const ehDesembarque =
        (picked.codigo === 'normal' || picked.codigo === 'previsto') &&
        day.getTime() === picked.end.getTime();
      if (!ehDesembarque) {
        statusPorDia[ymdFromDate(day)] = statusDeEvento(
          picked,
          day,
          escala.diasEmbarque,
          escala.aplicaDobraAutomatica,
        );
      }
    }
  }

  // Colapsa ciclos idênticos (mesmo período e tipo) — linhas duplicadas do
  // mesmo embarque geravam déficit FI fantasma e ciclo NxN repetido por cópia.
  // DBA explícito é trabalho extra, NÃO é ciclo de rotação: não abre janela de
  // folga própria e não corta a janela do ciclo anterior (a pintura 'DBA' no
  // statusPorDia já aconteceu no loop de dias via statusDeEvento).
  const seenCiclos = new Set<string>();
  const aBordo = usable.filter((item) => {
    if (!item.aBordo) return false;
    if (item.codigo === 'dba') return false;
    const key = `${item.start.getTime()}|${item.end.getTime()}|${item.codigo}`;
    if (seenCiclos.has(key)) return false;
    seenCiclos.add(key);
    return true;
  });
  const ciclos: CicloEmbarqueCalculo[] = [];
  const alertas: string[] = [];

  // R1/R4 — pendências do próximo período (janelas de folga que cruzam data_fim
  // e folga aberta do último ciclo). Fi/DBA além do período NÃO debitem este mês.
  let pendFiDeficit = 0;
  const pendDbaDias = new Set<string>();
  let pendFolgaAberta = false;
  let pendProximoEmbarque: string | undefined;

  for (let i = 0; i < aBordo.length; i += 1) {
    const cur = aBordo[i];
    const next = aBordo[i + 1] ?? null;
    const restStartPreview = cur.end;
    const restEndPreview = next
      ? addCivilDays(next.start, -1)
      : addCivilDays(cur.end, Math.max(escala.diasFolga - 1, 0));
    const aboardOverlaps = overlapInclusive(cur.start, cur.end, periodStart, periodEnd);
    const restOverlaps = restEndPreview.getTime() >= restStartPreview.getTime()
      ? overlapInclusive(restStartPreview, restEndPreview, periodStart, periodEnd)
      : null;
    if (!aboardOverlaps && !restOverlaps) continue;

    // Dias a bordo do ciclo: do embarque até a VÉSPERA do desembarque — o
    // dia do desembarque é folga (regra do dono), não entra no cômputo de
    // escala/dobra (diasTotais = dias a bordo; intervalo [start..end] tem o
    // desembarque como último dia civil, logo -1).
    const diasTotais = Math.max(0, daysInclusive(cur.start, cur.end) - 1);
    const aplica = escala.aplicaDobraAutomatica && escala.diasEmbarque > 0;
    // DBA explícito não chega aqui como ciclo (filtrado em aBordo); o único
    // caminho de dobra de ciclo é o excedente da escala (dobra automática).
    const dbaFull = aplica ? Math.max(0, diasTotais - escala.diasEmbarque) : 0;
    const onFull = diasTotais - dbaFull;

    // Regra do dono: a folga começa NO dia do desembarque (folga dia 1).
    const restStart = cur.end;
    let restEnd: Date | null = null;
    let restActual = 0;
    if (next) {
      restEnd = addCivilDays(next.start, -1);
      restActual = restEnd.getTime() >= restStart.getTime()
        ? contarFolgaRealEfetiva(restStart, restEnd, dbaDays)
        : 0;
    } else if (escala.diasFolga > 0) {
      // Último ciclo: N dias de folga contados A PARTIR do desembarque
      // (inclusive) → [end, end + N - 1].
      restEnd = addCivilDays(cur.end, Math.max(escala.diasFolga - 1, 0));
      restActual = contarFolgaRealEfetiva(restStart, restEnd, dbaDays);
    }

    // ---- R1/R4: recorte do período (modelo "clipped") ----
    // A janela [restStart..restEnd] é cortada em data_fim: a fatia dentro do
    // período vira o FI deste fechamento; a fatia além de data_fim vira
    // PENDÊNCIA do próximo período (soma entre períodos permanece aditiva —
    // o mês seguinte computa a fatia dele quando a janela cai inteira nele).
    // Esperado = dias de escala (NxN) contados a partir do INÍCIO da janela;
    // dia de DBA dentro da fatia esperada = folga FALTANTE (regra do dono:
    // 14x14 com 8 folga + 2 DBA = 6 FI + 2 DBA).
    const windowDays = restEnd && restEnd.getTime() >= restStart.getTime()
      ? eachCivilDay(restStart, restEnd)
      : [];
    let antes = 0; // dias da janela antes do período
    let noPeriodo = 0; // dias da janela dentro do período
    let depois = 0; // dias da janela além de data_fim
    let dbaNoPeriodo = 0;
    let dbaDepois = 0;
    for (const day of windowDays) {
      const t = day.getTime();
      if (t < periodStart.getTime()) antes += 1;
      else if (t > periodEnd.getTime()) {
        depois += 1;
        if (dbaDays.has(ymdFromDate(day))) dbaDepois += 1;
      } else {
        noPeriodo += 1;
        if (dbaDays.has(ymdFromDate(day))) dbaNoPeriodo += 1;
      }
    }
    let fiDeficit = 0;
    let fiPendente = 0;
    if (aplica && escala.diasFolga > 0 && next) {
      if (windowDays.length === 0) {
        // Embarques adjacentes (janela vazia): déficit integral no período —
        // comportamento mantido (folga realizada 0).
        fiDeficit = escala.diasFolga;
      } else {
        const esperadoTotal = Math.min(escala.diasFolga, windowDays.length);
        const esperadoIn = Math.min(Math.max(esperadoTotal - antes, 0), noPeriodo);
        const esperadoFora = Math.min(Math.max(esperadoTotal - antes - noPeriodo, 0), depois);
        const folgaRealIn = noPeriodo - dbaNoPeriodo;
        const folgaRealFora = depois - dbaDepois;
        // Dias de escala que a janela curta nem alcançou a ter ("fantasma"):
        // atribuídos ao período onde a janela TERMINA — é lá que o déficit
        // se materializa (mantém a soma entre períodos aditiva).
        const fantasma = Math.max(0, escala.diasFolga - windowDays.length);
        fiDeficit = Math.max(0, esperadoIn - folgaRealIn);
        fiPendente = Math.max(0, esperadoFora - folgaRealFora);
        if (fantasma > 0) {
          if (depois > 0) fiPendente += fantasma;
          else fiDeficit += fantasma;
        }
        // Pendência DBA: dias de DBA explícito da janela além de data_fim
        // (até next.start − 1) — reduzirão a folga do próximo período.
        if (dbaDepois > 0) {
          for (const day of windowDays) {
            const key = ymdFromDate(day);
            if (day.getTime() > periodEnd.getTime() && dbaDays.has(key)) pendDbaDias.add(key);
          }
        }
        if ((fiPendente > 0 || dbaDepois > 0) && !pendProximoEmbarque) {
          pendProximoEmbarque = ymdFromDate(next.start);
        }
      }
    } else if (!next && restEnd && restEnd.getTime() >= restStart.getTime()) {
      // Folga aberta (sem próximo embarque) cobrindo o período: apenas
      // informativo — regra do dono, NÃO gera FI.
      if (overlapInclusive(restStart, restEnd, periodStart, periodEnd)) {
        pendFolgaAberta = true;
      }
    }
    pendFiDeficit += fiPendente;

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
    if (aplica && next && depois > 0 && windowDays.length > 0) {
      // Janela cortada por data_fim: FI do período + pendência explicitados.
      if (fiDeficit + fiPendente > 0) {
        cicloAlertas.push(
          `folga cortada em ${ymdFromDate(periodEnd)}: ${fiDeficit} FI no período + ${fiPendente} FI pendente(s) do próximo período`,
        );
      }
      if (windowDays.length > escala.diasFolga) {
        cicloAlertas.push(`folga ${windowDays.length}d > escala ${escala.diasFolga}d (excedente, não debita)`);
      }
    } else if (aplica && next && restActual !== escala.diasFolga) {
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
    pendenciasProximoPeriodo: {
      fiDeficit: pendFiDeficit,
      dbaDias: [...pendDbaDias].sort(),
      folgaAberta: pendFolgaAberta,
      ...(pendProximoEmbarque ? { proximoEmbarque: pendProximoEmbarque } : {}),
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
