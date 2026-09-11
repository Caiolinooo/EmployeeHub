const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: docsVin1 } = await supabase.from('gt_documentos').select('id, titulo, tipo_documento, numero_rastreio').eq('colaborador_id', '9af7dceb-f7f7-43d9-81e1-87806307739f');
  const { data: docsVin2 } = await supabase.from('gt_documentos').select('id, titulo, tipo_documento, numero_rastreio').eq('colaborador_id', '9fb58004-62d0-4c67-beaa-09693a108be8');

  console.log('Docs on Vinicius 1 (9af7...):', docsVin1.map(d => `${d.tipo_documento}: ${d.titulo}`));
  console.log('\nDocs on Vinicius 2 (9fb5...):', docsVin2.map(d => `${d.tipo_documento}: ${d.titulo}`));
}

run();
