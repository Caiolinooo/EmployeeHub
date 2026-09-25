import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildConsultaCaHref } from './consulta-ca-url';

describe('buildConsultaCaHref', () => {
  it('builds a consultaca.com https URL for a numeric CA', () => {
    assert.equal(buildConsultaCaHref('12345'), 'https://consultaca.com/12345');
    assert.equal(buildConsultaCaHref(' 00001 '), 'https://consultaca.com/00001');
  });

  it('rejects scheme / host breakouts', () => {
    assert.equal(buildConsultaCaHref('javascript:alert(1)'), null);
    assert.equal(buildConsultaCaHref('https://evil.com'), null);
    assert.equal(buildConsultaCaHref('../evil'), null);
    assert.equal(buildConsultaCaHref('12345/../../evil'), null);
    assert.equal(buildConsultaCaHref('12345?x=1'), null);
    assert.equal(buildConsultaCaHref(''), null);
    assert.equal(buildConsultaCaHref(null), null);
  });
});
