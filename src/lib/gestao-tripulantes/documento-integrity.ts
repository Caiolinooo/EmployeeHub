import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import type { GTDocumento } from '@/types/gestao-tripulantes';

/**
 * Document integrity helpers for Gestão de Tripulantes.
 *
 * Contracts (see src/app/api/gestao-tripulantes/AGENTS.md):
 * - Every consultable document SHOULD have data_emissao, data_validade
 *   and a unique numero_rastreio. File upload may omit dates (status
 *   `pendente`); the user/OCR fills them afterwards. Quarantine is also exempt.
 *   ASO still prefers dates when present. Validity < emission is always rejected.
 * - Anti-duplication: same file content (hash/path) or same
 *   (tipo + titulo + numero_documento) for the same colaborador must UPDATE
 *   the existing row instead of inserting a new one.
 * - Identity gate applies to ALL document types: a document may only live on
 *   the colaborador that owns the CPF; anything ambiguous goes to quarantine.
 */

export type GTIdentityMatch = 'match' | 'reassigned' | 'quarantine' | 'unknown' | 'frozen';

// ---------------------------------------------------------------------------
// Tracking number (numero_rastreio)
// ---------------------------------------------------------------------------

export function gerarNumeroRastreio(
  tipoDocumento: string,
  cpf?: string | null,
  ano?: number
): string {
  const tipo = (tipoDocumento || 'DOC').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cpfDigits = String(cpf || '').replace(/\D/g, '');
  const cpf4 = cpfDigits.slice(0, 4) || '0000';
  const year = ano ?? new Date().getFullYear();
  // Random suffix resolved against DB in garantirNumeroRastreioUnico
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return `GT-${tipo}-${cpf4}-${year}-${rand}`;
}

