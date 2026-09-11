import { DEFAULT_TIPOS_EVENTO_ESCALA, mapDbTipoToCodigo } from '@/lib/gestao-tripulantes/escala-tipos';

/** Machine marker persisted on LGP rows without Embarque Real. */
export const GT_EMBARQUE_MARKER_PREVISTO = 'GT_EMBARQUE=previsto';
export const GT_EMBARQUE_MARKER_REAL = 'GT_EMBARQUE=real';

export const GT_DASHBOARD_KPIS = ['colaboradores', 'embarcados', 'disponiveis', 'docs_vencidos'] as const;
export type GtDashboardKpi = (typeof GT_DASHBOARD_KPIS)[number];

export interface EscalaEventoDia {
  id?: string;
  tipo: string | null;
  data_embarque: string | null;
  data_desembarque: string | null;
  data_prevista_desembarque?: string | null;
  observacoes?: string | null;
  origem?: string | null;
}

const OPEN_END_FALLBACK_DAYS = 90;

export function parseGtDashboardKpi(raw: string | null | undefined): GtDashboardKpi | '' {
  const key = String(raw || '').trim().toLowerCase();
  if ((GT_DASHBOARD_KPIS as readonly string[]).includes(key)) return key as GtDashboardKpi;
  return '';
}

export function normalizeScheduleDayCode(code: string | null | undefined): string {
  return String(code || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .toUpperCase();
}

/** ON*, bare *, UTR*, etc. — never POB. */
export function hasAsteriskScheduleCode(code: string | null | undefined): boolean {
  return normalizeScheduleDayCode(code).includes('*');
}

/**
 * People on board (POB / "Embarcados Agora").
 * Exact `ON` only. `ON*`, `*`, STB, DBA, FI, OFF-C, TRE, FER, UTR, DHC, `-` do not count.
 */
export function isEmbarcadoPobDayCode(code: string | null | undefined): boolean {
  if (hasAsteriskScheduleCode(code)) return false;
  return normalizeScheduleDayCode(code) === 'ON';
}

export function isRotacaoPrevista(
  tipo: string | null | undefined,
  observacoes?: string | null,
): boolean {
  const obs = String(observacoes || '');
  if (obs.includes(GT_EMBARQUE_MARKER_PREVISTO)) return true;
  const codigo = mapDbTipoToCodigo(tipo);
  if (codigo === 'previsto') return true;
  return hasAsteriskScheduleCode(tipo);
}

export function scheduleDisplayCode(
  rotationType: string | null | undefined,
  observacoes?: string | null,
): string {
  if (isRotacaoPrevista(rotationType, observacoes)) return 'ON*';
  const codigo = mapDbTipoToCodigo(rotationType);
  const seed = DEFAULT_TIPOS_EVENTO_ESCALA.find((t) => t.codigo === codigo);
  if (seed) return seed.display_code;
  if (codigo === 'normal') return 'ON';
  if (codigo === 'offc') return 'OFF-C';
  return String(rotationType || '').toUpperCase();
}

function parseYmdLocal(ymd: string | null | undefined): Date | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd).trim());
  if (!m) return null;
  const parsed = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ymdOf(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function civilTodayYmd(now: Date = new Date()): string {
  return ymdOf(now);
}

export interface PobRotationLike {
  id?: string;
  type?: string | null;
  start?: string | null;
  end?: string | null;
  observacoes?: string | null;
  origem?: string | null;
}

function eventCoversCivilDay(ev: EscalaEventoDia, ymd: string): boolean {
  const start = parseYmdLocal(ev.data_embarque);
  if (!start) return false;
  const day = parseYmdLocal(ymd);
  if (!day) return false;
  day.setHours(12, 0, 0, 0);

  const endRaw = ev.data_desembarque || ev.data_prevista_desembarque;
  const end = endRaw
    ? parseYmdLocal(endRaw)
    : new Date(start.getTime() + OPEN_END_FALLBACK_DAYS * 24 * 60 * 60 * 1000);
  if (!end) return false;
  end.setHours(23, 59, 59, 999);
  return day >= start && day <= end;
}

function isSpecificRotationTipo(tipo: string | null | undefined): boolean {
  const codigo = mapDbTipoToCodigo(tipo);
  return codigo !== 'normal' && codigo !== '';
}

/** FER/AFAST dominate the day pick: quem está de folga/afastado nunca vira POB. */
function isAfastamentoRotationTipo(tipo: string | null | undefined): boolean {
  const codigo = mapDbTipoToCodigo(tipo);
  return codigo === 'ferias' || codigo === 'afastamento';
}

/**
 * Same scoring idea as Man Schedule cell pick, with safety tiers:
 * 1) FER/AFAST dominate (never outvoted by an overlapping rotation);
 * 2) start-on-day;
 * 3) manual launch (`origem='local'`) beats the MIO row it overrides;
 * 4) specific tipo (OFF-C, STB, DBA, ON*...);
 * 5) persisted id.
 */
export function pickEventForCivilDay(
  events: EscalaEventoDia[],
  ymd: string,
): EscalaEventoDia | null {
  let best: EscalaEventoDia | null = null;
  let bestScore = -1;
  for (const ev of events) {
    if (!eventCoversCivilDay(ev, ymd)) continue;
    const start = parseYmdLocal(ev.data_embarque);
    const startsToday = start ? ymdOf(start) === ymd : false;
    const score =
      (isAfastamentoRotationTipo(ev.tipo) ? 5000 : 0) +
      (startsToday ? 1000 : 10) +
      (ev.origem === 'local' ? 60 : 0) +
      (isSpecificRotationTipo(ev.tipo) ? 50 : 0) +
      (ev.id ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = ev;
    }
  }
  return best;
}

export function dayCodeForCivilDay(events: EscalaEventoDia[], ymd: string): string {
  const picked = pickEventForCivilDay(events, ymd);
  if (!picked) return '';
  return scheduleDisplayCode(picked.tipo, picked.observacoes);
}

/** Unique people whose civil-day cell is exact `ON` (same rule as Matriz / `isEmbarcadoPobDayCode`). */
export function countPobOnCivilDay(
  members: Array<{ rotations: PobRotationLike[] }>,
  ymd: string,
): number {
  let n = 0;
  for (const member of members) {
    const events: EscalaEventoDia[] = member.rotations.map((r) => ({
      id: r.id,
      tipo: r.type ?? null,
      data_embarque: r.start ?? null,
      data_desembarque: r.end ?? null,
      observacoes: r.observacoes ?? null,
      origem: r.origem ?? null,
    }));
    if (isEmbarcadoPobDayCode(dayCodeForCivilDay(events, ymd))) n += 1;
  }
  return n;
}

export function composeLgpObservacoes(realizado: boolean, rtpeStatus?: string | null): string {
  const marker = realizado ? GT_EMBARQUE_MARKER_REAL : GT_EMBARQUE_MARKER_PREVISTO;
  const rtpe = rtpeStatus ? `RTPE: ${rtpeStatus}` : '';
  return [marker, rtpe].filter(Boolean).join(' | ');
}

export const STATUS_EMBARQUE_LIVE = [
  'embarcado',
  'standby',
  'folga',
  'desembarcado',
  'afastado',
  'ferias',
  'treinamento',
] as const;
export type StatusEmbarqueLive = (typeof STATUS_EMBARQUE_LIVE)[number];

export const SCHEDULE_DAY_KINDS = [
  'embarcado',
  'standby',
  'folga',
  'afastado',
  'treinamento',
  'previsto',
  'vazio',
  'outro',
] as const;
export type ScheduleDayKind = (typeof SCHEDULE_DAY_KINDS)[number];

export interface StatusEscalaHoje {
  dayCode: string;
  status: StatusEmbarqueLive;
}

export interface AfastamentoEscalaInput {
  id?: string;
  tipo_afastamento?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  data_prevista_retorno?: string | null;
  motivo?: string | null;
}

function foldScheduleToken(code: string): string {
  return code.normalize('NFD').replace(/\p{M}/gu, '');
}

export function coerceStatusEmbarqueLive(
  raw: string | null | undefined,
): StatusEmbarqueLive {
  const key = String(raw || '').trim().toLowerCase();
  switch (key) {
    case 'embarcado':
      return 'embarcado';
    case 'standby':
      return 'standby';
    case 'folga':
      return 'folga';
    case 'desembarcado':
      return 'desembarcado';
    case 'afastado':
      return 'afastado';
    case 'ferias':
    case 'férias':
      return 'ferias';
    case 'treinamento':
      return 'treinamento';
    case '':
      return 'desembarcado';
    default:
      return 'desembarcado';
  }
}

/** Classify today's Man Schedule display code into a list/badge kind. */
export function classifyScheduleDayCode(code: string | null | undefined): ScheduleDayKind {
  if (isEmbarcadoPobDayCode(code)) return 'embarcado';
  const n = foldScheduleToken(normalizeScheduleDayCode(code));
  if (!n) return 'vazio';
  if (hasAsteriskScheduleCode(n) || n === '*') return 'previsto';
  if (n === 'DBA') return 'embarcado';
  if (n === 'STB' || n === 'STANDBY') return 'standby';
  if (n === 'TRE' || n === 'TF' || n === 'TREINAMENTO' || n === 'UTR') return 'treinamento';
  if (
    n === 'FER' ||
    n === 'FERIAS' ||
    n === 'AFAST' ||
    n === 'AFASTADO' ||
    n === 'AFASTAMENTO'
  ) {
    return 'afastado';
  }
  if (
    n === 'FI' ||
    n === 'OFF' ||
    n === 'OFF-C' ||
    n === 'OFFC' ||
    n === 'FOLGA' ||
    n === '-' ||
    n === 'DHC'
  ) {
    return 'folga';
  }
  return 'outro';
}

/**
 * Map today's scale cell → `status_embarque` shown in lists/badges.
 * ON (and DBA, onboard but not POB) → embarcado; STB → standby;
 * Folga/OFF/OFF-C/FI → folga; FER/AFAST → afastado; TRE → treinamento.
 * Empty / ON* / unknown keep `fallbackStored` (never invent Embarcado).
 */
export function statusEmbarqueFromDayCode(
  code: string | null | undefined,
  fallbackStored?: string | null,
): StatusEmbarqueLive {
  const kind = classifyScheduleDayCode(code);
  switch (kind) {
    case 'embarcado':
      return 'embarcado';
    case 'standby':
      return 'standby';
    case 'folga':
      return 'folga';
    case 'afastado':
      return 'afastado';
    case 'treinamento':
      return 'treinamento';
    case 'previsto':
    case 'vazio':
    case 'outro':
      return coerceStatusEmbarqueLive(fallbackStored);
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function afastamentoToEscalaEvento(af: AfastamentoEscalaInput): EscalaEventoDia {
  const tipoRaw = foldScheduleToken(String(af.tipo_afastamento || '').toLowerCase());
  const isFerias = tipoRaw.includes('ferias');
  return {
    id: af.id,
    tipo: isFerias ? 'ferias' : 'afastamento',
    data_embarque: af.data_inicio ?? null,
    data_desembarque: af.data_fim || af.data_prevista_retorno || null,
    observacoes: af.motivo ?? null,
  };
}

export function resolverStatusEscalaHoje(
  events: EscalaEventoDia[],
  ymd: string,
  fallbackStored?: string | null,
): StatusEscalaHoje {
  const dayCode = dayCodeForCivilDay(events, ymd);
  return {
    dayCode,
    status: statusEmbarqueFromDayCode(dayCode, fallbackStored),
  };
}

export function aplicarStatusEscalaHoje<T extends { id: string }>(
  rows: T[],
  byId: Map<string, StatusEscalaHoje>,
): Array<T & { status_embarque: StatusEmbarqueLive; standby: boolean; escala_codigo_hoje: string }> {
  return rows.map((row) => {
    const live = byId.get(row.id);
    const stored = (row as { status_embarque?: unknown }).status_embarque;
    if (!live) {
      const status = coerceStatusEmbarqueLive(stored == null ? '' : String(stored));
      return {
        ...row,
        status_embarque: status,
        standby: Boolean((row as { standby?: unknown }).standby) || status === 'standby',
        escala_codigo_hoje: '',
      };
    }
    return {
      ...row,
      status_embarque: live.status,
      standby: live.status === 'standby',
      escala_codigo_hoje: live.dayCode,
    };
  });
}
