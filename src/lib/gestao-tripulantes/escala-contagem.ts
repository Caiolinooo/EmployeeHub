/**
 * Who wins a day/week on the Man Schedule grid, and how ON/DBA/FI/TRE are counted.
 * New local launches must beat an older overlapping STB/ON, otherwise they never appear.
 */

export interface RotationLike {
  id?: string;
  start: string | null;
  end: string | null;
  type: string;
  /** 'local' = lançamento manual; beats 'mio' on exact ties (same start date). */
  origem?: string | null;
}

export function parseCivilDate(str: string | null | undefined): Date | null {
  if (!str || typeof str !== 'string' || str.trim() === '') return null;
  const clean = str.trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const parsed = new Date(y, m, d, 0, 0, 0, 0);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function civilYmdNumber(str: string | null | undefined): number {
  const d = parseCivilDate(str);
  if (!d) return 0;
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function isSpecificTipo(type: string | null | undefined): boolean {
  const t = String(type || '').toLowerCase();
  return Boolean(t) && t !== 'normal' && t !== 'on';
}

export function rotationOverlapsPeriod(
  r: RotationLike,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  if (!r.start) return false;
  const rStart = parseCivilDate(r.start);
  if (!rStart) return false;
  const rEnd = r.end
    ? parseCivilDate(r.end)
    : new Date(rStart.getTime() + 90 * 24 * 60 * 60 * 1000);
  if (!rEnd) return false;
  rEnd.setHours(23, 59, 59, 999);
  return periodStart <= rEnd && periodEnd >= rStart;
}

/**
 * Among overlapping events, prefer: starts in this column, then the latest
 * start date (the new launch), then a more specific type, then the manual
 * launch (origem='local' — the operator's adjustment must stay visible over
 * the MIO row it overrides), then persisted id.
 */
export function pickOverlappingRotation(
  rotations: RotationLike[],
  periodStart: Date,
  periodEnd: Date,
): RotationLike | null {
  let best: RotationLike | null = null;
  let bestScore = -1;

  for (const r of rotations) {
    if (!rotationOverlapsPeriod(r, periodStart, periodEnd)) continue;
    const rStart = parseCivilDate(r.start);
    if (!rStart) continue;
    const startsInPeriod = rStart >= periodStart && rStart <= periodEnd;
    const score =
      (startsInPeriod ? 1_000_000 : 0) +
      civilYmdNumber(r.start) * 10 +
      (isSpecificTipo(r.type) ? 5 : 0) +
      (r.origem === 'local' ? 6 : 0) +
      (r.id ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

export function displayCodigoToBucket(display: string): 'on' | 'dba' | 'fi' | 'tre' | null {
  const st = display.toUpperCase();
  if (st === 'ON') return 'on';
  if (st === 'DBA') return 'dba';
  if (st === 'FI') return 'fi';
  if (st === 'TRE' || st === 'TF') return 'tre';
  return null;
}
