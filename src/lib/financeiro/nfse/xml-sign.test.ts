/**
 * Testes da assinatura XMLDSig (fixtures geradas em memória com node-forge —
 * nenhum certificado real). Rodar: npx tsx --test src/lib/financeiro/nfse/xml-sign.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { assinarXml, assinarVarios, extrairDePfx } from './xml-sign';

const SENHA_PFX = 'senha-teste';

function gerarChaveECertificado(): { chavePem: string; certPem: string } {
  const chaves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 3600_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600_000);
  const atributos = [{ name: 'commonName', value: 'TESTE NFSE ABZ' }];
  cert.setSubject(atributos);
  cert.setIssuer(atributos);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  return {
    chavePem: forge.pki.privateKeyToPem(chaves.privateKey),
    certPem: forge.pki.certificateToPem(cert),
  };
}

const LOTE = `<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"><LoteRps versao="2.02" Id="lote1"><NumeroLote>1</NumeroLote><ListaRps><Rps><InfDeclaracaoPrestacaoServico Id="rps1"><Rps><IdentificacaoRps><Numero>1</Numero><Serie>1</Serie><Tipo>1</Tipo></IdentificacaoRps><DataEmissao>2026-09-22</DataEmissao><Status>1</Status></Rps><Servico><Valores><ValorServicos>1000.00</ValorServicos></Valores></Servico></InfDeclaracaoPrestacaoServico></Rps></ListaRps></LoteRps></EnviarLoteRpsEnvio>`;

describe('xml-sign', () => {
  let chaves: { chavePem: string; certPem: string };

  before(() => {
    chaves = gerarChaveECertificado();
  });

  it('assina XMLDSig com estrutura SignedInfo/Reference/X509 corretas', () => {
    const assinado = assinarXml(LOTE, { certificadoPem: chaves.certPem, chavePrivadaPem: chaves.chavePem }, {
      xpathAlvo: "//*[@Id='rps1']",
      uri: '#rps1',
    });
    assert.ok(assinado.includes('<Signature'), 'deve conter <Signature>');
    assert.ok(assinado.includes('http://www.w3.org/2001/10/xml-exc-c14n#'), 'C14N exclusiva');
    assert.ok(
      assinado.includes('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'),
      'SignatureMethod rsa-sha256',
    );
    assert.ok(assinado.includes('http://www.w3.org/2000/09/xmldsig#enveloped-signature'), 'transform enveloped');
    assert.ok(
      assinado.includes('http://www.w3.org/2001/04/xmlenc#sha256'),
      'DigestMethod sha256',
    );
    assert.ok(assinado.includes('<Reference URI="#rps1">'), 'Reference URI aponta o Id do elemento');
    const digest = /<DigestValue>([^<]+)<\/DigestValue>/.exec(assinado)?.[1] ?? '';
    const assinatura = /<SignatureValue>([^<]+)<\/SignatureValue>/.exec(assinado)?.[1] ?? '';
    assert.ok(digest.length > 20, 'DigestValue base64 presente');
    assert.equal(digest, Buffer.from(digest, 'base64').toString('base64'), 'DigestValue é base64');
    assert.ok(assinatura.length > 100, 'SignatureValue base64 presente');
    assert.ok(assinado.includes('<X509Certificate>'), 'X509Certificate no KeyInfo');
    // Signature anexada DENTRO do elemento assinado:
    assert.ok(/<InfDeclaracaoPrestacaoServico Id="rps1">[\s\S]*<Signature[\s>]/.test(assinado));
  });

  it('assinatura verificada criptograficamente pelo xml-crypto (e falha com adulteração)', () => {
    const assinado = assinarXml(LOTE, { certificadoPem: chaves.certPem, chavePrivadaPem: chaves.chavePem }, {
      xpathAlvo: "//*[@Id='rps1']",
      uri: '#rps1',
    });
    const fragmento = /<Signature[\s>][\s\S]*?<\/Signature>/.exec(assinado)?.[0] ?? '';
    assert.ok(fragmento.length > 0, 'assinatura extraível do documento');

    const verificador = new SignedXml({ publicCert: chaves.certPem });
    verificador.loadSignature(fragmento);
    assert.equal(verificador.checkSignature(assinado), true, 'assinatura válida verifica');

    const adulterado = assinado.replace('<ValorServicos>1000.00</ValorServicos>', '<ValorServicos>9999.00</ValorServicos>');
    const verificador2 = new SignedXml({ publicCert: chaves.certPem });
    verificador2.loadSignature(fragmento);
    assert.equal(verificador2.checkSignature(adulterado), false, 'documento alterado não verifica');
  });

  it('assinarVarios encadeia assinaturas de múltiplos elementos e todas verificam', () => {
    const doisRps = LOTE.replace(
      '</ListaRps>',
      '</Rps><Rps><InfDeclaracaoPrestacaoServico Id="rps2"><Rps><IdentificacaoRps><Numero>2</Numero><Serie>1</Serie><Tipo>1</Tipo></IdentificacaoRps><DataEmissao>2026-09-22</DataEmissao><Status>1</Status></Rps></InfDeclaracaoPrestacaoServico></Rps></ListaRps>',
    );
    const assinado = assinarVarios(
      doisRps,
      { certificadoPem: chaves.certPem, chavePrivadaPem: chaves.chavePem },
      [
        { xpathAlvo: "//*[@Id='rps1']", uri: '#rps1' },
        { xpathAlvo: "//*[@Id='rps2']", uri: '#rps2' },
      ],
    );
    // xml-crypto renderiza <Signature xmlns="...">:
    assert.equal((assinado.match(/<Signature[\s>]/g) ?? []).length, 2, 'duas assinaturas no documento');
    // Verificação de cada assinatura individualmente (loadSignature espera 1):
    const fragmentos = assinado.match(/<Signature[\s>][\s\S]*?<\/Signature>/g) ?? [];
    assert.equal(fragmentos.length, 2);
    for (const fragmento of fragmentos) {
      const verificador = new SignedXml({ publicCert: chaves.certPem });
      verificador.loadSignature(fragmento);
      assert.equal(verificador.checkSignature(assinado), true);
    }
  });

  it('extrairDePfx recupera chave e certificado de um .pfx gerado (senha correta/incorreta)', () => {
    const chavesNovas = gerarChaveECertificado();
    const cert = forge.pki.certificateFromPem(chavesNovas.certPem);
    const chave = forge.pki.privateKeyFromPem(chavesNovas.chavePem);
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(chave, cert, SENHA_PFX);
    const pfx = Buffer.from(forge.asn1.toDer(p12Asn1).data, 'binary');

    const material = extrairDePfx(pfx, SENHA_PFX);
    assert.equal(material.certificadoPem, chavesNovas.certPem);
    assert.equal(material.chavePrivadaPem, chavesNovas.chavePem);
    assert.ok(material.certificadoDerBase64.length > 100);

    assert.throws(() => extrairDePfx(pfx, 'senha-errada'), /inválido ou senha incorreta/);
  });

  it('algoritmoSha=sha1 legado declara rsa-sha1/sha1', () => {
    const assinado = assinarXml(
      LOTE,
      { certificadoPem: chaves.certPem, chavePrivadaPem: chaves.chavePem },
      { xpathAlvo: "//*[@Id='rps1']", uri: '#rps1', algoritmoSha: 'sha1' },
    );
    assert.ok(assinado.includes('http://www.w3.org/2000/09/xmldsig#rsa-sha1'));
    assert.ok(assinado.includes('http://www.w3.org/2000/09/xmldsig#sha1'));
  });
});
