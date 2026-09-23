/**
 * Testes puros do A1 único — PKCS#12 gerado em memória (sem bucket, sem senha real).
 * Rodar: npx tsx --test src/lib/certificado-a1.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import forge from 'node-forge';
import { inspecionarPfx } from './certificado-a1';

function gerarPfx(passphrase: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 3600_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600_000);
  const attrs = [
    { name: 'commonName', value: 'ABZ GROUP A1 TESTE' },
    { name: 'organizationName', value: 'ABZ' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer([{ name: 'commonName', value: 'AC TESTE ICP' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');
}

describe('certificado-a1 — inspeção PKCS#12', () => {
  it('extrai fingerprint SHA-256, CN e validade sem vazar a senha', () => {
    const senha = 'senha-fixture';
    const pfx = gerarPfx(senha);
    const info = inspecionarPfx(pfx, senha);
    assert.equal(info.subjectCn, 'ABZ GROUP A1 TESTE');
    assert.equal(info.emissor, 'AC TESTE ICP');
    assert.equal(info.fingerprint.length, 64);
    assert.match(info.fingerprint, /^[0-9a-f]{64}$/);
    assert.match(info.validoAte ?? '', /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(JSON.stringify(info).includes(senha), false);
  });

  it('senha errada lança', () => {
    const pfx = gerarPfx('certa');
    assert.throws(() => inspecionarPfx(pfx, 'errada'));
  });
});
