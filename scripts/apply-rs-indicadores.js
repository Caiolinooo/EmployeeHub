/**
 * Executor da migration Indicadores R&S (20260918_000001_rs_indicadores.sql).
 * Padrão de scripts/apply-gt-fechamento-v2.js: lê SUPABASE env
 * (.env.local/.env/.env.production), aplica via pg direto quando possível e
 * cai para RPC exec_sql/execute_sql; no fim verifica o shape das 4 tabelas
 * (select de 1 linha de cada via cliente service_role) e o RLS.
 *
 * Idempotente: re-executar não falha (CREATE TABLE/INDEX IF NOT EXISTS).
 *
 * Uso: node scripts/apply-rs-indicadores.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MIGRATION = path.join(__dirname, '..', 'supabase', 'migrations', '20260918_000001_rs_indicadores.sql');

const TABELAS = ['rs_planilhas', 'rs_abas', 'rs_linhas', 'rs_importacoes'];

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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
const databaseUrl = env.DATABASE_URL || env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DIRECT_URL;

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
  }
  return { ok: false, error: 'No exec_sql/execute_sql RPC available' };
}

async function verifyShape(supabase) {
  const checks = [];
  for (const table of TABELAS) {
    const { error } = await supabase.from(table).select('id').limit(1);
    checks.push({ table, ok: !error, error: error?.message });
  }
  return checks;
}

async function verifyRlsViaPg() {
  if (!databaseUrl) return null;
  const { Client } = require('pg');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN ('rs_planilhas','rs_abas','rs_linhas','rs_importacoes')
      ORDER BY relname
    `);
    return rows;
  } catch (e) {
    console.log('  RLS check skipped:', e.message);
    return null;
  } finally {
    await client.end();
  }
}

async function main() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  console.log('Applying Indicadores R&S migration...');

  let applied = false;
  if (databaseUrl) {
    try {
      await runViaPg(sql);
      console.log('  OK via pg direct connection');
      applied = true;
    } catch (e) {
      console.log('  pg failed:', e.message);
    }
  }

  if (!supabaseUrl || !serviceKey) {
    console.log('  Supabase env ausente — verificação limitada.');
  }
  const supabase = (supabaseUrl && serviceKey)
    ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    : null;

  if (!applied && supabase) {
    const r = await runViaRpc(supabase, sql);
    console.log('  RPC result:', JSON.stringify(r));
  }

  let shapeOk = false;
  if (supabase) {
    const checks = await verifyShape(supabase);
    console.log('Shape verification:');
    for (const c of checks) {
      console.log(`  ${c.ok ? 'OK  ' : 'FAIL'} ${c.table}${c.ok ? '' : ` — ${c.error}`}`);
    }
    shapeOk = checks.every((c) => c.ok);
    if (!shapeOk) {
      console.log('ATENÇÃO: 1-2 min de cache do PostgREST podem ser necessários após a migration.');
      process.exitCode = 1;
    }
  }

  const rls = await verifyRlsViaPg();
  if (rls) {
    console.log('RLS (relrowsecurity):');
    for (const r of rls) {
      console.log(`  ${r.relname}: ${r.relrowsecurity ? 'enabled' : 'DISABLED (!)'}`);
    }
    if (rls.some((r) => !r.relrowsecurity)) process.exitCode = 1;
  }

  if (shapeOk) {
    console.log('APPLY_RS_INDICADORES_OK');
  } else {
    console.log('Done (sem confirmação de shape — marker NÃO emitido).');
  }
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
