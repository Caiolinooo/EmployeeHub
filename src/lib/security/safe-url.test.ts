import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  CONSULTA_CA_HOST,
  GOOGLE_CALENDAR_HOST,
  POLIWEB_HOST,
  UnsafeUrlError,
  buildApiBaseCaepiLookupUrl,
  buildConsultaCaLookupUrl,
  companyCalendarAllowedHosts,
  htmlUrlProtocol,
  isBlockedHostname,
  isBlockedHtmlUrlScheme,
  joinSafeUrl,
  parseSafeUrl,
  resolveCompanyCalendarIcsUrl,
  resolvePdfExtractUrl,
  resolvePoliwebUrl,
  shouldRewriteProxiedHtmlUrl,
} from './safe-url';

const ALLOW_EXAMPLE = ['example.com'] as const;

function assertUnsafe(fn: () => unknown): void {
  assert.throws(fn, UnsafeUrlError);
}

describe('parseSafeUrl', () => {
  it('allows an https allowlisted host', () => {
    const url = parseSafeUrl('https://example.com/file.pdf', {
      allowedHosts: ALLOW_EXAMPLE,
    });
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'example.com');
    assert.equal(url.pathname, '/file.pdf');
  });

  it('rejects a foreign host', () => {
    assertUnsafe(() =>
      parseSafeUrl('https://evil.example/x', { allowedHosts: ALLOW_EXAMPLE }),
    );
  });

  it('rejects private and loopback IPs', () => {
    for (const raw of [
      'https://127.0.0.1/secret',
      'https://10.0.0.5/x',
      'https://192.168.1.9/x',
      'https://172.16.0.2/x',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/x',
    ]) {
      assertUnsafe(() => parseSafeUrl(raw, { allowedHosts: ['127.0.0.1', '10.0.0.5', '192.168.1.9', '172.16.0.2', '169.254.169.254', 'localhost'] }));
    }
  });

  it('rejects IPv4-compatible ::/96 and NAT64 64:ff9b::/96 when the embedded IPv4 is private', () => {
    const embedded = [
      'https://[::127.0.0.1]/x',
      'https://[::7f00:1]/x',
      'https://[::10.0.0.1]/x',
      'https://[::169.254.169.254]/x',
      'https://[64:ff9b::127.0.0.1]/x',
      'https://[64:ff9b::a9fe:a9fe]/x',
    ];
    for (const raw of embedded) {
      const hostname = new URL(raw).hostname;
      assert.equal(isBlockedHostname(hostname), true, raw);
      assertUnsafe(() =>
        parseSafeUrl(raw, {
          allowedHosts: [hostname, '::7f00:1', '64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe'],
        }),
      );
    }
  });

  it('does not denylist a public IPv4 embedded in NAT64 (allowlist still applies)', () => {
    // 8.8.8.8 is not private/loopback/link-local, so the denylist lets it
    // through — same choice as ::ffff:808:808. parseSafeUrl still needs the host
    // on the allowlist.
    const raw = 'https://[64:ff9b::8.8.8.8]/x';
    const hostname = new URL(raw).hostname;
    assert.equal(hostname, '[64:ff9b::808:808]');
    assert.equal(isBlockedHostname(hostname), false, raw);
    const url = parseSafeUrl(raw, { allowedHosts: [hostname] });
    assert.equal(url.hostname, hostname);
    assertUnsafe(() => parseSafeUrl(raw, { allowedHosts: ALLOW_EXAMPLE }));
  });

  it('rejects IPv4-mapped IPv6 even when the canonical hostname is allowlisted', () => {
    const mapped = [
      'https://[::ffff:127.0.0.1]/x',
      'https://[::ffff:10.0.0.1]/x',
      'https://[::ffff:192.168.1.9]/x',
      'https://[::ffff:172.16.0.2]/x',
      'https://[::ffff:169.254.169.254]/latest/meta-data',
      'https://[::ffff:7f00:1]/x',
      'https://[::ffff:a00:1]/x',
      'https://[::ffff:c0a8:109]/x',
      'https://[::ffff:ac10:2]/x',
      'https://[0:0:0:0:0:ffff:127.0.0.1]/x',
      'https://[0:0:0:0:0:ffff:7f00:1]/x',
    ];
    for (const raw of mapped) {
      const hostname = new URL(raw).hostname;
      assert.equal(isBlockedHostname(hostname), true, raw);
      assertUnsafe(() =>
        parseSafeUrl(raw, {
          allowedHosts: [
            hostname,
            '127.0.0.1',
            '10.0.0.1',
            '192.168.1.9',
            '172.16.0.2',
            '169.254.169.254',
            '[::ffff:7f00:1]',
            '[::ffff:a00:1]',
            '[::ffff:c0a8:109]',
            '[::ffff:ac10:2]',
            '[0:0:0:0:0:ffff:127.0.0.1]',
            '[0:0:0:0:0:ffff:7f00:1]',
          ],
        }),
      );
    }
  });


  it('rejects non-https schemes', () => {
    assertUnsafe(() =>
      parseSafeUrl('http://example.com/x', { allowedHosts: ALLOW_EXAMPLE }),
    );
    assertUnsafe(() =>
      parseSafeUrl('ftp://example.com/x', { allowedHosts: ALLOW_EXAMPLE }),
    );
  });

  it('rejects javascript: and data: schemes', () => {
    assertUnsafe(() =>
      parseSafeUrl('javascript:alert(1)', { allowedHosts: ALLOW_EXAMPLE }),
    );
    assertUnsafe(() =>
      parseSafeUrl('data:text/html,hi', { allowedHosts: ALLOW_EXAMPLE }),
    );
  });

  it('rejects credentials in the URL', () => {
    assertUnsafe(() =>
      parseSafeUrl('https://user:pass@example.com/x', { allowedHosts: ALLOW_EXAMPLE }),
    );
  });
});

