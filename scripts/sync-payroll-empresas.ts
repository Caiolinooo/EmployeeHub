/**
 * Sync — espelha a estrutura organizacional do GT na folha.
 * A regra vive em src/lib/payroll/sync-estrutura-gt.ts (o cron da manhã
 * chama a mesma função). Este script só liga o cliente e imprime o resumo.
 *
 * Uso: npx tsx scripts/sync-payroll-empresas.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { sincronizarEstruturaGt } from '../src/lib/payroll/sync-estrutura-gt';

function loadEnvFiles(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of ['.env.local', '.env', '.env.production']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!env[m[1]] && val) env[m[1]] = val;
    }
  }
  return env;
}

async function main() {
  const env = loadEnvFiles();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env ausente (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const r = await sincronizarEstruturaGt(supabase);
  console.log(
    `Empresas: ${r.empresas.inseridas} inseridas, ${r.empresas.atualizadas} atualizadas, ${r.empresas.desativadas} desativadas.`,
  );
  if (r.empresas.semCnpj.length) {
    console.log(`Sem CNPJ (não inseridas): ${r.empresas.semCnpj.join(', ')}`);
  }
  if (r.empresas.inativasIgnoradas.length) {
    console.log(`Inativas no GT (não semeadas): ${r.empresas.inativasIgnoradas.join(', ')}`);
  }
  console.log(
    `Departments: ${r.departments.inseridos} inseridos, ${r.departments.atualizados} atualizados, ${r.departments.desativados} desativados.`,
  );
  console.log('SYNC_PAYROLL_EMPRESAS_OK');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
