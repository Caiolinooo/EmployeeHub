import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fetchWithSafeRedirects,
  MAX_SAFE_REDIRECT_HOPS,
} from './fetch-with-safe-redirects';
import { UnsafeUrlError } from './safe-url';

const ALLOWED = ['calendar.google.com'] as const;
const START = 'https://calendar.google.com/calendar/ical/start.ics';

function redirectResponse(status: number, location: string): Response {
  return new Response(null, {
    status,
    headers: { Location: location },
  });
}

function okResponse(body = 'ok'): Response {
  return new Response(body, { status: 200 });
}

describe('fetchWithSafeRedirects', () => {
  it('follows an allowlisted redirect and returns the final body', async () => {
    const calls: Array<{ href: string; redirect?: RequestRedirect }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const href = String(input);
      calls.push({ href, redirect: init?.redirect });
      if (href === START) {
        return redirectResponse(302, 'https://calendar.google.com/calendar/ical/final.ics');
      }
      return okResponse('BEGIN:VCALENDAR');
    };

    const response = await fetchWithSafeRedirects(START, { cache: 'no-store' }, {
      allowedHosts: ALLOWED,
      fetchImpl,
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'BEGIN:VCALENDAR');
    assert.deepEqual(calls, [
      { href: START, redirect: 'manual' },
      { href: 'https://calendar.google.com/calendar/ical/final.ics', redirect: 'manual' },
    ]);
  });

  it('rejects a redirect to a private IPv4 address', async () => {
    const fetchImpl: typeof fetch = async () =>
      redirectResponse(302, 'https://127.0.0.1/secret.ics');

    await assert.rejects(
      () => fetchWithSafeRedirects(START, {}, { allowedHosts: ALLOWED, fetchImpl }),
      UnsafeUrlError,
    );
  });

  it('rejects a redirect to a mapped-IPv6 loopback', async () => {
    const fetchImpl: typeof fetch = async () =>
      redirectResponse(302, 'https://[::ffff:7f00:1]/secret.ics');

    await assert.rejects(
      () => fetchWithSafeRedirects(START, {}, { allowedHosts: ALLOWED, fetchImpl }),
      UnsafeUrlError,
    );
  });

  it('rejects a redirect to a 6to4 loopback', async () => {
    const fetchImpl: typeof fetch = async () =>
      redirectResponse(302, 'https://[2002:7f00:1::]/secret.ics');

    await assert.rejects(
      () => fetchWithSafeRedirects(START, {}, { allowedHosts: ALLOWED, fetchImpl }),
      UnsafeUrlError,
    );
  });

  it('rejects a redirect to an IPv4-translated loopback', async () => {
    const fetchImpl: typeof fetch = async () =>
      redirectResponse(302, 'https://[::ffff:0:7f00:1]/secret.ics');

    await assert.rejects(
      () => fetchWithSafeRedirects(START, {}, { allowedHosts: ALLOWED, fetchImpl }),
      UnsafeUrlError,
    );
  });

  it('rejects a redirect to a non-allowlisted host', async () => {
    const fetchImpl: typeof fetch = async () =>
      redirectResponse(301, 'https://evil.example/cal.ics');

    await assert.rejects(
      () => fetchWithSafeRedirects(START, {}, { allowedHosts: ALLOWED, fetchImpl }),
      UnsafeUrlError,
    );
  });

  it('rejects more than 3 hops even when every host is allowlisted', async () => {
    const hops = [
      START,
      'https://calendar.google.com/1',
      'https://calendar.google.com/2',
      'https://calendar.google.com/3',
      'https://calendar.google.com/4',
    ];
    let index = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const href = String(input);
      assert.equal(href, hops[index]);
      index += 1;
      return redirectResponse(302, hops[index]);
    };

    await assert.rejects(
      () => fetchWithSafeRedirects(START, {}, {
        allowedHosts: ALLOWED,
        fetchImpl,
        maxHops: MAX_SAFE_REDIRECT_HOPS,
      }),
      (error: unknown) => {
        assert.ok(error instanceof UnsafeUrlError);
        assert.match(error.message, /redirecionamentos/i);
        return true;
      },
    );
    assert.equal(index, MAX_SAFE_REDIRECT_HOPS + 1);
  });

  it('resolves a relative Location against the current URL', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const href = String(input);
      if (href === START) {
        return redirectResponse(307, '/calendar/ical/relative.ics');
      }
      assert.equal(href, 'https://calendar.google.com/calendar/ical/relative.ics');
      return okResponse('rel');
    };

    const response = await fetchWithSafeRedirects(START, {}, {
      allowedHosts: ALLOWED,
      fetchImpl,
    });
    assert.equal(await response.text(), 'rel');
  });
});
