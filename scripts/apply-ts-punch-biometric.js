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
    path.join(__dirname, '..', 'supabase', 'migrations', '20261007_000007_ts_punch_biometric.sql'),
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
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'ts_punch_biometric' order by column_name",
    );
    console.log(cols.rows.map((row) => row.column_name).join('\n'));
    const rls = await client.query(
      "select relrowsecurity from pg_class where oid = 'public.ts_punch_biometric'::regclass",
    );
    console.log(rls.rows[0]?.relrowsecurity ? 'rls=on' : 'rls=off');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
