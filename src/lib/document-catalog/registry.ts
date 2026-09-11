import type { DocumentCatalogSource, DocumentCatalogSourceId } from './types';

const sources: DocumentCatalogSource[] = [];

export function registerDocumentSource(source: DocumentCatalogSource): void {
  if (sources.some((existing) => existing.id === source.id)) return;
  sources.push(source);
}

export function getDocumentSources(): readonly DocumentCatalogSource[] {
  return sources;
}

export function getDocumentSource(id: DocumentCatalogSourceId): DocumentCatalogSource | undefined {
  return sources.find((source) => source.id === id);
}
