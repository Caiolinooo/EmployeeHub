/**
 * Copy MIO file bytes INTO our Supabase bucket. Never upload/overwrite MIO.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { calcularArquivoHash } from '@/lib/gestao-tripulantes/documento-integrity';
import { mioClient } from '@/lib/mio/client';

export const GT_DOC_BUCKET = 'gestao-tripulantes-documentos';

const URL_FIELD_KEYS = [
  'anexo_url', 'url_anexo', 'arquivo_url', 'file_url', 'hiperlink_externo',
  'hiperlink', 'link', 'documento_url', 'pdf_url', 'attachment_url', 'url',
  'URL Anexo', 'Url Anexo', 'Anexo', 'arquivo', 'path', 'download_url',
];

function extFromContentType(contentType: string, fallback = 'bin'): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('pdf')) return 'pdf';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  return fallback;
}

function isOurStorageUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('supabase.co/storage/') || url.includes('/gestao-tripulantes-documentos/');
}

function isMioHostUrl(url?: string | null): boolean {
  if (!url) return false;
  return /mio\.app\.br/i.test(url);
}

function looksLikeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/') && /anexo|download|arquivo|file|pdf/i.test(s)) return s;
  return null;
}

/** Enumerate every anexo/url/hiperlink field on a MIO record. */
export function collectMioAnexoUrls(record: Record<string, unknown> | null | undefined): string[] {
  if (!record) return [];
  const found = new Set<string>();
  for (const key of URL_FIELD_KEYS) {
    const url = looksLikeUrl(record[key]);
    if (url) found.add(url);
  }
  for (const [key, value] of Object.entries(record)) {
    if (!/url|anexo|arquivo|hiperlink|download|pdf|file|link/i.test(key)) continue;
    const url = looksLikeUrl(value);
    if (url) found.add(url);
  }
  return Array.from(found);
}

export interface CopiedFile {
  arquivo_path: string;
  arquivo_url: string;
  arquivo_hash: string;
  arquivo_tamanho_bytes: number;
  arquivo_tipo: string;
  skipped: boolean;
  reason?: string;
}

