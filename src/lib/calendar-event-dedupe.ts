/**
 * Display/aggregation dedupe for calendar events (ICS + holidays).
 * Does not mutate source ICS. Same start + compatible location + similar title → one event.
 */
import { isValid, parseISO, startOfMinute } from 'date-fns';

export type CalendarDedupeAttendee = { email?: string; name?: string };

export type CalendarDedupeable = {
  id?: string;
  title?: string;
  summary?: string;
  name?: string;
  start: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  url?: string;
  attendees?: CalendarDedupeAttendee[];
};

export type DedupeSimilarResult<T> = {
  events: T[];
  hidden: number;
};

const TITLE_LEVENSHTEIN_MIN = 0.88;
const TITLE_JACCARD_MIN = 0.8;
const TITLE_JACCARD_LEVENSHTEIN_FLOOR = 0.72;
const TITLE_CONTAINMENT_RATIO = 0.8;
const SHORT_TITLE_MAX_LEN = 5;
const LOCATION_LEVENSHTEIN_MIN = 0.9;

const NOISE_SUFFIX = /\s*\((?:c[oó]pia|copy|atualizado|updated|duplicad[oa])\)\s*$/i;

export function normalizeCalendarText(value: string | undefined | null): string {
  const stripped = String(value || '')
    .replace(NOISE_SUFFIX, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped;
}

export function calendarEventTitle(event: CalendarDedupeable): string {
  return event.title || event.summary || event.name || '';
}

export function calendarEventStartKey(start: string, allDay?: boolean): string {
  const raw = String(start || '').trim();
  if (!raw) return '';
  if (allDay || /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw.slice(0, 10)}|allday`;
  }

  const parsed = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T00:00:00`);
  const date = isValid(parsed) ? parsed : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return startOfMinute(date).toISOString();
}

export function calendarEventLocationKey(location?: string | null): string {
  return normalizeCalendarText(location);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function tokenSet(text: string): Set<string> {
  return new Set(text.split(' ').filter((token) => token.length > 1));
}

function jaccard(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  setA.forEach((token) => {
    if (setB.has(token)) inter += 1;
  });
  return inter / (setA.size + setB.size - inter);
}

function numberSignature(text: string): string {
  return (text.match(/\d+/g) || []).join('|');
}

export function titlesAreSimilar(a: string, b: string): boolean {
  const na = normalizeCalendarText(a);
  const nb = normalizeCalendarText(b);
  if (na === nb) return true;
  if (!na || !nb) return false;

  const numsA = numberSignature(na);
  const numsB = numberSignature(nb);
  if (numsA && numsB && numsA !== numsB) return false;

  const maxLen = Math.max(na.length, nb.length);
  if (maxLen <= SHORT_TITLE_MAX_LEN) return false;

  const ratio = similarityRatio(na, nb);
  if (ratio >= TITLE_LEVENSHTEIN_MIN) return true;

  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (
    longer.includes(shorter) &&
    shorter.length / longer.length >= TITLE_CONTAINMENT_RATIO &&
    tokenSet(shorter).size >= 2
  ) {
    return true;
  }

  return jaccard(na, nb) >= TITLE_JACCARD_MIN && ratio >= TITLE_JACCARD_LEVENSHTEIN_FLOOR;
}

export function locationsCompatible(a?: string | null, b?: string | null): boolean {
  const na = calendarEventLocationKey(a);
  const nb = calendarEventLocationKey(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  if (Math.max(na.length, nb.length) <= SHORT_TITLE_MAX_LEN) return false;
  return similarityRatio(na, nb) >= LOCATION_LEVENSHTEIN_MIN;
}

function richness(event: CalendarDedupeable): number {
  const attendees = event.attendees?.length || 0;
  return (
    (event.description?.trim().length || 0) +
    attendees * 40 +
    (event.url?.trim() ? 30 : 0) +
    (event.location?.trim().length || 0) +
    (calendarEventTitle(event).length || 0)
  );
}

function mergeAttendees(
  a?: CalendarDedupeAttendee[],
  b?: CalendarDedupeAttendee[],
): CalendarDedupeAttendee[] | undefined {
  const list = [...(a || []), ...(b || [])];
  if (list.length === 0) return undefined;
  const byKey = new Map<string, CalendarDedupeAttendee>();
  list.forEach((item) => {
    const key = normalizeCalendarText(item.email || item.name || '');
    if (!key) return;
    const prev = byKey.get(key);
    if (!prev || (item.name?.length || 0) > (prev.name?.length || 0)) {
      byKey.set(key, item);
    }
  });
  return Array.from(byKey.values());
}

export function mergeRicherCalendarEvent<T extends CalendarDedupeable>(keep: T, drop: T): T {
  const preferred = richness(keep) >= richness(drop) ? keep : drop;
  const other = preferred === keep ? drop : keep;
  const preferredTitle = calendarEventTitle(preferred);
  const otherTitle = calendarEventTitle(other);
  const title =
    preferredTitle.length >= otherTitle.length ? preferredTitle : otherTitle;

  return {
    ...preferred,
    description:
      (preferred.description?.trim().length || 0) >= (other.description?.trim().length || 0)
        ? preferred.description
        : other.description,
    location: preferred.location?.trim() ? preferred.location : other.location,
    url: preferred.url?.trim() ? preferred.url : other.url,
    attendees: mergeAttendees(preferred.attendees, other.attendees),
    summary: preferred.summary !== undefined || other.summary !== undefined ? title : preferred.summary,
    title: preferred.title !== undefined || other.title !== undefined ? title : preferred.title,
    name: preferred.name !== undefined || other.name !== undefined ? title : preferred.name,
  };
}

function eventsMatch<T extends CalendarDedupeable>(a: T, b: T): boolean {
  if (calendarEventStartKey(a.start, a.allDay) !== calendarEventStartKey(b.start, b.allDay)) {
    return false;
  }
  if (!locationsCompatible(a.location, b.location)) return false;
  return titlesAreSimilar(calendarEventTitle(a), calendarEventTitle(b));
}

/**
 * Groups by start-minute (or all-day date) + similar title + compatible location.
 * Distinct times or dissimilar locations stay separate.
 */
export function dedupeSimilarCalendarEvents<T extends CalendarDedupeable>(
  events: T[],
): DedupeSimilarResult<T> {
  const unique: T[] = [];

  events.forEach((event) => {
    const idx = unique.findIndex((existing) => eventsMatch(existing, event));
    if (idx === -1) {
      unique.push(event);
      return;
    }
    unique[idx] = mergeRicherCalendarEvent(unique[idx], event);
  });

  return {
    events: unique,
    hidden: Math.max(0, events.length - unique.length),
  };
}
