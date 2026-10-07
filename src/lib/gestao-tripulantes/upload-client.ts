/**
 * Helper client-side: upload de documento GT em 3 passos via signed URL
 * (o arquivo vai DIRETO do browser para o Supabase Storage, sem passar
 * pela Function — por isso suporta até 50MB).
 *
 * 1) POST /documentos/upload-url  → { path, token }
 * 2) storage.uploadToSignedUrl(path, token, file)
 * 3) POST /documentos             → registro em gt_documentos
 *
 * Lança Error com mensagem pt-BR pronta para toast.
 */

import { supabase } from '@/lib/supabase';
import { fetchWithToken } from '@/lib/tokenStorage';
import { GT_DOC_BUCKET, GT_DOC_MAX_BYTES, formatarMb } from '@/lib/gestao-tripulantes/documento-limits';

export { GT_DOC_MAX_BYTES };

export interface UploadDocumentoGtInput {
  file: File;
  colaboradorId: string;
  tipoDocumento?: string | null;
  titulo?: string | null;
  subtipo?: string | null;
  descricao?: string | null;
  numeroDocumento?: string | null;
  orgaoEmissor?: string | null;
  dataEmissao?: string | null;
  dataValidade?: string | null;
  quarentena?: boolean;
  /** Fluxo "anexar arquivo a registro existente" (TreinamentosTab). */
  documentoId?: string | null;
}

export interface UploadDocumentoGtResult {
  success: boolean;
  data: any;
  merged?: boolean;
  message?: string;
}

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

async function sha256Hex(file: File): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Navegador sem suporte a cálculo de hash seguro. Acesse o portal via HTTPS.');
  }
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function lerErro(res: Response, fallback: string): Promise<Error> {
  try {
    const json = await res.json();
    return new Error(json?.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function uploadDocumentoGt(input: UploadDocumentoGtInput): Promise<UploadDocumentoGtResult> {
  const { file } = input;

  if (file.size > GT_DOC_MAX_BYTES) {
    throw new Error(`Arquivo muito grande (${formatarMb(file.size)}). Tamanho máximo: 50MB`);
  }

  const arquivo_hash = await sha256Hex(file);

  // 1) signed upload URL
  const urlRes = await fetchWithToken('/api/gestao-tripulantes/documentos/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      colaborador_id: input.colaboradorId,
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
    }),
  });
  if (!urlRes.ok) throw await lerErro(urlRes, 'Falha ao preparar upload');
  const { path, token } = await urlRes.json();

  // 2) upload direto ao Storage
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const contentType = file.type || EXT_MIME[ext] || 'application/octet-stream';
  const { error: upErr } = await supabase.storage
    .from(GT_DOC_BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType });
  if (upErr) {
    throw new Error(`Falha ao enviar arquivo: ${upErr.message}`);
  }

  // 3) registro de metadata
  const metaRes = await fetchWithToken('/api/gestao-tripulantes/documentos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      colaborador_id: input.colaboradorId,
      tipo_documento: input.tipoDocumento ?? undefined,
      subtipo: input.subtipo ?? undefined,
      titulo: input.titulo ?? undefined,
      descricao: input.descricao ?? undefined,
      numero_documento: input.numeroDocumento ?? undefined,
      orgao_emissor: input.orgaoEmissor ?? undefined,
      data_emissao: input.dataEmissao ?? undefined,
      data_validade: input.dataValidade ?? undefined,
      quarentena: input.quarentena === true,
      documento_id: input.documentoId ?? undefined,
      arquivo_path: path,
      arquivo_hash,
      arquivo_tamanho_bytes: file.size,
      nome_arquivo: file.name,
    }),
  });
  if (!metaRes.ok) throw await lerErro(metaRes, 'Falha ao registrar documento');

  return metaRes.json();
}
