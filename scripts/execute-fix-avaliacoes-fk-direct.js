const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Configuração da conexão PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function executeSQLFile() {
  const client = await pool.connect();

  try {
    console.log('🔧 Iniciando correção de foreign keys das avaliações...\n');

    // Ler arquivo SQL
    const sqlFilePath = path.join(__dirname, 'fix-avaliacoes-foreign-keys-to-users-unified.sql');
    console.log(`📄 Lendo arquivo: ${sqlFilePath}`);

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`✓ Arquivo lido com sucesso (${sqlContent.length} caracteres)\n`);

    // Executar SQL
    console.log('⚙️  Executando script SQL...\n');
    const result = await client.query(sqlContent);

    console.log('✓ Script SQL executado com sucesso!\n');

    // Verificar foreign keys criadas
    console.log('🔍 Verificando foreign keys em avaliacoes_desempenho...');
    const { rows: constraints } = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'avaliacoes_desempenho'
      ORDER BY tc.constraint_name;
    `);

    console.log(`\n✓ Foreign keys encontradas: ${constraints.length}\n`);
    constraints.forEach(c => {
      console.log(`  📌 ${c.constraint_name}`);
      console.log(`     └─ ${c.table_name}.${c.column_name} → ${c.foreign_table_name}.${c.foreign_column_name}`);
    });

    console.log('\n✅ Correção de foreign keys concluída!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ As foreign keys agora apontam para users_unified');
    console.log('✓ Próximos passos: Atualizar os arquivos da API');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Erro ao executar script:', error.message);
    console.error('Detalhes:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
executeSQLFile();
