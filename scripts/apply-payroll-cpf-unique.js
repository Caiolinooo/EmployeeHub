/**
 * Executor da migration 20260923_000003_payroll_employees_cpf_unique.sql
 * (UNIQUE parcial (company_id, cpf) em payroll_employees — design §1, DevMerge).
 *
 * Padrão de scripts/apply-dp-folha-wk.js: lê SUPABASE env
 * (.env.local/.env/.env.production), aplica via pg direto quando possível e
 * cai para RPC exec_sql/execute_sql; no fim verifica o índice em pg_indexes.
 *
 * PRÉ-REQUISITO: npx tsx scripts/dedupe-payroll-employees.ts --apply até não
 * restarem duplicados de (company_id, cpf) — senão o CREATE UNIQUE INDEX falha.
 *
 * Idempotente: re-executar não falha (CREATE UNIQUE INDEX IF NOT EXISTS).
 *
 * Uso: node scripts/apply-payroll-cpf-unique.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MIGRATION = path.join(__dirname, '..', 'supabase', 'migrations', '20260923_000003_payroll_employees_cpf_unique.sql');
const INDEX_NAME = 'payroll_employees_company_cpf_key';

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

/** Confirmação real do índice no catálogo (o plano exige), não apenas select limit(1). */
async function verifyIndexViaPg() {
  if (!databaseUrl) return null;
  const { Client } = require('pg');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const idx = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
      [INDEX_NAME],
    );
    const dups = await client.query(`
      SELECT company_id, cpf, count(*) AS n
      FROM public.payroll_employees
      WHERE cpf IS NOT NULL AND cpf <> ''
      GROUP BY company_id, cpf
      HAVING count(*) > 1
    `);
    return { index: idx.rows, duplicados: dups.rows };
  } catch (e) {
    console.log('  Verificação via pg falhou:', e.message);
    return null;
  } finally {
    await client.end();
  }
}

async function main() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  console.log('Applying payroll_employees CPF unique index (000003)...');

  let applied = false;
  if (databaseUrl) {
    try {
      await runViaPg(sql);
      console.log('  OK via pg direct connection');
      applied = true;
    } catch (e) {
      console.log('  pg failed:', e.message);
      if (/duplicate key|could not create unique index/i.test(e.message)) {
        console.log('  HÁ DUPLICADOS de (company_id, cpf) — rode scripts/dedupe-payroll-employees.ts --apply antes.');
        process.exitCode = 1;
        return;
      }
    }
  }

  const supabase = (supabaseUrl && serviceKey)
    ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    : null;

  if (!applied && supabase) {
    const r = await runViaRpc(supabase, sql);
    console.log('  RPC result:', JSON.stringify(r));
  }

  const shape = await verifyIndexViaPg();
  if (shape) {
    if (shape.index.length > 0) {
      console.log(`  OK  index ${INDEX_NAME}`);
      console.log(`  def: ${shape.index[0].indexdef}`);
      console.log('APPLY_PAYROLL_CPF_UNIQUE_OK');
      return;
    }
    console.log(`ATENÇÃO: índice ${INDEX_NAME} não encontrado em pg_indexes.`);
    if (shape.duplicados.length > 0) {
      console.log(`Duplicados pendentes: ${JSON.stringify(shape.duplicados)}`);
    }
  } else {
    console.log('(Sem pg direto — shape do índice NÃO confirmado por esta via.)');
  }
  process.exitCode = 1;
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