describe('joinSafeUrl', () => {
  it('joins a relative path onto a fixed https base', () => {
    const url = joinSafeUrl('https://consultaca.com', '12345', {
      allowedHosts: [CONSULTA_CA_HOST],
    });
    assert.equal(url.href, 'https://consultaca.com/12345');
  });

  it('rejects a path that escapes the base origin', () => {
    assertUnsafe(() =>
      joinSafeUrl('https://consultaca.com', '//evil.example/x', {
        allowedHosts: [CONSULTA_CA_HOST],
      }),
    );
  });
});

describe('html scheme checks', () => {
  it('parses javascript:/data:/vbscript: via URL.protocol', () => {
    assert.equal(htmlUrlProtocol('javascript:alert(1)'), 'javascript:');
    assert.equal(htmlUrlProtocol('data:text/html,hi'), 'data:');
    assert.equal(htmlUrlProtocol('vbscript:msgbox'), 'vbscript:');
    assert.equal(isBlockedHtmlUrlScheme('javascript:alert(1)'), true);
    assert.equal(isBlockedHtmlUrlScheme('DATA:text/html,hi'), true);
    assert.equal(isBlockedHtmlUrlScheme('vbscript:msgbox'), true);
    assert.equal(shouldRewriteProxiedHtmlUrl('javascript:alert(1)'), false);
    assert.equal(shouldRewriteProxiedHtmlUrl('/PainelEmpresa'), true);
    assert.equal(shouldRewriteProxiedHtmlUrl('mailto:a@b.com'), false);
    assert.equal(shouldRewriteProxiedHtmlUrl('#anchor'), false);
  });
});

describe('resolvePoliwebUrl', () => {
  it('builds the login path on the Poliweb host', () => {
    const url = resolvePoliwebUrl('/PainelEmpresa');
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, POLIWEB_HOST);
    assert.equal(url.pathname, '/PainelEmpresa');
  });

  it('rejects a path that points at a foreign host', () => {
    assertUnsafe(() => resolvePoliwebUrl('https://evil.example/x'));
    assertUnsafe(() => resolvePoliwebUrl('//evil.example/x'));
  });
});

describe('CA lookup URLs', () => {
  it('builds consultaca.com from digits only', () => {
    const url = buildConsultaCaLookupUrl('12.345');
    assert.equal(url.href, 'https://consultaca.com/12345');
    assert.equal(url.hostname, CONSULTA_CA_HOST);
  });

  it('builds API_BaseCAEPI from a configured https host', () => {
    const url = buildApiBaseCaepiLookupUrl('https://caepi.example.com/api', '99');
    assert.equal(url.href, 'https://caepi.example.com/api/ca/99');
  });

  it('rejects a private API_BaseCAEPI base', () => {
    assertUnsafe(() => buildApiBaseCaepiLookupUrl('https://127.0.0.1:8000', '99'));
    assertUnsafe(() => buildApiBaseCaepiLookupUrl('http://caepi.example.com', '99'));
    assertUnsafe(() => buildApiBaseCaepiLookupUrl('https://[::ffff:127.0.0.1]:8000', '99'));
    assertUnsafe(() => buildApiBaseCaepiLookupUrl('https://[::ffff:7f00:1]/api', '99'));
    assertUnsafe(() => buildApiBaseCaepiLookupUrl('https://[0:0:0:0:0:ffff:127.0.0.1]/api', '99'));
  });
});

