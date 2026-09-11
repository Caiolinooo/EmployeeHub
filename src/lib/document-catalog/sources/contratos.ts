import { supabaseAdmin } from '@/lib/supabase';
import { catalogDownloadApi } from '../qhse';
import { registerDocumentSource } from '../registry';
import type { CatalogDocument, CatalogSourceContext } from '../types';

registerDocumentSource({
  id: 'contratos',
  label: 'Contratos',
  qhseRestricted: false,
  collect: collectContratos,
});

async function collectContratos(ctx: CatalogSourceContext): Promise<CatalogDocument[]> {
  const userId = ctx.identity.userId;
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from('solicitacoes_assinatura')
    .select(`
      id,
      status,
      created_at,
      documento_id,
      documento:documentos_trabalhistas!documento_id (
        id,
        titulo,
        arquivo_url,
        data_criacao
      )
    `)
    .eq('colaborador_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error || !data) return [];

  return data.map((row) => {
    const docRaw = row.documento as { id?: string; titulo?: string; arquivo_url?: string; data_criacao?: string } | Array<{
      id?: string;
      titulo?: string;
      arquivo_url?: string;
      data_criacao?: string;
    }> | null;
    const doc = Array.isArray(docRaw) ? docRaw[0] : docRaw;
    const signed = (row.status || '').toLowerCase().includes('assin');
    return {
      id: `contratos:${row.id}`,
      source: 'contratos' as const,
      sourceLabel: 'Contratos',
      title: doc?.titulo || 'Documento trabalhista',
      subtitle: row.status || null,
      category: 'contratos' as const,
      issuedAt: doc?.data_criacao || row.created_at,
      validUntil: null,
      status: row.status,
      signed,
      qhseRelated: false,
      recordId: row.id,
      moduleHref: '/contratos',
      downloadKind: doc?.arquivo_url ? 'url' : 'api',
      downloadUrl: doc?.arquivo_url || null,
      downloadApi: catalogDownloadApi('contratos', row.id),
      matchBy: ['user_id' as const],
    } satisfies CatalogDocument;
  });
}
