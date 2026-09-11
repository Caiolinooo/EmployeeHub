const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: col } = await supabase.from('gt_colaboradores').select('id, nome_completo, cpf').ilike('nome_completo', '%Adalberto%');
  console.log('colabs:', JSON.stringify(col));
  for (const c of col || []) {
    const { data: asos } = await supabase.from('gt_documentos_aso').select('*').eq('colaborador_id', c.id);
    console.log(`\n== ${c.nome_completo} (${c.id}) cpf=${c.cpf} — aso rows: ${asos.length}`);
    for (const a of asos) {
      const { data: d } = await supabase.from('gt_documentos').select('id, titulo, arquivo_path, arquivo_hash, tipo_documento, identity_match, deleted_at, created_at').eq('id', a.documento_id).maybeSingle();
      console.log(`  aso ${a.id} doc=${a.documento_id} cpf_documento=${a.cpf_documento} match=${a.identity_match} esoc=${a.esocial_status}\n    doc: ${d ? JSON.stringify({ t: d.titulo, p: d.arquivo_path, h: d.arquivo_hash, tipo: d.tipo_documento, im: d.identity_match, del: d.deleted_at }) : 'NULL'}`);
    }
  }
}
run().catch(e => { console.error(e); process.exit(1); });
