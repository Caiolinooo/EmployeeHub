import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  POLIWEB_HOST,
  UnsafeUrlError,
  resolvePoliwebUrl,
  shouldRewriteProxiedHtmlUrl,
} from '../../../lib/security/safe-url';

async function fetchPoliweb(
  path: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const target = resolvePoliwebUrl(path);
  if (target.protocol !== 'https:' || target.hostname !== POLIWEB_HOST) {
    throw new UnsafeUrlError('Host Poliweb não permitido');
  }
  return fetchImpl(target.href, { redirect: 'manual' });
}

describe('poliweb-proxy outbound', () => {
  it('fetches only the Poliweb host', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, POLIWEB_HOST);
      assert.equal(url.pathname, '/PainelEmpresa');
      return new Response('<html></html>', { status: 200 });
    };
    const response = await fetchPoliweb('/PainelEmpresa', fetchImpl);
    assert.equal(response.status, 200);
  });

  it('rejects foreign host, private IP and javascript: without fetching', async () => {
    let fetched = false;
    const fetchImpl: typeof fetch = async () => {
      fetched = true;
      return new Response('nope', { status: 200 });
    };
    await assert.rejects(() => fetchPoliweb('https://evil.example/', fetchImpl), UnsafeUrlError);
    await assert.rejects(() => fetchPoliweb('https://127.0.0.1/', fetchImpl), UnsafeUrlError);
    await assert.rejects(() => fetchPoliweb('javascript:alert(1)', fetchImpl), UnsafeUrlError);
    assert.equal(fetched, false);
  });

  it('blocks javascript:/data:/vbscript: in HTML rewrite', () => {
    assert.equal(shouldRewriteProxiedHtmlUrl('javascript:alert(1)'), false);
    assert.equal(shouldRewriteProxiedHtmlUrl('data:text/html,x'), false);
    assert.equal(shouldRewriteProxiedHtmlUrl('vbscript:msgbox'), false);
    assert.equal(shouldRewriteProxiedHtmlUrl('/css/site.css'), true);
  });
});
