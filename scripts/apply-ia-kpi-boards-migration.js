/**
 * Apply ia_kpi_boards migration via service role / DB URL.
 * Does NOT print secrets.
 *
 * Usage: node scripts/apply-ia-kpi-boards-migration.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFiles() {
  const files = ['.env.local', '.env', '.env.production'];
  const env = {};
  for (const f of files) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!env[key] && val) env[key] = val;
    }
  }
  return env;
}

const env = loadEnvFiles();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
const databaseUrl =
  env.DATABASE_URL ||
  env.SUPABASE_DB_URL ||
  env.POSTGRES_URL ||
  env.DIRECT_URL;

console.log('URL present:', !!supabaseUrl);
console.log(
  'Service key present:',
  !!serviceKey,
  serviceKey ? `(len=${serviceKey.length})` : ''
);
console.log('DB URL present:', !!databaseUrl);

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or service role key');
  process.exit(1);
}

const migrations = [
  'supabase/migrations/20260727_000003_ia_kpi_boards.sql',
  'supabase/migrations/20260727_000004_ia_kpi_boards_deleted_at.sql',
];

async function runViaPg(sql) {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    return { ok: true };
  } finally {
    await client.end();
  }
}

async function runViaRpc(supabase, sql) {
  const attempts = [
    { name: 'exec_sql', body: { sql_query: sql } },
    { name: 'exec_sql', body: { query: sql } },
    { name: 'execute_sql', body: { sql } },
    { name: 'execute_sql', body: { query: sql } },
    { name: 'execute_sql', body: { sql_param: sql } },
  ];
  for (const a of attempts) {
    const { error } = await supabase.rpc(a.name, a.body);
    if (!error) return { ok: true, via: a.name };
    if (!/could not find|does not exist|404|PGRST/i.test(error.message)) {
      return { ok: false, error: error.message, via: a.name };
    }
  }
  return { ok: false, error: 'No exec_sql/execute_sql RPC available' };
}

async function verifyTables(supabase) {
  const tables = ['ia_kpi_boards'];
  const results = {};
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (!error) {
      results[t] = 'ok';
    } else if (/does not exist|schema cache|PGRST205|42P01/i.test(error.message)) {
      results[t] = 'missing';
    } else {
      results[t] = `reachable (${error.message.slice(0, 80)})`;
    }
  }
  return results;
}

async function main() {
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  for (const rel of migrations) {
    const full = path.join(process.cwd(), rel);
    if (!fs.existsSync(full)) {
      console.log('SKIP missing file:', rel);
      continue;
    }
    const sql = fs.readFileSync(full, 'utf8');
    console.log('\nApplying', rel, `(${sql.length} chars)...`);

    let applied = false;
    if (databaseUrl) {
      try {
        await runViaPg(sql);
        console.log('  OK via pg');
        applied = true;
      } catch (e) {
        console.log('  pg failed:', e.message.slice(0, 200));
      }
    }

    if (!applied) {
      const r = await runViaRpc(supabase, sql);
      if (r.ok) {
        console.log('  OK via RPC', r.via);
        applied = true;
      } else {
        console.log('  RPC failed:', r.error);
      }
    }

    if (!applied) {
      console.error('FAILED to apply', rel);
      process.exit(1);
    }
  }

  console.log('\nVerifying tables...');
  const results = await verifyTables(supabase);
  for (const [t, s] of Object.entries(results)) {
    console.log(`  ${t}: ${s}`);
  }

  const missing = Object.entries(results).filter(([, s]) => s === 'missing');
  if (missing.length) {
    console.error('Some tables still missing');
    process.exit(1);
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