describe('calendar ICS allowlist', () => {
  const originalEnv = process.env.COMPANY_CALENDAR_ICS_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.COMPANY_CALENDAR_ICS_URL;
    } else {
      process.env.COMPANY_CALENDAR_ICS_URL = originalEnv;
    }
  });

  it('allows the Google Calendar host from the default constant', () => {
    delete process.env.COMPANY_CALENDAR_ICS_URL;
    assert.deepEqual(companyCalendarAllowedHosts(), [GOOGLE_CALENDAR_HOST]);
    const url = resolveCompanyCalendarIcsUrl(
      'https://calendar.google.com/calendar/ical/abz.midia%40gmail.com/public/basic.ics',
    );
    assert.equal(url.hostname, GOOGLE_CALENDAR_HOST);
  });

  it('rejects a foreign ICS host', () => {
    delete process.env.COMPANY_CALENDAR_ICS_URL;
    assertUnsafe(() => resolveCompanyCalendarIcsUrl('https://evil.example/cal.ics'));
  });

  it('rejects javascript: as an ICS URL', () => {
    assertUnsafe(() => resolveCompanyCalendarIcsUrl('javascript:alert(1)'));
  });

  it('adds the COMPANY_CALENDAR_ICS_URL host when it is public https', () => {
    process.env.COMPANY_CALENDAR_ICS_URL = 'https://ics.office.com/foo.ics';
    assert.ok(companyCalendarAllowedHosts().includes('ics.office.com'));
    const url = resolveCompanyCalendarIcsUrl('https://ics.office.com/bar.ics');
    assert.equal(url.hostname, 'ics.office.com');
  });
});

describe('pdf-extract URL', () => {
  const previous = {
    supabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
    app: process.env.NEXT_PUBLIC_APP_URL,
    site: process.env.NEXT_PUBLIC_SITE_URL,
  };

  afterEach(() => {
    restoreEnv('NEXT_PUBLIC_SUPABASE_URL', previous.supabase);
    restoreEnv('NEXT_PUBLIC_APP_URL', previous.app);
    restoreEnv('NEXT_PUBLIC_SITE_URL', previous.site);
  });

  it('allows a Supabase storage URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const url = resolvePdfExtractUrl('https://abc.supabase.co/storage/v1/object/public/docs/a.pdf');
    assert.equal(url.hostname, 'abc.supabase.co');
    assert.equal(url.protocol, 'https:');
  });

  it('joins a relative path onto the app URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://portal.groupabz.com';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const url = resolvePdfExtractUrl('/manual.pdf');
    assert.equal(url.href, 'https://portal.groupabz.com/manual.pdf');
  });

  it('rejects a foreign host, private IP and javascript:', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    assertUnsafe(() => resolvePdfExtractUrl('https://evil.example/x.pdf'));
    assertUnsafe(() => resolvePdfExtractUrl('https://127.0.0.1/x.pdf'));
    assertUnsafe(() => resolvePdfExtractUrl('javascript:alert(1)'));
    assertUnsafe(() => resolvePdfExtractUrl('http://abc.supabase.co/x.pdf'));
  });
});

describe('isBlockedHostname', () => {
  it('flags loopback, RFC1918 and link-local', () => {
    assert.equal(isBlockedHostname('127.0.0.1'), true);
    assert.equal(isBlockedHostname('10.1.2.3'), true);
    assert.equal(isBlockedHostname('169.254.1.1'), true);
    assert.equal(isBlockedHostname('::1'), true);
    assert.equal(isBlockedHostname('[::ffff:7f00:1]'), true);
    assert.equal(isBlockedHostname('::ffff:7f00:1'), true);
    assert.equal(isBlockedHostname('::ffff:a9fe:a9fe'), true);
    assert.equal(isBlockedHostname('::ffff:c0a8:109'), true);
    assert.equal(isBlockedHostname('::ffff:ac10:2'), true);
    assert.equal(isBlockedHostname('0:0:0:0:0:ffff:127.0.0.1'), true);
    assert.equal(isBlockedHostname('0:0:0:0:0:ffff:7f00:1'), true);
    assert.equal(isBlockedHostname('0:0:0:0:0:ffff:c0a8:109'), true);
    assert.equal(isBlockedHostname('::ffff:808:808'), false);
    assert.equal(isBlockedHostname('[::127.0.0.1]'), true);
    assert.equal(isBlockedHostname('[::7f00:1]'), true);
    assert.equal(isBlockedHostname('[::10.0.0.1]'), true);
    assert.equal(isBlockedHostname('[::169.254.169.254]'), true);
    assert.equal(isBlockedHostname('[64:ff9b::127.0.0.1]'), true);
    assert.equal(isBlockedHostname('[64:ff9b::a9fe:a9fe]'), true);
    assert.equal(isBlockedHostname('[64:ff9b::8.8.8.8]'), false);
    assert.equal(isBlockedHostname('example.com'), false);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
