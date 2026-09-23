/**
 * Certificado A1 único da empresa (ICP-Brasil).
 *
 * Fonte: tabela `esocial_certificados` + bucket `esocial-certificados`.
 * Um certificado ativo por vez — o mesmo A1 serve e-Social, NFS-e e qualquer
 * outro módulo que precise de mTLS ICP-Brasil. Não existe segundo upload
 * paralelo no financeiro.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import forge from 'node-forge';

export const BUCKET_CERTIFICADO_A1 = 'esocial-certificados';

export interface CertificadoA1Meta {
  id: string;
  nome: string;
  emissor: string | null;
  validoAte: string | null;
  ativo: boolean;
  fingerprint: string;
  subjectCn: string;
}

export interface CertificadoA1Carregado extends CertificadoA1Meta {
  pfx: Buffer;
  passphrase: string;
}

export interface CertificadoA1Temporario extends CertificadoA1Meta {
  pfxPath: string;
  pfxPassphrase: string;
}

export class CertificadoA1Error extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CertificadoA1Error';
    this.code = code;
  }
}

interface LinhaCertificado {
  id: string;
  nome: string;
  arquivo_path: string | null;
  senha_criptografada: string | null;
  emissor: string | null;
  valido_ate: string | null;
  ativo: boolean;
}

const cache = new Map<string, CertificadoA1Carregado>();

export function inspecionarPfx(pfx: Buffer, passphrase: string): {
  fingerprint: string;
  validoAte: string | null;
  subjectCn: string;
  emissor: string;
} {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')), passphrase);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  if (!cert) throw new CertificadoA1Error('pfx_sem_certificado', 'O arquivo .pfx não contém certificado X.509.');
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const fingerprint = crypto.createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex');
  const cn = cert.subject.getField('CN')?.value ?? '';
  const issuer = cert.issuer.getField('CN')?.value ?? '';
  const validoAte = cert.validity.notAfter instanceof Date
    ? cert.validity.notAfter.toISOString().slice(0, 10)
    : null;
  return { fingerprint, validoAte, subjectCn: String(cn), emissor: String(issuer) };
}

async function clienteAdmin() {
  const { supabaseAdmin } = await import('@/lib/supabase');
  return supabaseAdmin;
}

async function buscarLinha(id?: string): Promise<LinhaCertificado> {
  const supabaseAdmin = await clienteAdmin();
  let query = supabaseAdmin
    .from('esocial_certificados')
    .select('id, nome, arquivo_path, senha_criptografada, emissor, valido_ate, ativo')
    .order('created_at', { ascending: false })
    .limit(1);
  query = id ? query.eq('id', id) : query.eq('ativo', true);
  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    throw new CertificadoA1Error(
      'certificado_empresa_ausente',
      'Nenhum certificado A1 ativo cadastrado. Ative o certificado da empresa em e-Social.',
    );
  }
  return data as LinhaCertificado;
}

export async function carregarCertificadoA1(opts: { id?: string } = {}): Promise<CertificadoA1Carregado> {
  const chaveCache = opts.id || 'ativo';
  const cached = cache.get(chaveCache);
  if (cached) return cached;

  const linha = await buscarLinha(opts.id);
  if (!linha.arquivo_path || !linha.senha_criptografada) {
    throw new CertificadoA1Error(
      'certificado_incompleto',
      `Certificado '${linha.nome}' sem arquivo ou senha.`,
    );
  }

  const supabaseAdmin = await clienteAdmin();
  const { decryptPassword } = await import('@/lib/e-social/certificado');
  const { data: blob, error } = await supabaseAdmin.storage
    .from(BUCKET_CERTIFICADO_A1)
    .download(linha.arquivo_path);
  if (error || !blob) {
    throw new CertificadoA1Error(
      'certificado_indisponivel',
      `Falha ao baixar o A1 do bucket ${BUCKET_CERTIFICADO_A1}.`,
    );
  }

  const pfx = Buffer.from(await blob.arrayBuffer());
  const passphrase = decryptPassword(linha.senha_criptografada);
  const inspecao = inspecionarPfx(pfx, passphrase);
  const carregado: CertificadoA1Carregado = {
    id: linha.id,
    nome: linha.nome,
    emissor: linha.emissor || inspecao.emissor || null,
    validoAte: linha.valido_ate || inspecao.validoAte,
    ativo: linha.ativo,
    fingerprint: inspecao.fingerprint,
    subjectCn: inspecao.subjectCn,
    pfx,
    passphrase,
  };
  cache.set(linha.id, carregado);
  cache.set('ativo', carregado);
  return carregado;
}

/** Metadados públicos (sem senha, sem bytes do .pfx). */
export async function obterMetaCertificadoA1(): Promise<CertificadoA1Meta> {
  const c = await carregarCertificadoA1();
  return {
    id: c.id,
    nome: c.nome,
    emissor: c.emissor,
    validoAte: c.validoAte,
    ativo: c.ativo,
    fingerprint: c.fingerprint,
    subjectCn: c.subjectCn,
  };
}

/** Materializa o .pfx em arquivo temporário para o cliente mTLS do financeiro. */
export async function materializarCertificadoA1Temporario(): Promise<CertificadoA1Temporario> {
  const c = await carregarCertificadoA1();
  const tmp = path.join(os.tmpdir(), `a1-empresa-${c.id}-${Date.now()}.pfx`);
  fs.writeFileSync(tmp, c.pfx);
  return {
    id: c.id,
    nome: c.nome,
    emissor: c.emissor,
    validoAte: c.validoAte,
    ativo: c.ativo,
    fingerprint: c.fingerprint,
    subjectCn: c.subjectCn,
    pfxPath: tmp,
    pfxPassphrase: c.passphrase,
  };
}

export function limparCacheCertificadoA1(): void {
  cache.clear();
}
