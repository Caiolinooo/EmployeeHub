import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import tls from 'tls';
import {
  buildEsocialHttpsTlsOptions,
  isEsocialInsecureTlsOptIn,
  loadEsocialCaBundle,
} from './tls';
import { ICP_BRASIL_CA_PEMS, ICP_BRASIL_V10_PEM, ICP_BRASIL_V5_PEM } from './icp-brasil-cas';

describe('e-Social TLS', () => {
  it('defaults to certificate validation ON', () => {
    assert.equal(isEsocialInsecureTlsOptIn(''), false);
    assert.equal(isEsocialInsecureTlsOptIn('1'), false);
    const opts = buildEsocialHttpsTlsOptions('');
    assert.equal(opts.rejectUnauthorized, true);
    assert.equal(opts.minVersion, 'TLSv1.2');
  });

  it('opt-in insecure only via existing NODE_TLS_REJECT_UNAUTHORIZED=0', () => {
    assert.equal(isEsocialInsecureTlsOptIn('0'), true);
    const opts = buildEsocialHttpsTlsOptions('0');
    assert.equal(opts.rejectUnauthorized, false);
  });

  it('does not treat other env values as insecure', () => {
    assert.equal(isEsocialInsecureTlsOptIn('1'), false);
    assert.equal(isEsocialInsecureTlsOptIn('true'), false);
    assert.equal(isEsocialInsecureTlsOptIn(''), false);
  });

  it('keeps Node default CAs and appends ICP-Brasil roots', () => {
    const bundle = loadEsocialCaBundle();
    assert.ok(bundle.length > tls.rootCertificates.length);
    assert.ok(ICP_BRASIL_CA_PEMS.every((pem) => bundle.includes(pem)));
    assert.ok(ICP_BRASIL_V5_PEM.includes('BEGIN CERTIFICATE'));
    assert.ok(ICP_BRASIL_V10_PEM.includes('BEGIN CERTIFICATE'));
    assert.ok(bundle.some((pem) => pem.includes(tls.rootCertificates[0].slice(0, 40))));
  });
});
