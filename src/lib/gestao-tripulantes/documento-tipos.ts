/**
 * Catálogo e normalização de `gt_documentos.tipo_documento`.
 * Puro: sem Supabase. Upload, PUT e a aba Documentos usam as mesmas regras.
 */

/** Tipos aceitos pelo CHECK de `gt_documentos.tipo_documento` (pós-expansão 2026-10). */
export const TIPOS_DOCUMENTO_VALIDOS = [
  'aso', 'treinamento', 'passaporte', 'certificado', 'laudo',
  'pessoal', 'contratual', 'demissional', 'ferias', 'ponto', 'outro',
] as const;

const TIPO_UI_PARA_BANCO: Record<string, { tipo: string; subtipo?: string }> = {
  visto: { tipo: 'pessoal', subtipo: 'visto' },
  ctm: { tipo: 'pessoal', subtipo: 'ctm' },
  habilitacao: { tipo: 'pessoal', subtipo: 'habilitacao' },
  declaracao: { tipo: 'outro', subtipo: 'declaracao' },
  rg: { tipo: 'pessoal', subtipo: 'rg' },
};

/**
 * Tipos legados (pré-2026-10) → novo tipo canônico (+ subtipo que preserva
 * a granularidade civil). Garante retrocompat: dp-import, integrações e
 * clients antigos podem continuar mandando os valores antigos.
 */
const TIPO_LEGADO_PARA_NOVO: Record<string, { tipo: string; subtipo?: string }> = {
  documento_pessoal: { tipo: 'pessoal' },
  cnh: { tipo: 'pessoal', subtipo: 'cnh' },
  ctps: { tipo: 'pessoal', subtipo: 'ctps' },
  reservista: { tipo: 'pessoal', subtipo: 'reservista' },
  titulo_eleitor: { tipo: 'pessoal', subtipo: 'titulo_eleitor' },
  certidao_nascimento: { tipo: 'pessoal', subtipo: 'certidao_nascimento' },
  certidao_casamento: { tipo: 'pessoal', subtipo: 'certidao_casamento' },
  contrato: { tipo: 'contratual' },
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
  const legado = TIPO_LEGADO_PARA_NOVO[raw];
  if (legado) return legado;
  return { tipo: raw, invalido: true };
}

export type TipoDocumentoEdicaoResolvido =
  | { ok: true; tipo: string; subtipo?: string }
  | { ok: false; error: string; tipos_aceitos: readonly string[] };

/** PUT de documento: aceita o mesmo catálogo do upload (canônico, alias de UI ou legado). */
export function resolverTipoDocumentoEdicao(tipoInformado: unknown): TipoDocumentoEdicaoResolvido {
  if (typeof tipoInformado !== 'string') {
    return {
      ok: false,
      error: 'tipo_documento inválido',
      tipos_aceitos: TIPOS_DOCUMENTO_VALIDOS,
    };
  }
  const norm = normalizarTipoDocumento(tipoInformado);
  if (!norm.tipo || norm.invalido) {
    return {
      ok: false,
      error: `Tipo de documento inválido: ${tipoInformado}`,
      tipos_aceitos: TIPOS_DOCUMENTO_VALIDOS,
    };
  }
  return { ok: true, tipo: norm.tipo, subtipo: norm.subtipo };
}

/**
 * ASO/laudo já enviado ou processado no e-Social não troca de tipo.
 * Status `pendente` continua editável (rascunho).
 */
export function asoBloqueiaTrocaDeTipo(
  tipoAtual: string | null | undefined,
  tipoNovo: string,
  esocialStatus: string | null | undefined,
): boolean {
  const atual = (tipoAtual || '').trim().toLowerCase();
  const novo = (tipoNovo || '').trim().toLowerCase();
  if (!novo || atual === novo) return false;
  if (atual !== 'aso' && atual !== 'laudo') return false;
  const status = (esocialStatus || '').trim().toLowerCase();
  return status === 'enviado' || status === 'processado';
}

/** Subtipos civis que têm regras de extração OCR próprias (lib/ocr). */
const SUBTIPOS_COM_REGRA_OCR = new Set([
  'cnh', 'ctps', 'reservista', 'titulo_eleitor', 'certidao_nascimento', 'certidao_casamento',
]);

/**
 * Tipo efetivo para as regras de extração OCR: com a expansão de tipos
 * (2026-10), uma CNH nova é tipo 'pessoal' + subtipo 'cnh' — o subtipo
 * civil precisa vencer para as regras específicas continuarem disparando.
 */
export function tipoParaOcr(tipo: string | null | undefined, subtipo?: string | null): string {
  const sub = (subtipo || '').trim().toLowerCase();
  if (SUBTIPOS_COM_REGRA_OCR.has(sub)) return sub;
  return (tipo || '').trim().toLowerCase();
}