export async function copiarBufferParaStorageLocal(
  colaboradorId: string,
  origemRef: string,
  buffer: Buffer,
  contentType: string
): Promise<CopiedFile> {
  const hash = calcularArquivoHash(buffer);
  const { data: existingRows } = await supabaseAdmin
    .from('gt_documentos')
    .select('id, arquivo_path, arquivo_url, arquivo_hash, arquivo_tamanho_bytes, arquivo_tipo')
    .eq('arquivo_hash', hash)
    .is('deleted_at', null)
    .limit(1);
  const existingHash = existingRows?.[0];

  if (existingHash?.arquivo_path && isOurStorageUrl(existingHash.arquivo_url)) {
    return {
      arquivo_path: existingHash.arquivo_path,
      arquivo_url: existingHash.arquivo_url || '',
      arquivo_hash: hash,
      arquivo_tamanho_bytes: existingHash.arquivo_tamanho_bytes || buffer.length,
      arquivo_tipo: existingHash.arquivo_tipo || contentType,
      skipped: true,
      reason: 'hash_exists',
    };
  }

  const ext = extFromContentType(contentType);
  const filePath = `gestao-tripulantes/${colaboradorId}/mio-${origemRef.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}-${hash.slice(0, 12)}.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(GT_DOC_BUCKET)
    .upload(filePath, buffer, { contentType, upsert: false });

  if (upErr && !/already exists|Duplicate/i.test(upErr.message)) {
    throw upErr;
  }

  const { data: urlData } = supabaseAdmin.storage.from(GT_DOC_BUCKET).getPublicUrl(filePath);

  return {
    arquivo_path: filePath,
    arquivo_url: urlData?.publicUrl || '',
    arquivo_hash: hash,
    arquivo_tamanho_bytes: buffer.length,
    arquivo_tipo: contentType,
    skipped: Boolean(upErr),
    reason: upErr ? 'storage_exists' : undefined,
  };
}

export async function baixarAnexoMioParaLocal(opts: {
  colaboradorId: string;
  origemRef: string;
  treinamentoId?: string;
  anexoUrl?: string | null;
  extraUrls?: string[];
  record?: Record<string, unknown>;
}): Promise<CopiedFile | null> {
  const urls = new Set<string>();
  if (opts.anexoUrl) urls.add(opts.anexoUrl);
  for (const u of opts.extraUrls || []) urls.add(u);
  for (const u of collectMioAnexoUrls(opts.record)) urls.add(u);

  let lastReason = 'no_url_or_endpoint';
  for (const anexoUrl of urls) {
    try {
      if (isMioHostUrl(anexoUrl) || (/^https?:\/\//i.test(anexoUrl) && !isOurStorageUrl(anexoUrl))) {
        const downloaded = await mioClient.downloadFromHttpUrl(anexoUrl);
        if (downloaded && downloaded.buffer.length > 0) {
          console.log(`[MIO pull] Copied ${downloaded.buffer.length} bytes for ${opts.origemRef} from URL`);
          return copiarBufferParaStorageLocal(
            opts.colaboradorId,
            opts.origemRef,
            downloaded.buffer,
            downloaded.contentType
          );
        }
        lastReason = `url_http_miss:${anexoUrl.slice(0, 120)}`;
      } else if (anexoUrl.startsWith('/')) {
        const downloaded = await mioClient.downloadBinary(anexoUrl);
        if (downloaded && downloaded.buffer.length > 0) {
          return copiarBufferParaStorageLocal(
            opts.colaboradorId,
            opts.origemRef,
            downloaded.buffer,
            downloaded.contentType
          );
        }
        lastReason = `path_miss:${anexoUrl}`;
      }
    } catch (err) {
      lastReason = `url_error:${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (opts.treinamentoId) {
    const downloaded = await mioClient.downloadTreinamentoAnexo(opts.treinamentoId);
    if (downloaded && downloaded.buffer.length > 0) {
      console.log(`[MIO pull] Copied ${downloaded.buffer.length} bytes for ${opts.origemRef} (MIO original untouched)`);
      return copiarBufferParaStorageLocal(
        opts.colaboradorId,
        opts.origemRef,
        downloaded.buffer,
        downloaded.contentType
      );
    }
    lastReason = `endpoint_miss:treinamentoId=${opts.treinamentoId}`;
  }

  console.warn(`[MIO pull] anexo miss origem_ref=${opts.origemRef} mio_id=${opts.treinamentoId || ''} reason=${lastReason}`);
  return null;
}

export function hasMioAnexoFlag(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'sim' || s === 'yes' || s === 'true' || s === 's';
}

export async function registrarAnexoMiss(opts: {
  origemRef: string;
  mioId?: string;
  colaboradorId?: string;
  motivo: string;
}): Promise<void> {
  const { data: open } = await supabaseAdmin
    .from('gt_mio_anexo_misses')
    .select('id, tentativas')
    .eq('origem_ref', opts.origemRef)
    .is('resolved_at', null)
    .maybeSingle();

  if (open) {
    await supabaseAdmin
      .from('gt_mio_anexo_misses')
      .update({
        tentativas: (open.tentativas || 1) + 1,
        last_error: opts.motivo,
        mio_id: opts.mioId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', open.id);
    return;
  }

  await supabaseAdmin.from('gt_mio_anexo_misses').insert({
    origem_ref: opts.origemRef,
    mio_id: opts.mioId || null,
    colaborador_id: opts.colaboradorId || null,
    motivo: opts.motivo,
    last_error: opts.motivo,
    tentativas: 1,
  });
}

export async function marcarAnexoMissResolvido(origemRef: string): Promise<void> {
  await supabaseAdmin
    .from('gt_mio_anexo_misses')
    .update({ resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('origem_ref', origemRef)
    .is('resolved_at', null);
}
