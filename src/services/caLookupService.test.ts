import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONSULTA_CA_HOST,
  UnsafeUrlError,
  buildApiBaseCaepiLookupUrl,
  buildConsultaCaLookupUrl,
} from '../lib/security/safe-url';
import { CA_LOOKUP_ERROR_FORMAT, logCaLookupError } from './ca-lookup-log';

async function fetchConsultaCa(
  caNumber: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const url = buildConsultaCaLookupUrl(caNumber);
  if (url.protocol !== 'https:' || url.hostname !== CONSULTA_CA_HOST) {
    throw new UnsafeUrlError('Host consultaca.com não permitido');
  }
  return fetchImpl(url.href, { headers: { Accept: 'text/html' } });
}

async function fetchApiBaseCaepi(
  base: string,
  caNumber: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const url = buildApiBaseCaepiLookupUrl(base, caNumber);
  const configuredHost = new URL(base).hostname;
  if (url.protocol !== 'https:' || url.hostname !== configuredHost) {
    throw new UnsafeUrlError('Host API_BaseCAEPI não permitido');
  }
  return fetchImpl(url.href, { headers: { Accept: 'application/json' } });
}

describe('caLookupService outbound', () => {
  it('fetches consultaca.com for a valid CA', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, CONSULTA_CA_HOST);
      assert.equal(url.pathname, '/12345');
      return new Response('<html>ok</html>', { status: 200 });
    };
    const response = await fetchConsultaCa('12345', fetchImpl);
    assert.equal(response.status, 200);
  });

  it('fetches a public https API_BaseCAEPI host', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.href, 'https://caepi.example.com/api/ca/99');
      return new Response('{}', { status: 200 });
    };
    const response = await fetchApiBaseCaepi('https://caepi.example.com/api', '99', fetchImpl);
    assert.equal(response.status, 200);
  });

  it('rejects foreign host, private IP and javascript: without fetching', async () => {
    let fetched = false;
    const fetchImpl: typeof fetch = async () => {
      fetched = true;
      return new Response('nope', { status: 200 });
    };
    await assert.rejects(
      () => fetchApiBaseCaepi('http://caepi.example.com', '99', fetchImpl),
      UnsafeUrlError,
    );
    await assert.rejects(
      () => fetchApiBaseCaepi('https://127.0.0.1', '99', fetchImpl),
      UnsafeUrlError,
    );
    await assert.rejects(
      () => fetchApiBaseCaepi('javascript:alert(1)', '99', fetchImpl),
      UnsafeUrlError,
    );
    await assert.rejects(() => fetchConsultaCa('abc', fetchImpl), UnsafeUrlError);
    assert.equal(fetched, false);
  });
});

describe('caLookupService format string (#116)', () => {
  it('logs CA numbers as %s args, never in the format string', () => {
    const calls: unknown[][] = [];
    const write = ((...args: unknown[]) => {
      calls.push(args);
    }) as typeof console.error;
    const hostile = '12%s%s%x';
    const err = new Error('boom');
    logCaLookupError(hostile, err, write);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], CA_LOOKUP_ERROR_FORMAT);
    assert.equal(typeof calls[0][0], 'string');
    assert.equal(String(calls[0][0]).includes(hostile), false);
    assert.equal(String(calls[0][0]).includes('${'), false);
    assert.equal(calls[0][1], hostile);
    assert.equal(calls[0][2], err);
  });
});
