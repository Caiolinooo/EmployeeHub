import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { UnsafeUrlError, resolvePdfExtractUrl } from '../../../lib/security/safe-url';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
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

const previous = {
  supabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
  app: process.env.NEXT_PUBLIC_APP_URL,
  site: process.env.NEXT_PUBLIC_SITE_URL,
};

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function headPdf(
  raw: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; href: string } | { ok: false; status: number }> {
  const safe = resolvePdfExtractUrl(raw);
  if (safe.protocol !== 'https:') {
    throw new UnsafeUrlError('PDF deve ser https');
  }
  const response = await fetchImpl(safe.href, { method: 'HEAD', cache: 'no-cache' });
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, href: safe.href };
}

describe('pdf-extract outbound', () => {
  afterEach(() => {
    restoreEnv('NEXT_PUBLIC_SUPABASE_URL', previous.supabase);
    restoreEnv('NEXT_PUBLIC_APP_URL', previous.app);
    restoreEnv('NEXT_PUBLIC_SITE_URL', previous.site);
  });

  it('HEADs an allowlisted Supabase URL via mocked fetch', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(null, { status: 200 });
    };

    const result = await headPdf(
      'https://abc.supabase.co/storage/v1/object/public/docs/manual.pdf',
      fetchImpl,
    );
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
      'https://abc.supabase.co/storage/v1/object/public/docs/manual.pdf',
    ]);
  });

  it('does not fetch a foreign host, private IP or javascript:', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    let fetched = false;
    const fetchImpl: typeof fetch = async () => {
      fetched = true;
      return new Response(null, { status: 200 });
    };

    await assert.rejects(
      () => headPdf('https://evil.example/secret.pdf', fetchImpl),
      UnsafeUrlError,
    );
    await assert.rejects(() => headPdf('https://127.0.0.1/x.pdf', fetchImpl), UnsafeUrlError);
    await assert.rejects(() => headPdf('javascript:alert(1)', fetchImpl), UnsafeUrlError);
    assert.equal(fetched, false);
  });
});

const ALLOWED_PDF = 'https://abc.supabase.co/storage/v1/object/public/docs/manual.pdf';

function pdfRequest(headers?: HeadersInit, url = ALLOWED_PDF): NextRequest {
  return new NextRequest(`http://localhost/api/pdf-extract?url=${encodeURIComponent(url)}`, {
    headers,
  });
}

type PdfGet = (req: NextRequest) => Promise<Response>;

async function loadPdfGet(): Promise<PdfGet> {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  const mod = await import('./route');
  const interop = mod as unknown as { GET?: PdfGet; default?: { GET: PdfGet } };
  const handler = interop.GET ?? interop.default?.GET;
  if (typeof handler !== 'function') {
    throw new Error('GET handler not exported');
  }
  return handler;
}

function signRouteToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}

describe('pdf-extract GET auth', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchCalls = 0;
  });

  function mockHeadFetch() {
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch;
  }

  it('returns 401 without token and does not HEAD the PDF', async () => {
    const GET = await loadPdfGet();
    mockHeadFetch();
    const res = await GET(pdfRequest());
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
    assert.equal(fetchCalls, 0);
  });

  it('returns 401 for an invalid token and does not HEAD the PDF', async () => {
    const GET = await loadPdfGet();
    mockHeadFetch();
    const res = await GET(pdfRequest({ authorization: 'Bearer not-a-jwt' }));
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
    assert.equal(fetchCalls, 0);
  });

  it('returns 401 when payload has no userId', async () => {
    const GET = await loadPdfGet();
    mockHeadFetch();
    const token = signRouteToken({ phoneNumber: '', role: 'USER' });
    const res = await GET(pdfRequest({ authorization: `Bearer ${token}` }));
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'Unauthorized');
    assert.equal(fetchCalls, 0);
  });

  it('valid token reaches existing extract logic via mocked HEAD', async () => {
    const GET = await loadPdfGet();
    mockHeadFetch();
    const token = signRouteToken({ userId: 'user-1', phoneNumber: '', role: 'USER' });
    const res = await GET(pdfRequest({ authorization: `Bearer ${token}` }));
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.match(String(body.content), /Manual/);
    assert.equal(fetchCalls, 1);
  });

  it('accepts a valid token from the abzToken cookie', async () => {
    const GET = await loadPdfGet();
    mockHeadFetch();
    const token = signRouteToken({ userId: 'user-1', phoneNumber: '', role: 'USER' });
    const res = await GET(pdfRequest({ cookie: `abzToken=${token}` }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });
});
