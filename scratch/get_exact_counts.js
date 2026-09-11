const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { count, error } = await supabase
    .from('gt_documentos')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  console.log(`Exact total non-deleted gt_documentos: ${count}`);

  const { count: asoCount } = await supabase
    .from('gt_documentos')
    .select('*', { count: 'exact', head: true })
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null);

  console.log(`Exact total non-deleted ASO documents: ${asoCount}`);
}

run();
