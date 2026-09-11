import { supabaseAdmin } from '@/lib/supabase';
import { registerDocumentSource } from '../registry';
import type { CatalogDocument, CatalogSourceContext } from '../types';

registerDocumentSource({
  id: 'ferias',
  label: 'Férias',
  qhseRestricted: false,
  collect: collectFerias,
});

async function collectFerias(ctx: CatalogSourceContext): Promise<CatalogDocument[]> {
  const userId = ctx.identity.userId;
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from('leave_requests')
    .select('id, status, start_date, end_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error || !data) return [];

  return data.map((row) => ({
    id: `ferias:${row.id}`,
    source: 'ferias' as const,
    sourceLabel: 'Férias',
    title: 'Comprovante de férias (PDF)',
    subtitle: `${row.start_date || '—'} → ${row.end_date || '—'}`,
    category: 'rh' as const,
    issuedAt: row.created_at,
    validUntil: row.end_date || null,
    status: row.status,
    signed: (row.status || '').toUpperCase() === 'APPROVED',
    qhseRelated: false,
    recordId: row.id,
    moduleHref: '/ferias',
    downloadKind: 'api' as const,
    downloadUrl: null,
    downloadApi: `/api/leave/${row.id}/pdf`,
    matchBy: ['user_id' as const],
  }));
}
