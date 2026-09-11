const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectCaioDoc() {
  const { data: colabs } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf')
    .ilike('nome_completo', '%CAIO VALERIO%');

  console.log('Colaborador:', colabs);
  if (!colabs || colabs.length === 0) return;

  const colab = colabs[0];
  const { data: docs } = await supabase
    .from('gt_documentos')
    .select('id, titulo, arquivo_url, ocr_status, ocr_texto, ocr_dados_extraidos, identity_match')
    .eq('colaborador_id', colab.id);

  console.log('Docs for Caio:', docs?.map(d => ({
    id: d.id,
    titulo: d.titulo,
    ocr_status: d.ocr_status,
    ocr_dados: d.ocr_dados_extraidos,
    identity_match: d.identity_match,
    texto_sample: d.ocr_texto ? d.ocr_texto.substring(0, 400) : null
  })));

  const { data: asos } = await supabase
    .from('gt_documentos_aso')
    .select('*')
    .eq('colaborador_id', colab.id);

  console.log('ASOs for Caio:', asos);
}

inspectCaioDoc();
