const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const IDS = ['884237d6-0d65-4cfd-b68e-730d17ec9ac8','88f756bc-1b73-42b6-aa82-c088c6ee75ae','e45ffbcb-ee55-4a60-9496-4e4eb2ac3b96','f463288d-8bb3-45ff-acae-0a7076fccef5','1063f3b2-fb59-459f-a677-805929eff469','284c423a-53dc-4b52-8b8d-c76d6e06290a','9128ea4b-0453-45eb-a571-e640f8b3574b','5932aed1-80b3-4920-b6e6-b3ed22c52bb7','81cf48ad-74e4-4660-9790-b7f7414ad'];

async function run() {
  // 1) os 9 alvos
  const { data: docs } = await supabase.from('gt_documentos').select('id, titulo, colaborador_id, identity_match').in('id', [
    '884237d6-0d65-4cfd-b68e-730d17ec9ac8','88f756bc-1b73-42b6-aa82-c088c6ee75ae','e45ffbcb-ee55-4a60-9496-4e4eb2ac3b96',
    'f463288d-8bb3-45ff-acae-0a7076fccef5','1063f3b2-fb59-459f-a677-805929eff469','284c423a-53dc-4b52-8b8d-c76d6e06290a',
    '9128ea4b-0453-45eb-a571-e640f8b3574b','5932aed1-80b3-4920-b6e6-b3ed22c52bb7'].concat(['81cf48ad-74e4-4660-9790-b7414ad']));
  let okQ = 0;
  const { data: all9 } = await supabase.from('gt_documentos').select('id, titulo, colaborador_id, identity_match')
    .in('titulo', ['ASO - Wendel Oliveira Silva - ASO PT EN'])
    .or('identity_match.eq.quarantine');
  const { data: qdocs } = await supabase.from('gt_documentos').select('id, titulo, colaborador_id, identity_match').eq('identity_match', 'quarantine');
  console.log(`docs com identity_match=quarantine: ${qdocs.length}`);
  for (const d of qdocs) console.log(`  ${d.id.slice(0,8)} vinculo=${d.colaborador_id} "${d.titulo}"`);

  // 2) ASO espelho
  const { data: qaso } = await supabase.from('gt_documentos_aso').select('documento_id, identity_match, esocial_status, colaborador_id').eq('identity_match', 'quarantine');
  console.log(`\nasos com identity_match=quarantine: ${qaso.length}`);
  qaso.forEach(a => console.log(`  ${a.documento_id.slice(0,8)} esoc=${a.esocial_status} vinculo=${a.colaborador_id}`));

  // 3) perfil do Adalberto: quantos ASOs vivos restam?
  const { data: adalDocs } = await supabase.from('gt_documentos').select('id, titulo, tipo_documento').eq('colaborador_id', '005a5ea6-e148-4223-95be-62cb45b116d5').is('deleted_at', null).eq('tipo_documento', 'aso');
  console.log(`\nASOs vivos no perfil Adalberto: ${adalDocs.length}`, adalDocs.map(d => d.titulo));
  const { data: gabDocs } = await supabase.from('gt_documentos').select('id, titulo').eq('colaborador_id', '759043dc-fc50-4d77-9466-15cca74205b8').is('deleted_at', null).eq('tipo_documento', 'aso');
  console.log(`ASOs vivos no perfil Gabriela: ${gabDocs.length}`, gabDocs.map(d => d.titulo));

  // 4) B bucket corrigido?
  const { count } = await supabase.from('gt_documentos').select('*', { count: 'exact', head: true }).eq('tipo_documento', 'aso').eq('identity_match', 'match').is('deleted_at', null);
  console.log(`\nASOs ainda com identity_match='match': ${count}`);
}
run().catch(e => { console.error(e); process.exit(1); });
