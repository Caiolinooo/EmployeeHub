import {
  FILTER_DATE_MAX_YEAR,
  FILTER_DATE_MIN_YEAR,
  MAX_SCHEDULE_DAY_COLUMNS,
  MAX_SCHEDULE_WEEK_COLUMNS,
  clampScheduleRange,
} from '@/lib/gestao-tripulantes/filter-date';

export type ScheduleViewport = 'day' | 'week';

export interface ReferenceMonth {
  year: number;
  month: number;
}

export interface ScheduleColumn {
  date: Date;
}

export type ManScheduleRealtimeJanela = '90d' | '180d' | '365d' | 'all';

export const REFERENCE_MONTH_STORAGE_KEY = 'gt-man-schedule-reference-month';

const MIN_WEEK_COLUMNS = 12;
const JANELA_SLACK_DAYS = 14;

const JANELA_PRESETS: Record<Exclude<ManScheduleRealtimeJanela, 'all'>, { pastDays: number; futureDays: number }> = {
  '90d': { pastDays: 45, futureDays: 180 },
  '180d': { pastDays: 90, futureDays: 360 },
  '365d': { pastDays: 180, futureDays: 540 },
};

const JANELA_ORDER: Exclude<ManScheduleRealtimeJanela, 'all'>[] = ['90d', '180d', '365d'];

export function civilReferenceMonth(now: Date = new Date()): ReferenceMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isSameReferenceMonth(a: ReferenceMonth, b: ReferenceMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

export function referenceMonthKey(month: ReferenceMonth): string {
  const y = String(month.year).padStart(4, '0');
  const m = String(month.month).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseReferenceMonthKey(value: string | null | undefined): ReferenceMonth | null {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  if (year < FILTER_DATE_MIN_YEAR || year > FILTER_DATE_MAX_YEAR) return null;
  return { year, month };
}

export function clampReferenceMonth(month: ReferenceMonth): ReferenceMonth {
  const monthSafe = Math.min(12, Math.max(1, Math.trunc(month.month) || 1));
  if (month.year < FILTER_DATE_MIN_YEAR) return { year: FILTER_DATE_MIN_YEAR, month: 1 };
  if (month.year > FILTER_DATE_MAX_YEAR) return { year: FILTER_DATE_MAX_YEAR, month: 12 };
  return { year: Math.trunc(month.year), month: monthSafe };
}

export function shiftReferenceMonth(month: ReferenceMonth, delta: number): ReferenceMonth {
  const total = month.year * 12 + (month.month - 1) + delta;
  const year = Math.floor(total / 12);
  const monthIndex = total - year * 12;
  return clampReferenceMonth({ year, month: monthIndex + 1 });
}

export function readReferenceMonthPreference(): ReferenceMonth | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseReferenceMonthKey(window.localStorage.getItem(REFERENCE_MONTH_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistReferenceMonthPreference(month: ReferenceMonth): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REFERENCE_MONTH_STORAGE_KEY, referenceMonthKey(clampReferenceMonth(month)));
  } catch {
    // private mode / quota
  }
}

export function boundsOfMonth(month: ReferenceMonth): { start: Date; end: Date } {
  const clamped = clampReferenceMonth(month);
  const start = new Date(clamped.year, clamped.month - 1, 1, 0, 0, 0, 0);
  const end = new Date(clamped.year, clamped.month, 0, 23, 59, 59, 999);
  return { start, end };
}

export function formatReferenceMonthLabel(month: ReferenceMonth, locale: string): string {
  const clamped = clampReferenceMonth(month);
  const loc = locale === 'en-US' ? 'en-US' : 'pt-BR';
  const date = new Date(clamped.year, clamped.month - 1, 1);
  const raw = date.toLocaleString(loc, { month: 'long' });
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);
  return `${name} ${clamped.year}`;
}

