/**
 * Linear OCR regexes for gestão de tripulantes (CodeQL js/polynomial-redos
 * and js/inefficient-regular-expression). Separators do not overlap a
 * following quantified class; nested `?` on Dr/Dra is bounded.
 */

export function crmComUfRe(): RegExp {
  return /(?:CRM|C\.R\.M\.|RM|IM|REGISTRO)(?:\s{0,3}-?\s{0,3}([A-Z]{2}))?\s{0,8}[:|I\-]{0,4}\s{0,8}(\d[\d.\s-]{4,40}\d)/gi;
}

export function crmSemUfRe(): RegExp {
  return /(?:CRM|C\.R\.M\.)\s{0,8}[:|I\-]{0,4}\s{0,8}(\d[\d.\s]{4,40}\d)/gi;
}

export const CRM_PREFIX_RE = /^(?:CRM|C\.R\.M\.|RM|IM|REGISTRO)\s{0,8}[:|\-]{0,4}\s{0,8}/i;

export const MEDICO_PREFIXO_INICIO_RE =
  /^(?:M[eé]dica?\b\s{0,3}|Dra?\.?\s{0,3}[ºª]?\s{0,3}|Dr[ªº]\s{0,3}|DRA?\.?\s{0,3})/i;

export const MEDICO_PREFIXO_MEIO_RE =
  /\b(?:Dra?\.?\s{0,3}[ºª]?\s{0,3}|Dr[ªº]\s{0,3}|DRA?\.?\s{0,3})\b/i;

export const MEDICO_NOME_RE =
  /(?:Dra?\.?\s{0,3}[ºª]?\s{0,3}|Dr[ªº]\s{0,3})([A-Za-zÀ-ÖØ-öø-ÿçãõ][A-Za-zÀ-ÖØ-öø-ÿçãõ\s]{9,59})/i;

export const CNPJ_OCR_RE =
  /(?:CNPJ|C\.N\.P\.J)\s{0,8}[:|I\-]{0,4}\s{0,8}(\d{2}\s{0,3}\.\s{0,3}\d{3}\s{0,3}\.\s{0,3}\d{3}\s{0,3}\/\s{0,3}\d{4}\s{0,3}-\s{0,3}\d{2}|\d{14})/i;

export const CLINICA_OCR_RE =
  /(?:Clínica|Clinica|Centro\s{1,3}Médico|Laboratório|Laboratorio)\s{0,3}:?\s{0,3}([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s]{3,79})/i;

const HEADER_WORD_RE = /^(procedimentos|procedimento|exames|exame|data)/i;
const HEADER_PIPE_RE = /^\s{0,8}\|\s{0,8}/;

/** Same as `/^(?:procedimentos|data|procedimento|exame|exames|\s*\|\s*)+$/i`. */
export function isTabelaHeaderLinha(linha: string): boolean {
  const t = linha.trim();
  if (!t) return false;
  let i = 0;
  let matched = false;
  while (i < t.length) {
    const rest = t.slice(i);
    const word = rest.match(HEADER_WORD_RE);
    if (word) {
      i += word[0].length;
      matched = true;
      continue;
    }
    const pipe = rest.match(HEADER_PIPE_RE);
    if (pipe && pipe[0].length > 0) {
      i += pipe[0].length;
      matched = true;
      continue;
    }
    return false;
  }
  return matched;
}

export function stripCrmPrefix(raw: string): string {
  return raw.replace(CRM_PREFIX_RE, '');
}

export function contextoERotuloIdentidade(ctxAntes: string): boolean {
  const t = ctxAntes.toUpperCase().replace(/[\s:\-]+$/, '');
  return /(?:CRM|RQE|CNPJ|C\.N\.P\.J|CPF|C\.P\.F\.?)$/.test(t);
}

export function tokenValidoComoNumeroDocumento(raw: string): string | null {
  const token = (raw || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!token) return null;
  if (token.length < 4 || token.length > 30) return null;
  if (!/\d/.test(token)) return null;
  if (/^\d{11}$/.test(token)) return null;
  if (/^\d{14}$/.test(token)) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(token)) return null;
  if (token.includes('@@') || token.startsWith('HTTP')) return null;
  return token;
}

