/**
 * Setup dos buckets privados do módulo Financeiro (§2.3 do design):
 *   - financeiro-certificados — .pfx/.cer de mTLS (download server-side apenas)
 *   - financeiro-templates    — xlsx/html de layout de fatura
 * Padrão de scripts/setup-esocial-bucket.js. Idempotente.
 * Uso: node scripts/setup-financeiro-bucket.js  → FIN_BUCKETS_OK
 */
const { createClient } = require('@supabase/supabase-js');

const BUCKETS = [
  { name: 'financeiro-certificados', fileSizeLimit: 5 * 1024 * 1024 },
  { name: 'financeiro-templates', fileSizeLimit: 10 * 1024 * 1024 },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Padrão do repo: ler .env.local/.env/.env.production se o shell não exportou.
    const fs = require('fs');
    const path = require('path');
    const env = {};
    for (const f of ['.env.local', '.env', '.env.production']) {
      const p = path.join(process.cwd(), f);
      if (!fs.existsSync(p)) continue;
      for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m && !env[m[1]] && m[2].trim()) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Erro: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('Configurando buckets privados do Financeiro...');

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Erro ao listar buckets:', listError);
    process.exit(1);
  }

  for (const def of BUCKETS) {
    const exists = buckets?.some((b) => b.name === def.name);
    if (exists) {
      console.log(`Bucket ${def.name} já existe`);
      const current = buckets.find((b) => b.name === def.name);
      if (current?.public) {
        console.error(`Erro: bucket ${def.name} existe mas é PÚBLICO — privacidade obrigatória (certificados/templates).`);
        process.exit(1);
      }
    } else {
      const { error: createError } = await supabase.storage.createBucket(def.name, {
        public: false,
        fileSizeLimit: def.fileSizeLimit,
      });
      if (createError) {
        console.error(`Erro ao criar bucket ${def.name}:`, createError);
        process.exit(1);
      }
      console.log(`Bucket ${def.name} criado com sucesso (privado)`);
    }
  }

  // Sem policies de storage: acesso só via supabaseAdmin/service_role (padrão RLS do design §2).
  console.log('Setup concluído (buckets privados, sem policies públicas)');
  console.log('FIN_BUCKETS_OK');
}

main().catch((e) => {
  console.error('Setup falhou:', e);
  process.exit(1);
});
