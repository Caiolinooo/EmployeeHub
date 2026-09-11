const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  for (const t of ['gt_documentos', 'gt_documentos_aso', 'gt_colaboradores']) {
    const { data, error } = await supabase.from(t).select('*').limit(2);
    if (error) { console.log(t, 'ERR', error.message); continue; }
    console.log('==', t, 'columns:', data.length ? Object.keys(data[0]).join(', ') : '(empty)');
  }
}
run();
