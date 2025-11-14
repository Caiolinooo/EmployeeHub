/**
 * Script para executar correção da função RPC de notificações
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não configurada no .env.local');
  process.exit(1);
}

async function executarMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Conectando ao banco de dados...\n');
    await client.connect();
    console.log('✅ Conectado com sucesso!\n');

    const sqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '20251201_fix_notification_rpc_types.sql');
    console.log('📄 Lendo arquivo:', sqlFile);

    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFile}`);
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log('✅ Arquivo SQL carregado\n');

    console.log('⚙️  Executando migration...\n');
    await client.query(sqlContent);
    console.log('✅ Migration executada com sucesso!\n');

    // Verificar função criada
    console.log('🔍 Verificando função create_notification_bypass_rls...\n');
    const result = await client.query(`
      SELECT 
        p.proname as function_name,
        pg_get_function_result(p.oid) as return_type
      FROM pg_proc p
      WHERE p.proname = 'create_notification_bypass_rls';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Função encontrada:');
      console.log(`  Nome: ${result.rows[0].function_name}`);
      console.log(`  Retorno: ${result.rows[0].return_type}`);
    } else {
      console.log('❌ Função não encontrada');
    }

    console.log('\n✅ Correção concluída com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro ao executar migration:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Conexão encerrada');
  }
}

executarMigration();
