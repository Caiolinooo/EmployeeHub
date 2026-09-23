/**
 * Assinatura XMLDSig RSA-SHA256 (padrão ABRASF/NFS-e) — §5.1 do design.
 *
 * - Extração de chave privada + certificado do .pfx A1 via node-forge
 *   (já presente nas deps do repo — nenhuma dependência nova adicionada).
 * - Assinatura enveloped com xml-crypto (também já nas deps):
 *   transforms enveloped-signature + exclusive-c14n, Digest SHA-256,
 *   SignatureMethod rsa-sha256, X509Certificate no KeyInfo.
 *
 * Funções puras (PEMs → XML assinado) — testável com tsx --test com fixtures
 * geradas em memória (nenhum certificado real nos testes).
 */
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

const C14N_EXC = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const TRANSFORM_ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const DIGEST_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const DIGEST_SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';

export interface ChavesAssinatura {
  certificadoPem: string;
  chavePrivadaPem: string;
}

export interface OpcoesAssinatura {
  /** XPath do elemento a assinar (a Signature é anexada DENTRO dele). */
  xpathAlvo: string;
  /** URI da Reference (ex. '#rps1'); derivada do atributo Id quando ausente. */
  uri?: string;
  /** SHA-256 (padrão do design); 'sha1' para municípios legados. */
  algoritmoSha?: 'sha256' | 'sha1';
}

/* ------------------------------------------------------------------ */
/* Extração do .pfx (cert A1)                                          */
/* ------------------------------------------------------------------ */

export interface MaterialPfx extends ChavesAssinatura {
  /** Certificado em DER base64 (para KeyInfo/X509Certificate e uploads). */
  certificadoDerBase64: string;
}

/** Extrai chave privada + certificado de um arquivo PKCS#12 (.pfx/.p12). */
export function extrairDePfx(pfx: Buffer | Uint8Array, senha: string): MaterialPfx {
  const der = forge.util.createBuffer(Buffer.from(pfx).toString('binary'));
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, senha);
  } catch {
    throw new Error('Certificado .pfx inválido ou senha incorreta.');
  }
  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certificado = certBag[forge.pki.oids.certBag]?.[0]?.cert;
  if (!certificado) throw new Error('Certificado .pfx não contém certificado X.509.');
  const keyBags = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  });
  const chave =
    keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0]?.key;
  if (!chave) throw new Error('Certificado .pfx não contém chave privada.');
  const certAsn1 = forge.pki.certificateToAsn1(certificado);
  return {
    certificadoPem: forge.pki.certificateToPem(certificado),
    chavePrivadaPem: forge.pki.privateKeyToPem(chave),
    certificadoDerBase64: forge.util.encode64(forge.asn1.toDer(certAsn1).getBytes()),
  };
}

/* ------------------------------------------------------------------ */
/* Assinatura XMLDSig enveloped                                        */
/* ------------------------------------------------------------------ */

/**
 * Devolve o XML com <Signature> anexada dentro do elemento apontado por
 * xpathAlvo (assinatura enveloped sobre aquele elemento).
 */
export function assinarXml(xml: string, chaves: ChavesAssinatura, opcoes: OpcoesAssinatura): string {
  const sha = opcoes.algoritmoSha ?? 'sha256';
  const sig = new SignedXml({
    privateKey: chaves.chavePrivadaPem,
    publicCert: chaves.certificadoPem,
    signatureAlgorithm: sha === 'sha1' ? RSA_SHA1 : RSA_SHA256,
    canonicalizationAlgorithm: C14N_EXC,
  });
  sig.addReference({
    xpath: opcoes.xpathAlvo,
    transforms: [TRANSFORM_ENVELOPED, C14N_EXC],
    digestAlgorithm: sha === 'sha1' ? DIGEST_SHA1 : DIGEST_SHA256,
    ...(opcoes.uri ? { uri: opcoes.uri } : {}),
  });
  sig.computeSignature(xml, {
    location: { reference: opcoes.xpathAlvo, action: 'append' },
  });
  return sig.getSignedXml();
}

/**
 * Assina múltiplos elementos (ex. cada InfDeclaracaoPrestacaoServico do lote)
 * encadeando as assinaturas no mesmo documento — cada Reference cobre apenas
 * o próprio elemento, então assinaturas anteriores permanecem válidas.
 */
export function assinarVarios(
  xml: string,
  chaves: ChavesAssinatura,
  alvos: Array<{ xpathAlvo: string; uri?: string }>,
  algoritmoSha?: 'sha256' | 'sha1',
): string {
  let atual = xml;
  for (const alvo of alvos) {
    atual = assinarXml(atual, chaves, { ...alvo, algoritmoSha });
  }
  return atual;
}
