const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const vinId = '9af7dceb-f7f7-43d9-81e1-87806307739f';
  const { data: docs } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('colaborador_id', vinId)
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null);

  const { data: asoMeta } = await supabase
    .from('gt_documentos_aso')
    .select('*')
    .in('documento_id', docs.map(d => d.id));

  console.log(`Vinicius currently has ${docs.length} active ASO docs:`);
  docs.forEach(d => {
    const meta = (asoMeta || []).find(m => m.documento_id === d.id);
    console.log({
      id: d.id,
      titulo: d.titulo,
      data_emissao: d.data_emissao,
      data_validade: d.data_validade,
      arquivo_url: d.arquivo_url ? d.arquivo_url.split('/').pop() : null,
      ocr_status: d.ocr_status,
      meta_tipo_exame: meta?.tipo_exame,
      meta_resultado: meta?.resultado,
      meta_data_realizacao: meta?.data_realizacao,
      meta_esocial_status: meta?.esocial_status,
      created_at: d.created_at
    });
  });
}

run();
