import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  GOOGLE_CALENDAR_HOST,
  UnsafeUrlError,
  resolveCompanyCalendarIcsUrl,
} from '../../../../../lib/security/safe-url';

const originalEnv = process.env.COMPANY_CALENDAR_ICS_URL;

async function downloadIcs(raw: string, fetchImpl: typeof fetch): Promise<string> {
  const safe = resolveCompanyCalendarIcsUrl(raw);
  if (safe.protocol !== 'https:' || safe.hostname !== GOOGLE_CALENDAR_HOST) {
    if (safe.protocol !== 'https:') throw new UnsafeUrlError('ICS deve ser https');
  }
  const response = await fetchImpl(safe.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.text();
}

describe('company calendar ICS fetch', () => {
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.COMPANY_CALENDAR_ICS_URL;
    else process.env.COMPANY_CALENDAR_ICS_URL = originalEnv;
  });

  it('fetches an allowlisted Google Calendar ICS', async () => {
    delete process.env.COMPANY_CALENDAR_ICS_URL;
    const ics = 'BEGIN:VCALENDAR\nEND:VCALENDAR';
    const fetchImpl: typeof fetch = async (input) => {
      assert.equal(new URL(String(input)).hostname, GOOGLE_CALENDAR_HOST);
      return new Response(ics, { status: 200 });
    };
    const body = await downloadIcs(
      'https://calendar.google.com/calendar/ical/abz.midia%40gmail.com/public/basic.ics',
      fetchImpl,
    );
    assert.equal(body, ics);
  });

  it('rejects foreign host, private IP and javascript: without fetching', async () => {
    delete process.env.COMPANY_CALENDAR_ICS_URL;
    let fetched = false;
    const fetchImpl: typeof fetch = async () => {
      fetched = true;
      return new Response('nope', { status: 200 });
    };
    await assert.rejects(
      () => downloadIcs('https://evil.example/cal.ics', fetchImpl),
      UnsafeUrlError,
    );
    await assert.rejects(() => downloadIcs('https://192.168.0.10/cal.ics', fetchImpl), UnsafeUrlError);
    await assert.rejects(() => downloadIcs('javascript:alert(1)', fetchImpl), UnsafeUrlError);
    assert.equal(fetched, false);
  });
});
