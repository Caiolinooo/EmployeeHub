const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const cid = '005a5ea6-e148-4223-95be-62cb45b116d5';
  const { data: docs } = await supabase.from('gt_documentos').select('id, titulo, arquivo_path, arquivo_hash, tipo_documento, identity_match, deleted_at, created_at, numero_rastreio, ocr_status').eq('colaborador_id', cid);
  console.log(`docs vivos de Adalberto: ${docs.filter(d => !d.deleted_at).length} / total ${docs.length}`);
  for (const d of docs) console.log(JSON.stringify(d));
  // procurar docs com "Vinicius" no título em qualquer lugar
  const { data: vin } = await supabase.from('gt_documentos').select('id, titulo, colaborador_id, identity_match, deleted_at, arquivo_hash, arquivo_path, created_at').ilike('titulo', '%Vinicius%');
  console.log('\n== docs com "Vinicius" no título:', vin.length);
  for (const v of vin) {
    const { data: c } = await supabase.from('gt_colaboradores').select('nome_completo, cpf').eq('id', v.colaborador_id).maybeSingle();
    const { data: a } = await supabase.from('gt_documentos_aso').select('id, cpf_documento, identity_match, esocial_status').eq('documento_id', v.id).maybeSingle();
    console.log(JSON.stringify({ ...v, colab: c?.nome_completo, cpf_doc: a?.cpf_documento ?? null, aso_match: a?.identity_match ?? null }));
  }
}
run().catch(e => { console.error(e); process.exit(1); });
