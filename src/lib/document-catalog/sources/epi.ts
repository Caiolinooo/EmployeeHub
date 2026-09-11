import { supabaseAdmin } from '@/lib/supabase';
import { catalogDownloadApi } from '../qhse';
import { registerDocumentSource } from '../registry';
import type { CatalogDocument, CatalogSourceContext } from '../types';

registerDocumentSource({
  id: 'epi',
  label: 'QHSE / Ficha de EPI',
  qhseRestricted: true,
  collect: collectEpiDocuments,
});

async function collectEpiDocuments(ctx: CatalogSourceContext): Promise<CatalogDocument[]> {
  if (!ctx.canSeeQhse) return [];
  const userId = ctx.identity.userId;
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from('epi_registrations')
    .select('id, equipment_type, quantity, status, signature_url, signed_at, delivered_at, validity_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) return [];

  const signed = data.filter((row) => !!row.signature_url || !!row.signed_at);
  const latest = data[0];
  const ficha: CatalogDocument = {
    id: `epi:ficha:${userId}`,
    source: 'epi',
    sourceLabel: 'QHSE / EPI',
    title: 'Ficha de EPI / Uniformes (AN-HSE-005)',
    subtitle: `${data.length} item(ns) · gerada sob demanda a partir das entregas`,
    category: 'qhse',
    issuedAt: signed[0]?.signed_at || signed[0]?.delivered_at || latest.created_at,
    validUntil: null,
    status: signed.length > 0 ? 'assinada' : latest.status,
    signed: signed.length > 0,
    qhseRelated: true,
    tipoDocumento: 'epi',
    recordId: `ficha:${userId}`,
    moduleHref: '/epi',
    downloadKind: 'api',
    downloadUrl: null,
    downloadApi: catalogDownloadApi('epi', `ficha:${userId}`),
    matchBy: ['user_id'],
  };

  const items: CatalogDocument[] = data.map((row) => ({
    id: `epi:${row.id}`,
    source: 'epi',
    sourceLabel: 'QHSE / EPI',
    title: `Entrega de EPI — ${row.equipment_type}`,
    subtitle: `Qtd ${row.quantity ?? 1}`,
    category: 'qhse',
    issuedAt: row.delivered_at || row.signed_at || row.created_at,
    validUntil: row.validity_date || null,
    status: row.status,
    signed: !!(row.signature_url || row.signed_at),
    qhseRelated: true,
    tipoDocumento: 'epi',
    recordId: row.id,
    moduleHref: '/admin/epi',
    downloadKind: row.signature_url ? 'url' : 'none',
    downloadUrl: row.signature_url || null,
    downloadApi: catalogDownloadApi('epi', row.id),
    matchBy: ['user_id'],
  }));

  return [ficha, ...items];
}
