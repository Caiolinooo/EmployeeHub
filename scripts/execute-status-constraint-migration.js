require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function executarMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '20251201_update_status_constraint.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    await client.query(sqlContent);
    console.log('✅ Constraint de status atualizada com sucesso!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executarMigration();
