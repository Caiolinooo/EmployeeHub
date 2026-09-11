const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: allAsos } = await supabase
    .from('gt_documentos')
    .select('*, gt_documentos_aso(*)')
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  console.log(`Currently remaining ${allAsos.length} ASO docs in gt_documentos:`);
  allAsos.forEach((d, i) => {
    const meta = d.gt_documentos_aso?.[0] || {};
    console.log(`${i + 1}. [${d.id}] Colab: ${d.colaborador_id}`);
    console.log(`   Titulo: ${d.titulo}`);
    console.log(`   Rastreio: ${d.numero_rastreio}`);
    console.log(`   Emissao: ${d.data_emissao} | Validade: ${d.data_validade}`);
    console.log(`   Realiz: ${meta.data_realizacao || 'N/A'} | Tipo: ${meta.tipo_exame || 'N/A'} | Res: ${meta.resultado || 'N/A'}`);
    console.log(`   Medico: ${meta.medico_nome || 'N/A'} (CRM: ${meta.medico_crm || 'N/A'})`);
    console.log(`   e-Social: ${meta.esocial_status || 'N/A'}`);
    console.log(`   Arquivo: ${d.arquivo_url ? d.arquivo_url.split('/').pop() : 'N/A'}`);
    console.log('');
  });
}

run();
