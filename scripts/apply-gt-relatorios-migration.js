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

async function main() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.gt_relatorios_aprovacoes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        mes_referencia VARCHAR(7) NOT NULL UNIQUE,
        ano INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        status VARCHAR(30) DEFAULT 'pendente_revisao' NOT NULL CHECK (status IN ('pendente_revisao', 'em_aprovacao', 'aprovado', 'rejeitado', 'enviado')),
        dados_totais JSONB DEFAULT '{}'::jsonb,
        total_colaboradores INTEGER DEFAULT 0,
        total_on INTEGER DEFAULT 0,
        total_dba INTEGER DEFAULT 0,
        total_fi INTEGER DEFAULT 0,
        total_tre INTEGER DEFAULT 0,
        aprovadores_obrigatorios JSONB DEFAULT '[]'::jsonb,
        assinaturas JSONB DEFAULT '[]'::jsonb,
        aprovado_por_id UUID,
        aprovado_por_nome TEXT,
        aprovado_por_cpf TEXT,
        aprovado_em TIMESTAMPTZ,
        aprovado_ip TEXT,
        assinatura_url TEXT,
        assinatura_hash TEXT,
        emails_enviados TEXT[] DEFAULT '{}'::text[],
        enviado_em TIMESTAMPTZ,
        observacoes TEXT,
        arquivo_url TEXT,
        arquivo_nome TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS aprovadores_obrigatorios JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.gt_relatorios_aprovacoes ADD COLUMN IF NOT EXISTS assinaturas JSONB DEFAULT '[]'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_gt_relatorios_mes_referencia ON gt_relatorios_aprovacoes(mes_referencia);
    CREATE INDEX IF NOT EXISTS idx_gt_relatorios_status ON gt_relatorios_aprovacoes(status);

    ALTER TABLE public.gt_relatorios_aprovacoes ENABLE ROW LEVEL SECURITY;
  `;

  console.log('Running migration...');
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

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (!applied) {
    const r = await runViaRpc(supabase, sql);
    console.log('  RPC result:', r);
  }

  const { data, error } = await supabase.from('gt_relatorios_aprovacoes').select('id, mes_referencia, status, assinaturas').limit(1);
  console.log('Verification query:', { data, error });
}

main();
