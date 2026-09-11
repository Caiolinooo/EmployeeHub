import type { CatalogDocCategory, CatalogResolveResult, DocumentCatalogSourceId } from './types';

const QHSE_HINT =
  /\b(epi|qhse|hse|sesmt|uniforme|fichas?\s+de\s+epi|an-hse|seguran[cç]a\s+do\s+trabalho|equipamento[s]?\s+de\s+prote[cç][aã]o)\b/i;

/** Occupational exams live on the ASO tab — never on QHSE / EPI. */
export function isOccupationalExamTipo(tipo: string | null | undefined): boolean {
  const t = String(tipo || '').trim().toLowerCase();
  return t === 'aso' || t === 'laudo';
}

export function isQhseRelatedText(...parts: Array<string | null | undefined>): boolean {
  const blob = parts.filter(Boolean).join(' ');
  if (!blob.trim()) return false;
  return QHSE_HINT.test(blob);
}

/**
 * GT `tipo_documento` → catalog QHSE flags.
 * ASO/laudo stay `qhseRelated: false` / category `gt` so `?qhse=1` cannot list them.
 * EPI tipos are QHSE; everything else is a normal GT document.
 */
export function qhseFlagsForGtTipo(tipo: string | null | undefined): {
  qhseRelated: boolean;
  category: CatalogDocCategory;
} {
  const t = String(tipo || 'outro').toLowerCase();
  if (isOccupationalExamTipo(t)) {
    return { qhseRelated: false, category: 'gt' };
  }
  if (t.includes('epi')) {
    return { qhseRelated: true, category: 'qhse' };
  }
  return { qhseRelated: false, category: 'gt' };
}

function categoryLooksLikeOccupationalExam(category: string | null | undefined): boolean {
  const cat = String(category || '').trim().toLowerCase();
  return cat === 'aso' || cat === 'laudo';
}

/** `onlyQhse` / `?qhse=1`: EPI + QHSE attendance. Never ASO/laudo even if a source mis-tags them. */
export function isQhseCatalogDocument(doc: {
  qhseRelated?: boolean;
  category?: string | null;
  tipoDocumento?: string | null;
}): boolean {
  if (isOccupationalExamTipo(doc.tipoDocumento)) return false;
  if (categoryLooksLikeOccupationalExam(doc.category)) return false;
  return doc.qhseRelated === true || doc.category === 'qhse';
}

export function restrictCatalogToQhse(result: CatalogResolveResult): CatalogResolveResult {
  const documents = result.documents.filter(isQhseCatalogDocument);
  const counts = new Map<DocumentCatalogSourceId, number>();
  for (const doc of documents) {
    counts.set(doc.source, (counts.get(doc.source) || 0) + 1);
  }
  return {
    ...result,
    documents,
    sources: result.sources
      .map((source) => ({ ...source, count: counts.get(source.id) || 0 }))
      .filter((source) => source.count > 0),
  };
}

export function catalogDownloadApi(source: string, recordId: string): string {
  const params = new URLSearchParams({ source, recordId });
  return `/api/document-catalog/download?${params.toString()}`;
}
