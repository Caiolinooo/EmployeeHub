require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkStructure() {
  // Primeiro, tentar pegar qualquer registro para ver a estrutura
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log('✅ Estrutura da tabela notifications:');
  if (data && data.length > 0) {
    console.log('\n📋 Colunas encontradas:');
    Object.keys(data[0]).forEach(key => {
      console.log(`  - ${key}: ${typeof data[0][key]} (${data[0][key] === null ? 'null' : JSON.stringify(data[0][key]).substring(0, 50)})`);
    });
  } else {
    console.log('\n⚠️ Tabela vazia, não há dados para verificar estrutura');
  }
  
  // Tentar usar PostgreSQL para ver a estrutura real
  const { data: schema } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `
  });
  
  if (schema) {
    console.log('\n📐 Schema completo:');
    console.table(schema);
  }
}

checkStructure().catch(console.error);
