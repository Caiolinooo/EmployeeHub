/**
 * Limpeza retroativa de sobreposições em gt_historico_embarques.
 * Reproduz a semântica do v5.76.1 sobre o legado: por colaborador, percorre
 * os eventos do mais recente para o mais antigo; quem sobrepõe um evento já
 * mantido é soft-deletado (o save novo sempre venceu — o legado não teve
 * esse tratamento). Executar DRY-RUN antes: node scripts/limpa-sobrepostos-embarques.js
 * Aplicar: node scripts/limpa-sobrepostos-embarques.js --apply
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
  .select('id, colaborador_id, tipo, data_embarque, data_desembarque, origem, created_at')
  .is('deleted_at', null)
  .order('created_at', { ascending: false });

if (error) {
  console.error('QUERY_ERROR', error.message);
  process.exit(1);
}

const porColab = new Map();
for (const r of rows || []) {
  if (!porColab.has(r.colaborador_id)) porColab.set(r.colaborador_id, []);
  porColab.get(r.colaborador_id).push(r);
}

const sobrepoe = (a, b) => a.data_embarque <= b.data_desembarque && a.data_desembarque >= b.data_embarque;
const agora = new Date().toISOString();
const toDelete = [];

for (const [cid, lista] of porColab) {
  const kept = [];
  for (const r of lista) {
    // Só save do operador (origem='local') substitui — linha do MIO nunca
    // inicia substituição. MIO antigo sob sobposição de save local também sai
    // (é o que o v5.76.1 faz a partir de agora).
    if (r.origem === 'local') {
      const vitimas = kept.filter((k) => sobrepoe(r, k));
      for (const v of vitimas) {
        toDelete.push(v);
        kept.splice(kept.indexOf(v), 1);
      }
      if (kept.some((k) => sobrepoe(r, k))) {
        toDelete.push(r);
        continue;
      }
    } else if (kept.some((k) => k.origem === 'local' && sobrepoe(r, k))) {
      toDelete.push(r);
      continue;
    }
    kept.push(r);
  }
  const doColab = toDelete.filter((d) => d.colaborador_id === cid);
  if (doColab.length) {
    console.log(
      `${cid.slice(0, 8)}: ${kept.length} mantido(s), ${doColab.length} sobreposto(s) removendo: ` +
        doColab
          .map((d) => `${d.origem}/${d.tipo} ${d.data_embarque}→${d.data_desembarque} (criado ${d.created_at.slice(0, 10)})`)
          .join(' | ')
    );
  }
}

console.log(`\n${toDelete.length} linha(s) a soft-deletar de ${porColab.size} colaborador(es).`);
if (!toDelete.length) {
  console.log('NOTHING_TO_DELETE');
  process.exit(0);
}
if (!APPLY) {
  console.log('DRY_RUN — re-run com --apply para aplicar.');
  process.exit(0);
}

const { error: updErr } = await sb
  .from('gt_historico_embarques')
  .update({ deleted_at: agora, updated_at: agora })
  .in('id', toDelete.map((r) => r.id));
if (updErr) {
  console.error('APPLY_ERROR', updErr.message);
  process.exit(1);
}
console.log(`APLICADO — ${toDelete.length} linha(s) soft-deletada(s).`);
