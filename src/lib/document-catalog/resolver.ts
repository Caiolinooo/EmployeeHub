import { resolveCollaboratorIdentity } from './identity';
import { canSeeQhseDocuments, filterCatalogDocuments, type CatalogViewer } from './permissions';
import { restrictCatalogToQhse } from './qhse';
import { getDocumentSources } from './registry';
import type { CatalogResolveResult, DocumentCatalogSourceId } from './types';
import './sources';

const KNOWN_GAPS = [
  'Não existe tabela dedicada de “ficha de EPI assinada”; a ficha AN-HSE-005 é gerada sob demanda a partir de epi_registrations + signature_url.',
  'Lista de presença não armazena PDF de ficha EPI: o vínculo é o registro assinado (registros_presenca) em listas cujo título/pauta indica EPI/QHSE.',
];

export async function resolveCollaboratorDocuments(opts: {
  userId?: string | null;
  colaboradorId?: string | null;
  viewer: CatalogViewer;
  qhseOnly?: boolean;
}): Promise<CatalogResolveResult | null> {
  const identity = await resolveCollaboratorIdentity({
    userId: opts.userId,
    colaboradorId: opts.colaboradorId,
  });
  if (!identity) return null;

  const canSeeQhse = canSeeQhseDocuments(opts.viewer, identity.userId);
  const ctx = { identity, canSeeQhse };

  const collected = await Promise.all(
    getDocumentSources().map(async (source) => {
      try {
        const docs = await source.collect(ctx);
        return { source, docs };
      } catch (err) {
        console.warn(`[document-catalog] source ${source.id} failed:`, err);
        return { source, docs: [] };
      }
    })
  );

  const all = collected.flatMap((entry) => entry.docs);
  const documents = filterCatalogDocuments(opts.viewer, identity.userId, all).sort((a, b) => {
    const da = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
    const db = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
    return db - da;
  });

  const counts = new Map<DocumentCatalogSourceId, number>();
  for (const doc of documents) {
    counts.set(doc.source, (counts.get(doc.source) || 0) + 1);
  }

  const sources = collected.map((entry) => ({
    id: entry.source.id,
    label: entry.source.label,
    count: counts.get(entry.source.id) || 0,
  }));

  const resolved: CatalogResolveResult = { identity, documents, sources, gaps: KNOWN_GAPS };
  return opts.qhseOnly ? restrictCatalogToQhse(resolved) : resolved;
}
