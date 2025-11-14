require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltam variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNotificationsTable() {
  console.log('🔍 Verificando tabela notifications...\n');
  
  // Tentar selecionar da tabela
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);
  
  if (error) {
    if (error.code === 'PGRST204' || error.message.includes('does not exist')) {
      console.log('❌ Tabela "notifications" NÃO existe');
      console.log('\n📋 SQL para criar:');
      console.log('Execute o arquivo: supabase/migrations/20251113_create_notifications_table.sql');
      return false;
    }
    console.error('❌ Erro ao verificar:', error.message);
    return false;
  }
  
  console.log('✅ Tabela "notifications" já existe!');
  console.log(`📊 Registros encontrados: ${data?.length || 0}`);
  
  // Verificar estrutura
  const { data: structure, error: structError } = await supabase
    .rpc('exec_sql', { 
      sql_query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        ORDER BY ordinal_position;
      `
    });
  
  if (!structError && structure) {
    console.log('\n📐 Estrutura da tabela:');
    structure.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });
  }
  
  return true;
}

checkNotificationsTable()
  .then(exists => process.exit(exists ? 0 : 1))
  .catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
