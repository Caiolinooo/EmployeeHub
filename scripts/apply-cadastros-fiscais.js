/**
 * Executor da migration Cadastros fiscais (20260923_000001_cadastros_fiscais.sql).
 * Padrão de scripts/apply-financeiro-core.js: lê SUPABASE env (.env.local/.env/
 * .env.production), aplica via pg direto quando possível e cai para RPC
 * exec_sql/execute_sql; no fim verifica que TODAS as colunas novas existem
 * (information_schema via pg; fallback: select das colunas via PostgREST).
 *
 * Idempotente: re-executar não falha (ADD COLUMN IF NOT EXISTS).
 *
 * Uso: node scripts/apply-cadastros-fiscais.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MIGRATION = path.join(__dirname, '..', 'supabase', 'migrations', '20260923_000001_cadastros_fiscais.sql');

// Colunas novas por tabela (espelho exato da migration — §1 do design dp-folha).
const COLUNAS = {
  payroll_companies: [
    'razao_social', 'nome_fantasia', 'inscricao_estadual', 'inscricao_municipal',
    'logradouro', 'numero', 'complemento', 'bairro', 'cep', 'municipio', 'uf',
    'municipio_ibge', 'cnae_principal',
  ],
  fin_clientes: [
    'inscricao_municipal', 'inscricao_estadual', 'pais', 'tax_id', 'default_template_id',
  ],
  fin_fatura_itens: ['codigo_lc116', 'aliquota_iss', 'cnae'],
  fin_contas_bancarias: [
    'swift_bic', 'iban', 'routing_number', 'sort_code', 'moeda', 'banco_correspondente',
  ],
  fin_faturas: ['vessel_name', 'po_number'],
};

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

/** Verificação preferencial: information_schema via pg (sem cache PostgREST). */
async function verifyColumnsViaPg() {
  if (!databaseUrl) return null;
  const { Client } = require('pg');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const checks = [];
    for (const [table, cols] of Object.entries(COLUNAS)) {
      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      const existentes = new Set(rows.map((r) => r.column_name));
      for (const col of cols) {
        checks.push({ table, column: col, ok: existentes.has(col) });
      }
    }
    return checks;
  } catch (e) {
    console.log('  pg column check skipped:', e.message);
    return null;
  } finally {
    await client.end();
  }
}

/** Fallback: select das colunas novas via PostgREST (sujeito a cache de schema). */
async function verifyColumnsViaSupabase(supabase) {
  const checks = [];
  for (const [table, cols] of Object.entries(COLUNAS)) {
    const { error } = await supabase.from(table).select(cols.join(',')).limit(1);
    for (const col of cols) {
      checks.push({ table, column: col, ok: !error, error: error?.message });
    }
  }
  return checks;
}

async function main() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  console.log('Applying Cadastros fiscais migration (20260923_000001)...');

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

  let checks = await verifyColumnsViaPg();
  if (!checks && supabase) {
    checks = await verifyColumnsViaSupabase(supabase);
  }

  let shapeOk = false;
  if (checks) {
    console.log('Column verification:');
    for (const c of checks) {
      console.log(`  ${c.ok ? 'OK  ' : 'FAIL'} ${c.table}.${c.column}${c.ok ? '' : ` — ${c.error || 'ausente'}`}`);
    }
    shapeOk = checks.every((c) => c.ok);
    if (!shapeOk) {
      console.log('ATENÇÃO: 1-2 min de cache do PostgREST podem ser necessários após a migration.');
      process.exitCode = 1;
    }
  }

  if (shapeOk) {
    console.log('APPLY_CADASTROS_OK');
  } else {
    console.log('Done (sem confirmação de colunas — marker NÃO emitido).');
  }
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
