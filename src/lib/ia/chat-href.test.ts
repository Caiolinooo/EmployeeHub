import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hrefFromSafeLink, parseSafeChatLink, sanitizeChatHref } from './chat-href';

describe('sanitizeChatHref', () => {
  it('allows http(s), mailto and relative paths as canonical hrefs', () => {
    assert.equal(sanitizeChatHref('https://example.com/a'), 'https://example.com/a');
    assert.equal(sanitizeChatHref('/dashboard'), '/dashboard');
    assert.ok(sanitizeChatHref('mailto:user@example.com')?.startsWith('mailto:'));
  });

  it('rebuilds from protocol literals, not the raw string', () => {
    const link = parseSafeChatLink('https://example.com/a?q=1#h');
    assert.ok(link && link.kind === 'https');
    assert.equal(hrefFromSafeLink(link), 'https://example.com/a?q=1#h');
    assert.equal(sanitizeChatHref('https://example.com/a'), 'https://example.com/a');
  });

  it('rejects javascript, vbscript, data, credentials and tricks', () => {
    assert.equal(sanitizeChatHref('javascript:alert(1)'), null);
    assert.equal(sanitizeChatHref('JAVASCRIPT:alert(1)'), null);
    assert.equal(sanitizeChatHref('  javascript:alert(1)'), null);
    assert.equal(sanitizeChatHref('\tjavascript:alert(1)'), null);
    assert.equal(sanitizeChatHref('vbscript:msgbox(1)'), null);
    assert.equal(sanitizeChatHref('data:text/html,hi'), null);
    assert.equal(sanitizeChatHref('https://user:pass@evil.example/'), null);
    assert.equal(sanitizeChatHref('//evil.example/x'), null);
  });
});
