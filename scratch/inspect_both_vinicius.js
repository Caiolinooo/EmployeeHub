const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const colabIds = ['9af7dceb-f7f7-43d9-81e1-87806307739f', '9fb58004-62d0-4c67-beaa-09693a108be8'];
  for (const cid of colabIds) {
    const { data: c } = await supabase.from('gt_colaboradores').select('*').eq('id', cid).single();
    const { data: docs } = await supabase.from('gt_documentos').select('*').eq('colaborador_id', cid).is('deleted_at', null);
    const { data: asoMeta } = await supabase.from('gt_documentos_aso').select('*').in('documento_id', (docs || []).map(d => d.id));
    console.log(`\nColab ID: ${cid}`);
    console.log(`Nome: ${c.nome_completo}, CPF: ${c.cpf}, Cargo: ${c.cargo_id}, Status: ${c.status_embarque}, Matrícula: ${c.matricula}`);
    console.log(`Total Docs: ${docs.length} (ASOs: ${docs.filter(d => d.tipo_documento === 'aso').length})`);
    docs.forEach(d => {
      const meta = (asoMeta || []).find(m => m.documento_id === d.id);
      console.log(`  - Doc [${d.id}] Tipo: ${d.tipo_documento} | Titulo: ${d.titulo} | Rastreio: ${d.numero_rastreio} | e-Social: ${meta?.esocial_status || 'N/A'} | OCR: ${d.ocr_status}`);
    });
  }
}

run();
