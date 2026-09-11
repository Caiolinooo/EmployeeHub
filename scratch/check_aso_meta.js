const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: asoMeta } = await supabase.from('gt_documentos_aso').select('*');
  console.log(`Total gt_documentos_aso rows: ${asoMeta.length}`);
  asoMeta.forEach(m => {
    console.log(`Doc ID: ${m.documento_id} | Colab: ${m.colaborador_id} | Tipo: ${m.tipo_exame} | Realiz: ${m.data_realizacao} | e-Social: ${m.esocial_status}`);
  });
}

run();
