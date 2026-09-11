/**
 * Dedup gt_historico_embarques origem='local': keep the newest row per
 * (colaborador_id, data_embarque, data_desembarque), soft-delete the rest.
 * Created by the invisible-marking bug — users retried saves that were
 * actually landing, piling identical rows that inflate fechamento NxN counts.
 *
 * Dry-run by default.  Apply: node scripts/dedupe-embarques-locais.js --apply
 * Run: node scripts/dedupe-embarques-locais.js [--apply]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local', override: true });
const APPLY = process.argv.includes('--apply');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: rows, error } = await sb
  .from('gt_historico_embarques')
  .select('id, colaborador_id, tipo, data_embarque, data_desembarque, origem, deleted_at, created_at')
  .eq('origem', 'local')
  .is('deleted_at', null)
  .order('created_at', { ascending: true });

if (error) {
  console.error('QUERY_ERROR', error.message);
  process.exit(1);
}

const groups = new Map();
for (const r of rows || []) {
  const key = `${r.colaborador_id}|${r.data_embarque}|${r.data_desembarque}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const now = new Date().toISOString();
const toDelete = [];
let dupGroups = 0;

for (const [key, list] of groups) {
  if (list.length < 2) continue;
  dupGroups++;
  const keep = list[list.length - 1]; // newest created_at
  for (const stale of list.slice(0, -1)) {
    toDelete.push(stale);
  }
  const tipos = [...new Set(list.map((r) => r.tipo))].join(',');
  console.log(
    `DUP x${list.length} ${tipos.padEnd(16)} ${list[0].data_embarque}→${list[0].data_desembarque} keep=${keep.id.slice(0, 8)} (${keep.created_at})`
  );
}

console.log(`\n${dupGroups} duplicate group(s), ${toDelete.length} row(s) to soft-delete.`);
if (!toDelete.length) {
  console.log('NOTHING_TO_DELETE');
  process.exit(0);
}
if (!APPLY) {
  console.log('DRY_RUN — re-run with --apply to soft-delete the stale rows above.');
  process.exit(0);
}

const { error: updErr } = await sb
  .from('gt_historico_embarques')
  .update({ deleted_at: now, updated_at: now })
  .in('id', toDelete.map((r) => r.id));
if (updErr) {
  console.error('APPLY_ERROR', updErr.message);
  process.exit(1);
}
console.log(`APPLIED — ${toDelete.length} row(s) soft-deleted.`);
