/**
 * Migração: campos de salário em gt_colaboradores (moeda/período/natureza).
 * Padrão dos scripts de migração do repo (pg direto via DATABASE_URL).
 *
 * Uso: node scripts/add-salario-campos.js
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const NOVAS = [
  { coluna: 'salario_moeda', ddl: `salario_moeda VARCHAR(3) NOT NULL DEFAULT 'BRL'`, comentario: 'Moeda do salário: BRL, USD, EUR ou GBP.' },
  { coluna: 'salario_periodo', ddl: `salario_periodo VARCHAR(8) NOT NULL DEFAULT 'mes'`, comentario: 'Período do valor: hora, dia, mes ou ano.' },
  { coluna: 'salario_natureza', ddl: `salario_natureza VARCHAR(8) NOT NULL DEFAULT 'bruto'`, comentario: 'bruto ou liquido.' },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_URL in .env.local');
    process.exit(1);
  }
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PG Database.');

    for (const { coluna, ddl, comentario } of NOVAS) {
      const res = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'gt_colaboradores' AND column_name = $1`,
        [coluna],
      );
      if (res.rows.length) {
        console.log(`Column "${coluna}" already exists.`);
        continue;
      }
      console.log(`Adding "${coluna}" to gt_colaboradores...`);
      await client.query(`ALTER TABLE gt_colaboradores ADD COLUMN ${ddl};`);
      await client.query(`COMMENT ON COLUMN gt_colaboradores.${coluna} IS '${comentario}';`);
      console.log(`Column "${coluna}" added.`);
    }

    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Done. ADD_SALARIO_CAMPOS_OK');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
