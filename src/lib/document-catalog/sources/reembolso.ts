import { supabaseAdmin } from '@/lib/supabase';
import { catalogDownloadApi } from '../qhse';
import { registerDocumentSource } from '../registry';
import type { CatalogDocument, CatalogSourceContext } from '../types';

registerDocumentSource({
  id: 'reembolso',
  label: 'Reembolso',
  qhseRestricted: false,
  collect: collectReembolso,
});

interface ReembolsoRow {
  id: string;
  protocolo?: string | null;
  status?: string | null;
  created_at?: string | null;
  comprovantes?: unknown;
}

function comprovanteUrl(item: unknown): string | null {
  if (!item) return null;
  if (typeof item === 'string' && item.startsWith('http')) return item;
  if (typeof item === 'object' && item !== null) {
    const rec = item as Record<string, unknown>;
    const url = rec.url || rec.publicUrl || rec.arquivo_url;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

async function collectReembolso(ctx: CatalogSourceContext): Promise<CatalogDocument[]> {
  const userId = ctx.identity.userId;
  if (!userId) return [];

  let data: ReembolsoRow[] | null = null;
  const primary = await supabaseAdmin
    .from('reimbursements')
    .select('id, protocolo, status, created_at, comprovantes')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);

  if (!primary.error) {
    data = primary.data as ReembolsoRow[] | null;
  } else {
    const alt = await supabaseAdmin
      .from('Reimbursement')
      .select('id, protocolo, status, created_at, comprovantes')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (!alt.error) data = alt.data as ReembolsoRow[] | null;
  }

  if (!data) return [];

  const docs: CatalogDocument[] = [];
  for (const row of data) {
    const attachments = Array.isArray(row.comprovantes) ? row.comprovantes : [];
    const firstUrl = attachments.map(comprovanteUrl).find(Boolean) || null;
    docs.push({
      id: `reembolso:${row.id}`,
      source: 'reembolso',
      sourceLabel: 'Reembolso',
      title: `Reembolso ${row.protocolo || row.id.slice(0, 8)}`,
      subtitle: attachments.length ? `${attachments.length} comprovante(s)` : 'Sem anexos',
      category: 'rh',
      issuedAt: row.created_at || null,
      validUntil: null,
      status: row.status,
      signed: false,
      qhseRelated: false,
      recordId: row.id,
      moduleHref: row.protocolo ? `/reembolso/${row.protocolo}` : '/reembolso',
      downloadKind: firstUrl ? 'url' : 'open',
      downloadUrl: firstUrl,
      downloadApi: catalogDownloadApi('reembolso', row.id),
      matchBy: ['user_id'],
    });
  }
  return docs;
}
