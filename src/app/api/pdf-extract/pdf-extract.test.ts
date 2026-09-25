import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { UnsafeUrlError, resolvePdfExtractUrl } from '../../../lib/security/safe-url';

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
