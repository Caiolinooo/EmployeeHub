require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente');
    process.exit(1);
  }
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20261007_000006_timesheet_folha_vinculo.sql'),
    'utf8',
  );
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    const cols = await client.query(
      "select table_name, column_name from information_schema.columns where table_schema = 'public' and ((table_name = 'ts_timesheet_resumo' and column_name in ('lines','folha_status','folha_motivo')) or (table_name = 'payroll_codes' and column_name = 'codigo_timesheet')) order by table_name, column_name",
    );
    console.log(cols.rows.map((r) => `${r.table_name}.${r.column_name}`).join('\n'));
    const idx = await client.query(
      "select indexname from pg_indexes where indexname = 'uq_payroll_codes_codigo_timesheet'",
    );
    console.log(idx.rows.length ? 'index=ok' : 'index=missing');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
