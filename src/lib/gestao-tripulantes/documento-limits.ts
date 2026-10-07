/**
 * Limites de upload da pasta do colaborador (GT).
 * Módulo puro (sem deps de servidor) — seguro para importar no client e no server.
 */

/** Teto de 50MB alinhado ao file_size_limit do bucket gestao-tripulantes-documentos. */
export const GT_DOC_MAX_BYTES = 50 * 1024 * 1024;

export const GT_DOC_BUCKET = 'gestao-tripulantes-documentos';

export function formatarMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
