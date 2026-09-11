const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStorage() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => b.name));

  for (const b of buckets || []) {
    const { data: files } = await supabase.storage.from(b.name).list('', { limit: 20 });
    console.log(`Bucket [${b.name}] files:`, files?.map(f => f.name));
  }

  // Check if there are any documents with arquivo_url in gt_documentos
  const { data: withUrl, count } = await supabase
    .from('gt_documentos')
    .select('id, colaborador_id, tipo_documento, titulo, arquivo_url, arquivo_path', { count: 'exact' })
    .not('arquivo_url', 'is', null);

  console.log(`\nTotal gt_documentos with arquivo_url: ${count}`);
  console.log('Sample docs with file:', withUrl?.slice(0, 10));

  // Check MIO import table or raw tables
  const { data: tables } = await supabase.rpc('get_tables').catch(() => ({ data: null }));
}

checkStorage();
