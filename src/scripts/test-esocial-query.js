/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- script legado CommonJS executado direto pelo node */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function testQuery() {
  const queries = [
    { name: "With column hint (evento_codigo)", query: '*, esocial_eventos_catalogo!evento_codigo(nome)' },
    { name: "With constraint hint (fk_esocial_eventos_catalogo)", query: '*, esocial_eventos_catalogo!fk_esocial_eventos_catalogo(nome)' },
    { name: "Without hint", query: '*, esocial_eventos_catalogo(nome)' }
  ];

  for (const q of queries) {
    console.log(`Testing query: ${q.name}...`);
    try {
      const { data, error } = await supabaseAdmin
        .from('esocial_eventos')
        .select(q.query, { count: 'exact' })
        .limit(1);

      if (error) {
        console.error(`❌ Query failed:`, error.message);
        console.error(`Full error:`, error);
      } else {
        console.log(`✅ Query succeeded! Count:`, data?.length);
      }
    } catch (err) {
      console.error(`❌ Unexpected error:`, err);
    }
    console.log('-----------------------------------');
  }
}

testQuery();
