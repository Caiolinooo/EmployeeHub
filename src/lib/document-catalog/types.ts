/**
 * Shared collaborator-document catalog.
 * Live resolver — no blob copy, no materialised index.
 * Future modules register a source via `registerDocumentSource`.
 */

export const DOCUMENT_CATALOG_SOURCE_IDS = [
  'gt',
  'epi',
  'lista_presenca',
  'academy',
  'contratos',
  'ferias',
  'reembolso',
  'assinatura',
] as const;

export type DocumentCatalogSourceId = (typeof DOCUMENT_CATALOG_SOURCE_IDS)[number];

export type CatalogMatchKey = 'user_id' | 'cpf' | 'email' | 'nome';

export type CatalogDownloadKind = 'url' | 'api' | 'open' | 'none';

export type CatalogDocCategory = 'qhse' | 'gt' | 'rh' | 'academy' | 'contratos' | 'identidade';

export interface CollaboratorIdentity {
  userId: string | null;
  colaboradorId: string | null;
  cpfDigits: string | null;
  email: string | null;
  emailLower: string | null;
  fullName: string | null;
  fullNameNormalized: string | null;
  position: string | null;
  department: string | null;
  sectorId: string | null;
}

export interface CatalogDocument {
  id: string;
  source: DocumentCatalogSourceId;
  sourceLabel: string;
  title: string;
  subtitle?: string | null;
  category: CatalogDocCategory;
  issuedAt?: string | null;
  validUntil?: string | null;
  status?: string | null;
  signed: boolean;
  qhseRelated: boolean;
  /** GT `tipo_documento` (aso, laudo, certificado, epi, …). ASO/laudo never belong in the QHSE catalog. */
  tipoDocumento?: string | null;
  recordId: string;
  moduleHref?: string | null;
  downloadKind: CatalogDownloadKind;
  downloadUrl?: string | null;
  downloadApi?: string | null;
  matchBy: CatalogMatchKey[];
}

export interface CatalogSourceContext {
  identity: CollaboratorIdentity;
  /** Viewer may see QHSE/EPI files of this person */
  canSeeQhse: boolean;
}

export interface DocumentCatalogSource {
  id: DocumentCatalogSourceId;
  label: string;
  /** QHSE / EPI / SESMT files — extra permission gate */
  qhseRestricted: boolean;
  collect: (ctx: CatalogSourceContext) => Promise<CatalogDocument[]>;
}

export interface CatalogResolveResult {
  identity: CollaboratorIdentity;
  documents: CatalogDocument[];
  sources: Array<{ id: DocumentCatalogSourceId; label: string; count: number }>;
  gaps: string[];
}

export function isDocumentCatalogSourceId(value: string): value is DocumentCatalogSourceId {
  return (DOCUMENT_CATALOG_SOURCE_IDS as readonly string[]).includes(value);
}
