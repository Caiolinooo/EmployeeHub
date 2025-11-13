require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkTableStructure() {
  console.log('🔍 Verificando estrutura da tabela avaliacoes_desempenho...\n');
  
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = 'avaliacoes_desempenho'
      AND table_schema = 'public'
    ORDER BY ordinal_position;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
    
    if (error) {
      console.error('❌ Erro:', error);
      return;
    }
    
    console.log('✅ Estrutura encontrada:\n');
    console.table(data);
    
    // Verificar especificamente as colunas de relacionamento
    const funcionarioCol = data.find(c => c.column_name === 'funcionario_id');
    const gerenteCol = data.find(c => c.column_name === 'gerente_id');
    const avaliadorCol = data.find(c => c.column_name === 'avaliador_id');
    
    console.log('\n🎯 Colunas de relacionamento:');
    console.log('funcionario_id:', funcionarioCol ? '✅ EXISTE' : '❌ NÃO EXISTE');
    console.log('gerente_id:', gerenteCol ? '✅ EXISTE' : '❌ NÃO EXISTE');
    console.log('avaliador_id:', avaliadorCol ? '✅ EXISTE' : '❌ NÃO EXISTE');
    
  } catch (err) {
    console.error('❌ Erro:', err);
  }
}

checkTableStructure()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
