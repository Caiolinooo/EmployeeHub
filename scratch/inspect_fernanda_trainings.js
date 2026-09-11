const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: fernanda } = await supabase
    .from('gt_colaboradores')
    .select('*')
    .ilike('nome_completo', '%fernanda%veppo%')
    .single();

  console.log('Colaborador:', fernanda?.nome_completo, fernanda?.id, fernanda?.cpf);

  if (!fernanda) return;

  const { data: docs } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('colaborador_id', fernanda.id)
    .is('deleted_at', null);

  console.log(`\nFound ${docs?.length} documents for Fernanda:`);
  docs?.forEach((d, i) => {
    console.log(`\n[${i+1}] ID: ${d.id}`);
    console.log(`    Tipo: ${d.tipo_documento} | Titulo: ${d.titulo}`);
    console.log(`    Nº Doc: ${d.numero_documento} | Rastreio: ${d.numero_rastreio}`);
    console.log(`    Emissão: ${d.data_emissao} | Validade: ${d.data_validade} | Status: ${d.status_validacao}`);
    console.log(`    Arquivo URL: ${d.arquivo_url}`);
    console.log(`    Arquivo Path: ${d.arquivo_path}`);
    console.log(`    Origem: ${d.origem}`);
    console.log(`    Órgão Emissor: ${d.orgao_emissor}`);
    console.log(`    OCR Status: ${d.ocr_status}`);
  });
}

run();
