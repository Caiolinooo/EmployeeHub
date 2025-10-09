/**
 * Minimal ICS (iCalendar) parser for VEVENT blocks.
 * - Handles line folding
 * - Extracts SUMMARY, DESCRIPTION, DTSTART, DTEND, LOCATION, UID, ATTENDEE, ORGANIZER
 */

export type IcsEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO
  end?: string;  // ISO
  allDay?: boolean;
  attendees?: Array<{ email: string; name?: string }>;
  organizer?: { email?: string; name?: string };
  raw?: Record<string, string | string[]>;
};

function unfoldLines(text: string): string {
  return text.replace(/\r?\n[ \t]/g, '');
}

function parseDate(val: string): { iso: string; allDay: boolean } | null {
  // Formats: YYYYMMDD or YYYYMMDDTHHMMSSZ or without Z
  if (!val) return null;
  const mDate = /^([0-9]{8})$/.exec(val);
  if (mDate) {
    const y = parseInt(val.slice(0, 4));
    const m = parseInt(val.slice(4, 6));
    const d = parseInt(val.slice(6, 8));
    const dt = new Date(Date.UTC(y, m - 1, d));
    return { iso: dt.toISOString(), allDay: true };
  }
  const mDateTimeZ = /^([0-9]{8})T([0-9]{6})Z$/.exec(val);
  if (mDateTimeZ) {
    const y = parseInt(val.slice(0, 4));
    const m = parseInt(val.slice(4, 6));
    const d = parseInt(val.slice(6, 8));
    const hh = parseInt(val.slice(9, 11));
    const mm = parseInt(val.slice(11, 13));
    const ss = parseInt(val.slice(13, 15));
    const dt = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
    return { iso: dt.toISOString(), allDay: false };
  }
  const mDateTime = /^([0-9]{8})T([0-9]{6})$/.exec(val);
  if (mDateTime) {
    const y = parseInt(val.slice(0, 4));
    const m = parseInt(val.slice(4, 6));
    const d = parseInt(val.slice(6, 8));
    const hh = parseInt(val.slice(9, 11));
    const mm = parseInt(val.slice(11, 13));
    const ss = parseInt(val.slice(13, 15));
    const dt = new Date(y, m - 1, d, hh, mm, ss); // local time
    return { iso: dt.toISOString(), allDay: false };
  }
  // Fallback: try Date.parse
  const dt = new Date(val);
  if (!isNaN(dt.getTime())) return { iso: dt.toISOString(), allDay: false };
  return null;
}

function decodeText(val: string): string {
  return val
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';');
}

export async function parseIcs(ics: string): Promise<IcsEvent[]> {
  const text = unfoldLines(ics);
  const blocks = text.split(/BEGIN:VEVENT/).slice(1).map(b => b.split(/END:VEVENT/)[0]);
  const events: IcsEvent[] = [];

  // Import crypto once for all events
  const { randomUUID } = await import('crypto');

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const fields: Record<string, string | string[]> = {};

    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      const nameAndParams = line.slice(0, idx);
      let value = line.slice(idx + 1);
      const name = nameAndParams.split(';')[0].toUpperCase();

      if (name === 'ATTENDEE') {
        const emailMatch = /mailto:([^;]+)/i.exec(value);
        const email = emailMatch ? emailMatch[1].trim() : value.trim();
        const cnMatch = /CN=([^;:]+)/i.exec(nameAndParams);
        const nameParam = cnMatch ? decodeURIComponent(cnMatch[1]) : undefined;
        const v = JSON.stringify({ email: email.replace(/^mailto:/i, ''), name: nameParam });
        (fields[name] as string[] | undefined)?.push?.(v) || (fields[name] = [v]);
        continue;
      }

      fields[name] = value;
    }

    const uid = String(fields['UID'] || '').trim() || `evt-${randomUUID()}`;
    const summary = decodeText(String(fields['SUMMARY'] || '').trim());
    const description = decodeText(String(fields['DESCRIPTION'] || '').trim());
    const location = decodeText(String(fields['LOCATION'] || '').trim());

    // DTSTART/DTEND may have parameters. If DATE or TZID exists, value is after ':' already handled.
    const startStr = String(fields['DTSTART'] || '').trim();
    const endStr = String(fields['DTEND'] || '').trim();
    const startParsed = parseDate(startStr);
    const endParsed = parseDate(endStr);

    if (!startParsed) continue;

    const attendeesRaw = (fields['ATTENDEE'] as string[] | undefined) || [];
    const attendees = attendeesRaw.map(x => {
      try { return JSON.parse(x) as { email: string; name?: string }; } catch { return { email: String(x) }; }
    });

    const organizer = (() => {
      const raw = String(fields['ORGANIZER'] || '');
      const emailMatch = /mailto:([^;]+)/i.exec(raw);
      const email = emailMatch ? emailMatch[1].trim() : undefined;
      const cnMatch = /CN=([^;:]+)/i.exec(raw);
      const name = cnMatch ? decodeURIComponent(cnMatch[1]) : undefined;
      if (!email && !name) return undefined;
      return { email, name };
    })();

    const evt: IcsEvent = {
      id: uid,
      summary,
      description: description || undefined,
      location: location || undefined,
      start: startParsed.iso,
      end: endParsed?.iso,
      allDay: startParsed.allDay,
      attendees,
      organizer,
      raw: fields
    };

    events.push(evt);
  }

  return events;
}

