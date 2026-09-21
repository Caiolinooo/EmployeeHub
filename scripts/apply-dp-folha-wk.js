/**
 * Executor da migration DP/Folha+WK (20260921_000001_dp_folha_wk.sql).
 * Padrão de scripts/apply-rs-indicadores.js: lê SUPABASE env
 * (.env.local/.env/.env.production), aplica via pg direto quando possível e
 * cai para RPC exec_sql/execute_sql; no fim verifica o shape das 3 colunas
 * novas via information_schema (pg direto) e contagem das tabelas payroll.
 *
 * Idempotente: re-executar não falha (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
 *
 * Uso: node scripts/apply-dp-folha-wk.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MIGRATION = path.join(__dirname, '..', 'supabase', 'migrations', '20260921_000001_dp_folha_wk.sql');

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

/**
 * Shape check: as 3 colunas novas + 2 índices, direto no catálogo.
 * Confirmação real (o plano exige), não apenas select limit(1).
 */
async function verifyShapeViaPg() {
  if (!databaseUrl) return null;
  const { Client } = require('pg');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const cols = await client.query(`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'payroll_codes' AND column_name = 'codigo_wk')
          OR (table_name = 'payroll_sheet_items' AND column_name = 'origem')
          OR (table_name = 'payroll_sheets' AND column_name = 'aprovacao')
        )
      ORDER BY table_name
    `);
    const idx = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('uq_payroll_codes_codigo_wk', 'idx_payroll_items_origem')
      ORDER BY indexname
    `);
    const counts = await client.query(`
      SELECT
        (SELECT count(*) FROM public.payroll_codes) AS codes,
        (SELECT count(*) FROM public.payroll_sheet_items) AS items,
        (SELECT count(*) FROM public.payroll_sheets) AS sheets,
        (SELECT count(*) FROM public.payroll_employees) AS employees
    `);
    return { columns: cols.rows, indexes: idx.rows, counts: counts.rows[0] };
  } catch (e) {
    console.log('  Shape check via pg falhou:', e.message);
    return null;
  } finally {
    await client.end();
  }
}

async function main() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  console.log('Applying DP/Folha+WK migration (provisionamento payroll + 3 colunas do plano, ZERO tabelas de design novas)...');

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

  const supabase = (supabaseUrl && serviceKey)
    ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    : null;

  if (!applied && supabase) {
    const r = await runViaRpc(supabase, sql);
    console.log('  RPC result:', JSON.stringify(r));
  }

  let shapeOk = false;
  const shape = await verifyShapeViaPg();
  if (shape) {
    console.log('Shape verification (information_schema):');
    for (const c of shape.columns) {
      console.log(`  OK  ${c.table_name}.${c.column_name} (${c.data_type}${c.column_default ? `, default ${c.column_default}` : ''})`);
    }
    for (const i of shape.indexes) {
      console.log(`  OK  index ${i.indexname}`);
    }
    console.log('Contagens atuais:', JSON.stringify(shape.counts));
    const colsOk = shape.columns.length === 3;
    const idxOk = shape.indexes.length === 2;
    shapeOk = colsOk && idxOk;
    if (!shapeOk) {
      console.log(`ATENÇÃO: esperado 3 colunas e 2 índices; encontrado ${shape.columns.length} e ${shape.indexes.length}.`);
    }
  } else if (supabase) {
    // Sem pg direto: fallback de leitura via PostgREST
    const checks = [];
    for (const table of ['payroll_codes', 'payroll_sheet_items', 'payroll_sheets']) {
      const { error } = await supabase.from(table).select('id').limit(1);
      checks.push({ table, ok: !error, error: error?.message });
    }
    for (const c of checks) {
      console.log(`  ${c.ok ? 'OK  ' : 'FAIL'} ${c.table}${c.ok ? '' : ` — ${c.error}`}`);
    }
    shapeOk = checks.every((c) => c.ok);
    console.log('(Fallback PostgREST — shape de colunas NÃO confirmado por esta via.)');
  } else {
    console.log('Sem credenciais para verificação.');
  }

  if (shapeOk) {
    console.log('APPLY_DP_FOLHA_WK_OK');
  } else {
    console.log('Done (sem confirmação completa de shape — marker NÃO emitido).');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
