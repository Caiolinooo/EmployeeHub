const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: allVin } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf, deleted_at, status_embarque, matricula')
    .ilike('nome_completo', '%vinicius%');

  console.log('Vinicius in gt_colaboradores:', allVin);

  const { data: docs } = await supabase
    .from('gt_documentos')
    .select('id, colaborador_id, tipo_documento, titulo, deleted_at, numero_rastreio, created_at')
    .ilike('titulo', '%vinicius%');

  console.log(`Documents mentioning Vinicius: ${docs.length}`);
  const byColabId = {};
  docs.forEach(d => {
    byColabId[d.colaborador_id] = (byColabId[d.colaborador_id] || 0) + 1;
  });
  console.log('Document count by colaborador_id:', byColabId);
}

run();
