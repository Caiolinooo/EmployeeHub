/**
 * Full MIO → local DB pull. Never writes to MIO.
 *
 *   npx tsx scripts/mio-full-pull.ts
 *   npx tsx scripts/mio-full-pull.ts --dry-run
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function reportLocalCounts() {
  const { supabaseAdmin } = await import('../src/lib/supabase');
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const { count: n, error } = await q;
    if (error) return { error: error.message };
    return n ?? 0;
  };

  const colaboradores = await count('gt_colaboradores', (q) => q.is('deleted_at', null));
  const ativos = await count('gt_colaboradores', (q) => q.is('deleted_at', null).eq('ativo', true));
  const inativos = await count('gt_colaboradores', (q) => q.is('deleted_at', null).eq('ativo', false));
  const docs = await count('gt_documentos', (q) => q.is('deleted_at', null));
  const docsOurs = await count('gt_documentos', (q) =>
    q.is('deleted_at', null).not('arquivo_url', 'is', null).eq('arquivo_ausente', false)
  );
  const docsAusentes = await count('gt_documentos', (q) => q.is('deleted_at', null).eq('arquivo_ausente', true));
  const asos = await count('gt_documentos_aso');
  const treinamentos = await count('gt_documentos', (q) => q.is('deleted_at', null).eq('tipo_documento', 'treinamento'));
  const embarques = await count('gt_historico_embarques', (q) => q.is('deleted_at', null));
  const afastamentos = await count('gt_afastamentos');
  const misses = await count('gt_mio_anexo_misses', (q) => q.is('resolved_at', null));
  const entidades = await count('gt_mio_entidades');

  return {
    colaboradores,
    ativos,
    inativos,
    documentos: docs,
    documentos_com_arquivo_local: docsOurs,
    documentos_arquivo_ausente: docsAusentes,
    asos,
    treinamentos,
    embarques,
    afastamentos,
    anexo_misses_abertos: misses,
    entidades_mio: entidades,
  };
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  if (dry) {
    const { isMioWritePath, isMioPullPath } = await import('../src/lib/mio/client');
    if (isMioWritePath('PUT', '/int-integrante-upd') !== true) throw new Error('PUT must be write');
    if (isMioWritePath('POST', '/int-integrante-add') !== true) throw new Error('add must be write');
    if (isMioWritePath('POST', '/sms-aso') !== true) throw new Error('POST /sms-aso must be write');
    if (isMioWritePath('GET', '/sms-aso') !== false) throw new Error('GET /sms-aso is a probe, not a write');
    if (isMioPullPath('POST', '/int-integrante-get') !== true) throw new Error('get integrantes is pull');
    if (isMioPullPath('GET', '/sms-treinamento-registro-get/all') !== true) throw new Error('trainings get is pull');
    if (isMioPullPath('GET', '/sms-aso-get') !== true) throw new Error('aso-get probe must be allowlisted');
    if (isMioPullPath('POST', '/lgp-reports') !== true) throw new Error('lgp-reports is pull');
    console.log('DRY_RUN_OK: write-to-MIO functions blocked; pull paths allowed (including ASO GET probes)');
    return;
  }

  const started = Date.now();
  const { syncAllFromMIO } = await import('../src/lib/gestao-tripulantes/mio-sync');
  console.log('[MIO pull] Starting full migration into local DB...');
  const result = await syncAllFromMIO();
  const duration_ms = Date.now() - started;
  const counts = await reportLocalCounts();
  console.log(JSON.stringify({ duration_ms, duration_min: Math.round(duration_ms / 60000), result, counts }, null, 2));
  if (!result.success) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
