/**
 * Aplica URLs oficiais da SPE de Macaé (A1 único / ABRASF 2.03).
 * Idempotente. Uso: node scripts/apply-nfse-macae-oficial.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MIGRATION = path.join(__dirname, '..', 'supabase', 'migrations', '20260923_000004_nfse_certificado_unico_macae.sql');
const MACAE = '3302403';
const URL_PROD = 'https://spe.macae.rj.gov.br/nfse/WSNacional2/nfse.asmx';

function loadEnvFiles() {
  const env = {};
  for (const f of ['.env.local', '.env', '.env.production']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!env[m[1]] && val) env[m[1]] = val;
    }
  }
  return env;
}

async function main() {
  const env = loadEnvFiles();
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const databaseUrl = env.DATABASE_URL || env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DIRECT_URL;
  if (databaseUrl) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  } else {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.from('fin_municipios').upsert({
      codigo_ibge: MACAE,
      nome: 'Macaé',
      uf: 'RJ',
      provider_sugerido: 'abrasf204',
      wsdl_url: URL_PROD,
      ambiente_urls: {
        producao: URL_PROD,
        homologacao: 'https://macaehomologacao.nfe.com.br/nfse/wsnacional2/nfse.asmx',
      },
    });
    if (error) throw error;
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase
    .from('fin_municipios')
    .select('codigo_ibge, provider_sugerido, wsdl_url')
    .eq('codigo_ibge', MACAE)
    .maybeSingle();
  if (error || !data) throw error || new Error('Macaé ausente');
  if (data.wsdl_url !== URL_PROD) throw new Error(`wsdl_url inesperado: ${data.wsdl_url}`);
  console.log('APPLY_NFSE_MACAE_OFICIAL_OK', data.provider_sugerido, data.wsdl_url);
}

main().catch((e) => {
  console.error('APPLY_NFSE_MACAE_OFICIAL_FAIL', e.message || e);
  process.exit(1);
});
