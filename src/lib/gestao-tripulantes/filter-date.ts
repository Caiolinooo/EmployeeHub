/**
 * Filtros `type="date"`: o Chrome dispara onChange a cada dígito do ano
 * com valores “válidos” mas incompletos (`0002-01-01`, `0020-01-01`, `0202-01-01`).
 * Esses valores NÃO devem filtrar nem gerar colunas da escala.
 */

export const FILTER_DATE_MIN_YEAR = 1990;
export const FILTER_DATE_MAX_YEAR = 2100;
export const FILTER_DATE_MIN = `${FILTER_DATE_MIN_YEAR}-01-01`;
export const FILTER_DATE_MAX = `${FILTER_DATE_MAX_YEAR}-12-31`;

/** Teto de colunas no viewport diário (evita freeze se um intervalo enorme passar no gate). */
export const MAX_SCHEDULE_DAY_COLUMNS = 400;
/** Teto de segurança da grade semanal (~38 anos). Histórico 1990–hoje cabe; ano 0002 não. */
export const MAX_SCHEDULE_WEEK_COLUMNS = 2000;

const COMPLETE_CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCompleteFilterDate(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const match = COMPLETE_CIVIL_DATE_RE.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < FILTER_DATE_MIN_YEAR || year > FILTER_DATE_MAX_YEAR) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function parseCompleteFilterDate(value: string | null | undefined): Date | null {
  if (!isCompleteFilterDate(value)) return null;
  const [year, month, day] = (value as string).trim().split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Recorta o fim para no máximo `maxColumns` dias inclusivos, preservando o início. */
export function clampScheduleRange(
  rangeStart: Date,
  rangeEnd: Date,
  maxColumns: number,
): { start: Date; end: Date } {
  const start = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate(),
    0, 0, 0, 0,
  );
  const end = new Date(
    rangeEnd.getFullYear(),
    rangeEnd.getMonth(),
    rangeEnd.getDate(),
    0, 0, 0, 0,
  );
  if (end < start) {
    return { start, end: new Date(start) };
  }
  const cap = Math.max(1, maxColumns);
  const maxEnd = new Date(start);
  maxEnd.setDate(maxEnd.getDate() + cap - 1);
  if (end > maxEnd) {
    return { start, end: maxEnd };
  }
  return { start, end };
}