const ASO_NUM_RE =
  /(?:ASO|ATESTADO\s{1,5}DE\s{1,5}SA[UÚ]DE\s{1,5}OCUPACIONAL)[^\n]{0,40}\bN[ºo°.]?\s{0,5}[:\-]?\s{0,5}([A-Z0-9][A-Z0-9\/\-. ]{2,24}\d|\d[A-Z0-9\/\-. ]{2,24})/i;
const EXAME_NUM_RE =
  /\bN[ºo°.]?\s{0,3}(?:[UÚ]MERO\s{0,3})?(?:DO|DA|DE)?\s{0,3}(?:EXAME|LAUDO|ASO)\s{0,3}[:\-]?\s{0,3}([A-Z0-9][A-Z0-9\/\-. ]{2,24})/i;
const PASSAPORTE_NUM_RE =
  /(?:PASSPORT\s{0,3}(?:NO\.?|NUMBER|#)|P\.?\s{0,3}ASSAPORTE\s{0,3}N[ºo°.]?|\bN[ºo°.]?\s{0,3}(?:DO\s{1,3})?PASSAPORTE)\s{0,3}[:\-]?\s{0,3}([A-Z0-9][A-Z0-9 ]{4,12})/i;
const ICAO_RE = /\b([A-Z]{2}\d{6,7})\b/;
const CERT_NUM_RE =
  /\bCERTIFICADO[^\n:]{0,60}\bN[ºo°.]?\s{0,5}[:\-]?\s{0,5}([A-Z0-9][A-Z0-9\/\-. ]{2,29})/i;
const NR_NUM_RE =
  /\b(?:TREINAMENTO|NR\s{0,3}-?\s{0,3}\d{1,2})[^\n]{0,80}\bN[ºo°.]?\s{0,5}[:\-]?\s{0,5}([A-Z0-9][A-Z0-9\/\-. ]{2,29})/i;
const DOC_NUM_RE =
  /\bN[ºo°.]?\s{0,3}(?:[UÚ]MERO\s{0,3})?(?:DO\s{1,3}|DA\s{1,3}|DE\s{1,3})?(?:DOCUMENTO|CERTIFICADO|REGISTRO)\s{0,3}[:\-]?\s{0,3}([A-Z0-9][A-Z0-9\/\-. ]{2,29})/i;
const EN_DOC_NUM_RE =
  /\b(?:NUMBER|DOC\s{0,3}NO\.?|DOCUMENT\s{0,3}NO\.?)\s{0,3}[:\-#]\s{0,3}([A-Z0-9][A-Z0-9\/\-. ]{2,29})/i;

function padroesNumeroDocumento(tipoDocumento?: string | null): RegExp[] {
  const padroes: RegExp[] = [];
  const tipo = String(tipoDocumento || '').toLowerCase();

  if (tipo === 'aso' || tipo === '') {
    padroes.push(ASO_NUM_RE, EXAME_NUM_RE);
  }
  if (tipo === 'passaporte' || tipo === '') {
    padroes.push(PASSAPORTE_NUM_RE, ICAO_RE);
  }
  if (tipo === 'certificado' || tipo === 'treinamento' || tipo === '') {
    padroes.push(CERT_NUM_RE, NR_NUM_RE);
  }
  padroes.push(DOC_NUM_RE, EN_DOC_NUM_RE);
  return padroes;
}

/**
 * Extrai o número próprio impresso no documento a partir do texto OCR.
 * Mesmos rótulos que o matcher anterior; quantifiers bounded / non-overlapping.
 */
export function extrairNumeroDocumentoDoTexto(
  texto: string,
  tipoDocumento?: string | null,
): string | null {
  const t = texto || '';
  if (!t.trim()) return null;

  for (const re0 of padroesNumeroDocumento(tipoDocumento)) {
    const re = new RegExp(re0.source, re0.flags.includes('g') ? re0.flags : `${re0.flags}g`);
    for (const m of t.matchAll(re)) {
      const ctxAntes = t.substring(Math.max(0, (m.index || 0) - 30), m.index || 0);
      if (contextoERotuloIdentidade(ctxAntes)) continue;
      const token = tokenValidoComoNumeroDocumento(m[1] || '');
      if (token) return token;
    }
  }

  return null;
}
