import { supabaseAdmin } from '@/lib/supabase';
import { normalizePersonName } from '../names';
import { catalogDownloadApi, isQhseRelatedText } from '../qhse';
import { registerDocumentSource } from '../registry';
import type { CatalogDocument, CatalogMatchKey, CatalogSourceContext } from '../types';

registerDocumentSource({
  id: 'lista_presenca',
  label: 'Lista de Presença',
  qhseRestricted: false,
  collect: collectListaPresenca,
});

interface PresencaRow {
  id: string;
  user_id: string | null;
  nome_completo: string | null;
  assinatura_url: string | null;
  created_at: string;
  lista_id: string | null;
}

async function collectListaPresenca(ctx: CatalogSourceContext): Promise<CatalogDocument[]> {
  const { userId, fullNameNormalized } = ctx.identity;
  const rows: PresencaRow[] = [];

  if (userId) {
    const byUser = await supabaseAdmin
      .from('registros_presenca')
      .select('id, user_id, nome_completo, assinatura_url, created_at, lista_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (byUser.error) {
      const byUserFallback = await supabaseAdmin
        .from('registros_presenca')
        .select('id, user_id, nome_completo, assinatura_url, created_at, lista_presenca_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!byUserFallback.error && byUserFallback.data) {
        rows.push(
          ...(byUserFallback.data as Array<PresencaRow & { lista_presenca_id?: string }>).map((r) => ({
            ...r,
            lista_id: r.lista_id || r.lista_presenca_id || null,
          }))
        );
      }
    } else if (byUser.data) {
      rows.push(...(byUser.data as PresencaRow[]));
    }
  }

  if (fullNameNormalized && fullNameNormalized.length >= 8) {
    const byName = await supabaseAdmin
      .from('registros_presenca')
      .select('id, user_id, nome_completo, assinatura_url, created_at, lista_id')
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!byName.error && byName.data) {
      for (const row of byName.data as PresencaRow[]) {
        if (normalizePersonName(row.nome_completo) === fullNameNormalized) {
          rows.push(row);
        }
      }
    }
  }

  const listaIds = [...new Set(rows.map((r) => r.lista_id).filter((id): id is string => !!id))];
  const listaMap = new Map<string, { id: string; titulo: string | null; pauta: string | null; local: string | null; data_evento: string | null }>();
  if (listaIds.length > 0) {
    const { data: listas } = await supabaseAdmin
      .from('lista_presenca')
      .select('id, titulo, pauta, local, data_evento')
      .in('id', listaIds);
    for (const lista of listas || []) {
      listaMap.set(lista.id, lista);
    }
  }

  const seen = new Set<string>();
  const docs: CatalogDocument[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const lista = row.lista_id ? listaMap.get(row.lista_id) : undefined;
    const qhseRelated = isQhseRelatedText(lista?.titulo, lista?.pauta, lista?.local);
    if (qhseRelated && !ctx.canSeeQhse) continue;

    const matchBy: CatalogMatchKey[] = row.user_id ? ['user_id'] : ['nome'];
    const titlePrefix = qhseRelated ? 'Ficha/lista EPI assinada' : 'Lista de presença assinada';
    docs.push({
      id: `lista_presenca:${row.id}`,
      source: 'lista_presenca',
      sourceLabel: qhseRelated ? 'QHSE · Lista de Presença' : 'Lista de Presença',
      title: `${titlePrefix} — ${lista?.titulo || 'Evento'}`,
      subtitle: lista?.local || lista?.pauta || null,
      category: qhseRelated ? 'qhse' : 'rh',
      issuedAt: lista?.data_evento || row.created_at,
      validUntil: null,
      status: row.assinatura_url ? 'assinada' : 'registrada',
      signed: !!row.assinatura_url,
      qhseRelated,
      recordId: row.id,
      moduleHref: row.lista_id ? `/lista-presenca/${row.lista_id}` : '/lista-presenca',
      downloadKind: row.assinatura_url ? 'url' : 'open',
      downloadUrl: row.assinatura_url,
      downloadApi: catalogDownloadApi('lista_presenca', row.id),
      matchBy,
    });
  }

  return docs;
}
