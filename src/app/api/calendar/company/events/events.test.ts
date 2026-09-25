import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import {
  GOOGLE_CALENDAR_HOST,
  UnsafeUrlError,
  resolveCompanyCalendarIcsUrl,
} from '../../../../../lib/security/safe-url';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJyb2xlIjoiYW5vbiJ9',
    'placeholder',
  ].join('.');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = `eyJ${'A'.repeat(120)}`;
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-placeholder-not-for-production';
}

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

const ICS_FIXTURE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:auth-test-1',
  'SUMMARY:Evento Auth',
  'DTSTART:20260615T120000Z',
  'DTEND:20260615T130000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\n');

const ALLOWED_ICS =
  'https://calendar.google.com/calendar/ical/abz.midia%40gmail.com/public/basic.ics';

function calendarRequest(headers?: HeadersInit): NextRequest {
  const url = `http://localhost/api/calendar/company/events?url=${encodeURIComponent(ALLOWED_ICS)}&from=2026-01-01&to=2026-12-31`;
  return new NextRequest(url, { headers });
}

type CalendarGet = (req: NextRequest) => Promise<Response>;

async function loadCalendarGet(): Promise<CalendarGet> {
  const mod = await import('./route');
  const interop = mod as unknown as { GET?: CalendarGet; default?: { GET: CalendarGet } };
  const handler = interop.GET ?? interop.default?.GET;
  if (typeof handler !== 'function') {
    throw new Error('GET handler not exported');
  }
  return handler;
}

function signRouteToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}

describe('company calendar GET auth', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchCalls = 0;
  });

  function mockIcsFetch() {
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(ICS_FIXTURE, { status: 200 });
    }) as typeof fetch;
  }

  it('returns 401 without token and does not fetch ICS', async () => {
    const GET = await loadCalendarGet();
    mockIcsFetch();
    const res = await GET(calendarRequest());
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
    assert.equal(body.events, undefined);
    assert.equal(fetchCalls, 0);
  });

  it('returns 401 for an invalid token and does not fetch ICS', async () => {
    const GET = await loadCalendarGet();
    mockIcsFetch();
    const res = await GET(calendarRequest({ authorization: 'Bearer not-a-jwt' }));
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
    assert.equal(body.events, undefined);
    assert.equal(fetchCalls, 0);
  });

  it('returns 401 when payload has no userId', async () => {
    const GET = await loadCalendarGet();
    mockIcsFetch();
    const token = signRouteToken({ phoneNumber: '', role: 'USER' });
    const res = await GET(calendarRequest({ authorization: `Bearer ${token}` }));
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
    assert.equal(fetchCalls, 0);
  });

  it('valid token reaches existing ICS logic via mocked fetch', async () => {
    const GET = await loadCalendarGet();
    mockIcsFetch();
    const token = signRouteToken({ userId: 'user-1', phoneNumber: '', role: 'USER' });
    const res = await GET(calendarRequest({ authorization: `Bearer ${token}` }));
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.events));
    assert.equal(body.events[0]?.summary, 'Evento Auth');
    assert.equal(fetchCalls, 1);
  });

  it('does not serve in-memory cache without a token', async () => {
    const GET = await loadCalendarGet();
    mockIcsFetch();
    const token = signRouteToken({ userId: 'user-1', phoneNumber: '', role: 'USER' });
    const warm = await GET(calendarRequest({ authorization: `Bearer ${token}` }));
    assert.equal(warm.status, 200);
    const warmBody = await warm.json();
    assert.ok(Array.isArray(warmBody.events));
    const fetchesAfterWarm = fetchCalls;

    const leaked = await GET(calendarRequest());
    const leakedBody = await leaked.json();
    assert.equal(leaked.status, 401);
    assert.equal(leakedBody.error, 'Unauthorized');
    assert.equal(leakedBody.events, undefined);
    assert.equal(fetchCalls, fetchesAfterWarm);

    const invalid = await GET(calendarRequest({ authorization: 'Bearer not-a-jwt' }));
    const invalidBody = await invalid.json();
    assert.equal(invalid.status, 401);
    assert.equal(invalidBody.error, 'Unauthorized');
    assert.equal(invalidBody.events, undefined);
    assert.equal(fetchCalls, fetchesAfterWarm);
  });

  it('accepts a valid token from the abzToken cookie', async () => {
    const GET = await loadCalendarGet();
    mockIcsFetch();
    const token = signRouteToken({ userId: 'user-1', phoneNumber: '', role: 'USER' });
    const res = await GET(calendarRequest({ cookie: `abzToken=${token}` }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.events));
  });
});
