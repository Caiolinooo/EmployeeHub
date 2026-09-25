import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emailDomainMatches,
  hostnameMatches,
  isValidNonPlaceholderEmail,
  urlHostnameMatches,
} from './url-host';

describe('hostnameMatches', () => {
  it('accepts exact host and proper suffix', () => {
    assert.equal(hostnameMatches('mio.app.br', 'mio.app.br'), true);
    assert.equal(hostnameMatches('api.mio.app.br', 'mio.app.br'), true);
  });

  it('rejects attacker suffix tricks', () => {
    assert.equal(hostnameMatches('evil.com.attacker.net', 'evil.com'), false);
    assert.equal(hostnameMatches('mio.app.br.attacker.net', 'mio.app.br'), false);
    assert.equal(hostnameMatches('notmio.app.br.evil.com', 'mio.app.br'), false);
    assert.equal(hostnameMatches('placeholder.com.attacker.net', 'placeholder.com'), false);
  });
});

describe('urlHostnameMatches', () => {
  it('parses URL hostname instead of substring', () => {
    assert.equal(urlHostnameMatches('https://mio.app.br/api/v1', 'mio.app.br'), true);
    assert.equal(
      urlHostnameMatches('https://evil.com.attacker.net/mio.app.br', 'mio.app.br'),
      false
    );
    assert.equal(urlHostnameMatches('https://attacker.net/?q=mio.app.br', 'mio.app.br'), false);
    assert.equal(urlHostnameMatches('not-a-url', 'mio.app.br'), false);
  });
});

describe('emailDomainMatches / isValidNonPlaceholderEmail', () => {
  it('rejects placeholder.com and its subdomains', () => {
    assert.equal(emailDomainMatches('user@placeholder.com', 'placeholder.com'), true);
    assert.equal(emailDomainMatches('user@mail.placeholder.com', 'placeholder.com'), true);
    assert.equal(isValidNonPlaceholderEmail('user@placeholder.com'), false);
  });

  it('allows real domains that merely contain the substring', () => {
    assert.equal(emailDomainMatches('user@notplaceholder.com', 'placeholder.com'), false);
    assert.equal(isValidNonPlaceholderEmail('user@notplaceholder.com'), true);
    assert.equal(isValidNonPlaceholderEmail('user@groupabz.com'), true);
  });

  it('rejects attacker hosts and junk', () => {
    assert.equal(emailDomainMatches('a@evil.com.attacker.net', 'evil.com'), false);
    assert.equal(isValidNonPlaceholderEmail('no-at-sign'), false);
    assert.equal(isValidNonPlaceholderEmail('user@evil.com?placeholder.com'), false);
    assert.equal(isValidNonPlaceholderEmail(''), false);
  });
});