export function parseCivilYmd(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function snapToSaturday(date: Date): Date {
  const start = startOfLocalDay(date);
  const day = start.getDay();
  const diff = day >= 6 ? day - 6 : day + 1;
  start.setDate(start.getDate() - diff);
  return start;
}

function viewportColumnSpanDays(viewport: ScheduleViewport): number {
  switch (viewport) {
    case 'day':
      return 1;
    case 'week':
      return 7;
    default: {
      const _never: never = viewport;
      return _never;
    }
  }
}

export function columnPeriod(columnDate: Date, viewport: ScheduleViewport): { start: Date; end: Date } {
  const start = startOfLocalDay(columnDate);
  const span = viewportColumnSpanDays(viewport);
  const end = new Date(start);
  end.setDate(end.getDate() + span - 1);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function generateDayColumns(rangeStart: Date, rangeEnd: Date): ScheduleColumn[] {
  const { start, end } = clampScheduleRange(rangeStart, rangeEnd, MAX_SCHEDULE_DAY_COLUMNS);
  const days: ScheduleColumn[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push({ date: new Date(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days.length > 0 ? days : [{ date: new Date(start) }];
}

export function generateWeekColumns(rangeStart: Date, rangeEnd: Date): ScheduleColumn[] {
  let start = addDays(snapToSaturday(rangeStart), -14);
  const end = addDays(startOfLocalDay(rangeEnd), 14);

  const maxSpanDays = MAX_SCHEDULE_WEEK_COLUMNS * 7;
  const spanDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (spanDays > maxSpanDays) {
    start = snapToSaturday(addDays(end, -(maxSpanDays - 1)));
  }

  const weeks: ScheduleColumn[] = [];
  const cursor = new Date(start);
  while (cursor <= end && weeks.length < MAX_SCHEDULE_WEEK_COLUMNS) {
    weeks.push({ date: new Date(cursor) });
    cursor.setDate(cursor.getDate() + 7);
  }

  while (weeks.length < MIN_WEEK_COLUMNS && weeks.length < MAX_SCHEDULE_WEEK_COLUMNS) {
    const extra = new Date(start);
    extra.setDate(extra.getDate() + weeks.length * 7);
    weeks.push({ date: extra });
  }

  return weeks.length > 0 ? weeks : [{ date: new Date(start) }];
}

export interface BuildScheduleColumnsInput {
  viewport: ScheduleViewport;
  referenceMonth: ReferenceMonth;
  rotationDates: ReadonlyArray<Date>;
  filterStart: Date | null;
  filterEnd: Date | null;
}

function minDate(a: Date | null, b: Date): Date {
  return a && a < b ? a : b;
}

function maxDate(a: Date | null, b: Date): Date {
  return a && a > b ? a : b;
}

export function buildScheduleColumns(input: BuildScheduleColumnsInput): ScheduleColumn[] {
  const month = boundsOfMonth(input.referenceMonth);
  const hasFilter = Boolean(input.filterStart || input.filterEnd);

  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const raw of input.rotationDates) {
    const d = startOfLocalDay(raw);
    earliest = minDate(earliest, d);
    latest = maxDate(latest, d);
  }

  if (input.filterStart) {
    const d = startOfLocalDay(input.filterStart);
    earliest = minDate(earliest, d);
    latest = maxDate(latest, d);
  }
  if (input.filterEnd) {
    const d = startOfLocalDay(input.filterEnd);
    earliest = minDate(earliest, d);
    latest = maxDate(latest, d);
  }

  if (input.viewport === 'day' && !hasFilter) {
    return generateDayColumns(month.start, month.end);
  }

  earliest = minDate(earliest, month.start);
  latest = maxDate(latest, startOfLocalDay(month.end));

  switch (input.viewport) {
    case 'day':
      return generateDayColumns(earliest, latest);
    case 'week':
      return generateWeekColumns(earliest, latest);
    default: {
      const _never: never = input.viewport;
      return _never;
    }
  }
}

export function indexOfCivilDay(
  columns: ReadonlyArray<ScheduleColumn>,
  ymd: string,
  viewport: ScheduleViewport,
): number {
  const day = parseCivilYmd(ymd);
  if (!day) return -1;
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
  for (let i = 0; i < columns.length; i++) {
    const { start, end } = columnPeriod(columns[i].date, viewport);
    if (noon >= start && noon <= end) return i;
  }
  return -1;
}

export function indexOfReferenceMonth(
  columns: ReadonlyArray<ScheduleColumn>,
  month: ReferenceMonth,
  viewport: ScheduleViewport,
): number {
  const bounds = boundsOfMonth(month);
  for (let i = 0; i < columns.length; i++) {
    const { start, end } = columnPeriod(columns[i].date, viewport);
    if (end >= bounds.start && start <= bounds.end) return i;
  }
  return -1;
}

export function focusColumnIndex(
  columns: ReadonlyArray<ScheduleColumn>,
  month: ReferenceMonth,
  viewport: ScheduleViewport,
  todayYmd: string,
): number {
  const today = parseCivilYmd(todayYmd);
  const isCurrent =
    today !== null && today.getFullYear() === month.year && today.getMonth() + 1 === month.month;

  if (isCurrent) {
    const todayIdx = indexOfCivilDay(columns, todayYmd, viewport);
    if (todayIdx >= 0) return todayIdx;
  }

  const monthIdx = indexOfReferenceMonth(columns, month, viewport);
  return monthIdx >= 0 ? monthIdx : 0;
}

export function realtimeJanelaForReferenceMonth(
  month: ReferenceMonth,
  now: Date = new Date(),
): ManScheduleRealtimeJanela {
  const { start, end } = boundsOfMonth(month);
  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const pastNeeded = Math.max(0, Math.ceil((nowMs - start.getTime()) / dayMs) + JANELA_SLACK_DAYS);
  const futureNeeded = Math.max(0, Math.ceil((end.getTime() - nowMs) / dayMs) + JANELA_SLACK_DAYS);

  for (const key of JANELA_ORDER) {
    const preset = JANELA_PRESETS[key];
    if (preset.pastDays >= pastNeeded && preset.futureDays >= futureNeeded) return key;
  }
  return 'all';
}