/** Generates a tracking number guaranteed unique in gt_documentos. */
export async function garantirNumeroRastreioUnico(
  tipoDocumento: string,
  cpf?: string | null,
  ano?: number
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = gerarNumeroRastreio(tipoDocumento, cpf, ano);
    const { data } = await supabaseAdmin
      .from('gt_documentos')
      .select('id')
      .eq('numero_rastreio', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // Practically unreachable; fall back to short uuid-style suffix
  return `GT-${tipoDocumento.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// File hashing / duplicate detection
// ---------------------------------------------------------------------------

export function calcularArquivoHash(buffer: Uint8Array | Buffer): string {
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

export interface DuplicidadeCriterio {
  colaborador_id?: string | null;
  tipo_documento: string;
  titulo?: string | null;
  numero_documento?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  arquivo_hash?: string | null;
  arquivo_path?: string | null;
}

/**
 * Finds an existing non-deleted document that duplicates the candidate:
 * priority 1 — same file hash (exact file content);
 * priority 2 — same storage path;
 * priority 3 — for ASO, same (colaborador_id + tipo_documento + data_emissao/data_validade);
 * priority 4 — same (colaborador + tipo + titulo normalizado + numero_documento).
 */
export async function buscarDuplicado(
  criterio: DuplicidadeCriterio
): Promise<GTDocumento | null> {
  // 1. Same exact file hash
  if (criterio.arquivo_hash) {
    const { data } = await supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .is('deleted_at', null)
      .eq('arquivo_hash', criterio.arquivo_hash)
      .limit(1)
      .maybeSingle();
    if (data) return data as GTDocumento;
  }

  // 2. Same storage path
  if (criterio.arquivo_path) {
    const { data } = await supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .is('deleted_at', null)
      .eq('arquivo_path', criterio.arquivo_path)
      .limit(1)
      .maybeSingle();
    if (data) return data as GTDocumento;
  }

  // 3. For ASO: same collaborator + same exam dates (data_emissao / data_validade)
  if (criterio.colaborador_id && criterio.tipo_documento === 'aso') {
    let query = supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .is('deleted_at', null)
      .eq('colaborador_id', criterio.colaborador_id)
      .eq('tipo_documento', 'aso');

    if (criterio.data_validade) {
      query = query.eq('data_validade', criterio.data_validade);
    }
    if (criterio.data_emissao) {
      query = query.eq('data_emissao', criterio.data_emissao);
    }

    const { data: dateMatches } = await query.limit(1);
    if (dateMatches && dateMatches.length > 0) {
      return dateMatches[0] as GTDocumento;
    }
  }

  // 4. Same collaborator + type + title + doc number
  if (criterio.titulo && criterio.colaborador_id) {
    const { data } = await supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .is('deleted_at', null)
      .eq('colaborador_id', criterio.colaborador_id)
      .eq('tipo_documento', criterio.tipo_documento)
      .ilike('titulo', criterio.titulo.trim());
    if (data && data.length > 0) {
      const numero = (criterio.numero_documento || '').trim();
      if (numero) {
        const byNumber = data.find(d => (d.numero_documento || '').trim() === numero);
        if (byNumber) return byNumber as GTDocumento;
      }
      // Só colapsa rascunho sem arquivo. Nunca reutiliza o primeiro doc do
      // mesmo título (ex.: segundo passaporte com arquivo distinto).
      const rascunho = data.find(
        d =>
          !d.arquivo_path &&
          !criterio.arquivo_hash &&
          !criterio.arquivo_path &&
          !(d.numero_documento || '').trim() &&
          !numero
      );
      if (rascunho) return rascunho as GTDocumento;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Hard validation: emissão + validade obrigatórias (quarentena is exempt)
// ---------------------------------------------------------------------------

export interface ValidacaoIntegridadeInput {
  data_emissao?: string | null;
  data_validade?: string | null;
  tipo_documento?: string | null;
}

export function validarDatasObrigatorias(
  data: ValidacaoIntegridadeInput,
  opts?: { permitirQuarentena?: boolean; permitirSemValidade?: boolean; tipoDocumento?: string | null }
): { ok: boolean; errors: string[] } {
  if (opts?.permitirQuarentena) return { ok: true, errors: [] };
  const errors: string[] = [];
  const tipo = (opts?.tipoDocumento || data.tipo_documento || '').toLowerCase();
  const isAso = tipo === 'aso';
  const podeSemValidade = opts?.permitirSemValidade || (!isAso && tipo !== '');

  if (!data.data_emissao?.trim() && isAso) {
    errors.push('Data de emissão é obrigatória para ASO');
  }

  if (!data.data_validade?.trim() && isAso) {
    errors.push('Data de validade é obrigatória para ASO');
  }

  if (
    data.data_emissao &&
    data.data_validade &&
    new Date(data.data_validade) < new Date(data.data_emissao)
  ) {
    errors.push('Data de validade não pode ser anterior à data de emissão');
  }
  return { ok: errors.length === 0, errors };
}

export function calcularStatusValidacaoPorValidade(
  dataValidade?: string | null,
  opts?: { tipoDocumento?: string | null; permanente?: boolean }
): GTDocumento['status_validacao'] {
  if (!dataValidade) {
    if (opts?.permanente || opts?.tipoDocumento === 'treinamento') return 'valido';
    return 'pendente';
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(`${dataValidade}T00:00:00`);
  const diffDays = Math.ceil((validade.getTime() - hoje.getTime()) / 86400000);
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 30) return 'vencendo';
  return 'valido';
}

/** Tipos aceitos pelo CHECK de `gt_documentos.tipo_documento`. */
export const TIPOS_DOCUMENTO_VALIDOS = [
  'aso', 'treinamento', 'passaporte', 'cnh', 'certidao_nascimento',
  'certidao_casamento', 'reservista', 'titulo_eleitor', 'ctps',
  'documento_pessoal', 'certificado', 'contrato', 'laudo', 'outro',
] as const;

const TIPO_UI_PARA_BANCO: Record<string, { tipo: string; subtipo?: string }> = {
  visto: { tipo: 'documento_pessoal', subtipo: 'visto' },
  ctm: { tipo: 'documento_pessoal', subtipo: 'ctm' },
  habilitacao: { tipo: 'cnh', subtipo: 'habilitacao' },
  declaracao: { tipo: 'outro', subtipo: 'declaracao' },
  rg: { tipo: 'documento_pessoal', subtipo: 'rg' },
};

export function normalizarTipoDocumento(tipo: string | null | undefined): {
  tipo: string | null;
  subtipo?: string;
  invalido?: boolean;
} {
  const raw = (tipo || '').trim().toLowerCase();
  if (!raw) return { tipo: null };
  if ((TIPOS_DOCUMENTO_VALIDOS as readonly string[]).includes(raw)) {
    return { tipo: raw };
  }
  const mapped = TIPO_UI_PARA_BANCO[raw];
  if (mapped) return mapped;
  return { tipo: raw, invalido: true };
}

export const MIME_DOCUMENTO_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const EXT_PARA_MIME: Record<string, string> = {
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

function sniffMimeFromBytes(buffer: Uint8Array | Buffer | null | undefined): string | null {
  if (!buffer || buffer.length < 12) return null;
  const b0 = buffer[0], b1 = buffer[1], b2 = buffer[2], b3 = buffer[3];
  if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) return 'application/pdf';
  if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) return 'image/jpeg';
  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) return 'image/png';
  const ascii = String.fromCharCode(...Array.from(buffer.slice(0, 12)));
  if (ascii.startsWith('RIFF') && ascii.includes('WEBP')) return 'image/webp';
  return null;
}

/**
 * Resolve MIME for upload: declared type, aliases (image/jpg), extension, then magic bytes.
 * Empty/`octet-stream` from Windows/mobile cameras is the usual 400 cause.
 */
export function resolverMimeArquivo(
  fileName: string | null | undefined,
  declaredMime: string | null | undefined,
  buffer?: Uint8Array | Buffer | null
): string | null {
  const aliases: Record<string, string> = {
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
    'image/x-png': 'image/png',
  };
  const declared = (declaredMime || '').trim().toLowerCase();
  const aliased = aliases[declared] || declared;
  if ((MIME_DOCUMENTO_PERMITIDOS as readonly string[]).includes(aliased)) return aliased;

  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (EXT_PARA_MIME[ext]) return EXT_PARA_MIME[ext];

  const sniffed = sniffMimeFromBytes(buffer);
  if (sniffed) return sniffed;

  return null;
}
