/**
 * Executor genérico de arquivo SQL via conexão direta (DATABASE_URL).
 * Uso: node scripts/run-sql-file.js <caminho-do-arquivo.sql>
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const sqlPath = process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada no .env/.env.local');
  process.exit(1);
}
if (!sqlPath) {
  console.error('❌ Informe o caminho do arquivo SQL. Uso: node scripts/run-sql-file.js <arquivo.sql>');
  process.exit(1);
}

(async () => {
  const abs = path.resolve(process.cwd(), sqlPath);
  if (!fs.existsSync(abs)) {
    console.error(`❌ Arquivo não encontrado: ${abs}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(abs, 'utf8');
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log(`⚙️  Executando ${path.basename(abs)}...`);
    await client.query(sql);
    console.log('✅ SQL executado com sucesso.');
  } catch (err) {
    console.error('❌ Erro ao executar SQL:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
