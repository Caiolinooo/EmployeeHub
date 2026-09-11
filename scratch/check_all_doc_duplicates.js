const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: allDocs } = await supabase
    .from('gt_documentos')
    .select('id, colaborador_id, tipo_documento, titulo, numero_documento, numero_rastreio, data_emissao, data_validade, arquivo_url, arquivo_hash, created_at')
    .is('deleted_at', null);

  console.log(`Total non-deleted documents in DB: ${allDocs.length}`);

  // Count by tipo_documento
  const countByType = {};
  allDocs.forEach(d => {
    countByType[d.tipo_documento] = (countByType[d.tipo_documento] || 0) + 1;
  });
  console.log('Document counts by type:', countByType);

  // Group by (colaborador_id, tipo_documento, normalized_title, data_emissao, data_validade)
  const dupGroups = new Map();
  allDocs.forEach(d => {
    if (!d.colaborador_id) return;
    const cleanTitle = (d.titulo || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const key = `${d.colaborador_id}_${d.tipo_documento}_${cleanTitle}_${d.data_emissao || 'NE'}_${d.data_validade || 'NV'}`;
    if (!dupGroups.has(key)) dupGroups.set(key, []);
    dupGroups.get(key).push(d);
  });

  let totalDups = 0;
  const dupByType = {};
  for (const [key, docs] of dupGroups.entries()) {
    if (docs.length > 1) {
      const type = docs[0].tipo_documento;
      dupByType[type] = (dupByType[type] || 0) + (docs.length - 1);
      totalDups += (docs.length - 1);
    }
  }

  console.log('\nDuplicates by document type:', dupByType);
  console.log(`Total duplicate documents across all types: ${totalDups}`);
}

run();
