import { supabaseAdmin } from '@/lib/supabase';
import { catalogDownloadApi } from '../qhse';
import { registerDocumentSource } from '../registry';
import type { CatalogDocument, CatalogSourceContext } from '../types';

registerDocumentSource({
  id: 'assinatura',
  label: 'Assinatura digital',
  qhseRestricted: false,
  collect: collectAssinatura,
});

async function collectAssinatura(ctx: CatalogSourceContext): Promise<CatalogDocument[]> {
  const userId = ctx.identity.userId;
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select('signature_url, signature_registered_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.signature_url) return [];

  return [{
    id: `assinatura:${userId}`,
    source: 'assinatura',
    sourceLabel: 'Identidade',
    title: 'Assinatura digital cadastrada',
    subtitle: 'Usada em EPI, lista de presença, contratos e férias',
    category: 'identidade',
    issuedAt: data.signature_registered_at || null,
    validUntil: null,
    status: 'cadastrada',
    signed: true,
    qhseRelated: false,
    recordId: userId,
    moduleHref: '/profile',
    downloadKind: 'url',
    downloadUrl: data.signature_url,
    downloadApi: catalogDownloadApi('assinatura', userId),
    matchBy: ['user_id'],
  }];
}
