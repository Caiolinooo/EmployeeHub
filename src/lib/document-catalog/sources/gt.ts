import { supabaseAdmin } from '@/lib/supabase';
import { catalogDownloadApi, qhseFlagsForGtTipo } from '../qhse';
import { registerDocumentSource } from '../registry';
import type { CatalogDocument, CatalogSourceContext } from '../types';

registerDocumentSource({
  id: 'gt',
  label: 'Gestão de Tripulantes',
  qhseRestricted: false,
  collect: collectGtDocuments,
});

async function collectGtDocuments(ctx: CatalogSourceContext): Promise<CatalogDocument[]> {
  const colaboradorId = ctx.identity.colaboradorId;
  if (!colaboradorId) return [];

  const { data, error } = await supabaseAdmin
    .from('gt_documentos')
    .select('id, tipo_documento, titulo, numero_documento, data_emissao, data_validade, status_validacao, arquivo_url, arquivo_ausente')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((row) => {
    const tipo = (row.tipo_documento || 'outro').toLowerCase();
    const { qhseRelated, category } = qhseFlagsForGtTipo(tipo);
    const hasFile = !!(row.arquivo_url && !row.arquivo_ausente);
    return {
      id: `gt:${row.id}`,
      source: 'gt',
      sourceLabel: 'Gestão de Tripulantes',
      title: row.titulo || row.tipo_documento || 'Documento GT',
      subtitle: row.numero_documento ? `Nº ${row.numero_documento}` : row.tipo_documento,
      category,
      issuedAt: row.data_emissao || null,
      validUntil: row.data_validade || null,
      status: row.status_validacao || null,
      signed: false,
      qhseRelated,
      tipoDocumento: tipo,
      recordId: row.id,
      moduleHref: null,
      downloadKind: 'api',
      downloadUrl: hasFile ? row.arquivo_url : null,
      downloadApi: catalogDownloadApi('gt', row.id),
      matchBy: ['cpf', 'user_id'],
    } satisfies CatalogDocument;
  });
}
