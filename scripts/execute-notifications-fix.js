/**
 * Script para executar migration de correção da tabela notifications
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

    const sqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '20251201_fix_notifications_missing_columns.sql');
    console.log('📄 Lendo arquivo:', sqlFile);

    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFile}`);
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log('✅ Arquivo SQL carregado\n');

    console.log('⚙️  Executando migration...\n');
    await client.query(sqlContent);
    console.log('✅ Migration executada com sucesso!\n');

    // Verificar colunas criadas
    console.log('🔍 Verificando colunas da tabela notifications...\n');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `);

    console.log('Colunas encontradas:');
    result.rows.forEach(col => {
      console.log(`  ✅ ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

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
