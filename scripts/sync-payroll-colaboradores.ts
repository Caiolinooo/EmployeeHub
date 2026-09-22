/**
 * Sync — espelha os colaboradores do GT na folha (payroll_employees).
 * A regra vive em src/lib/payroll/sync-colaboradores-gt.ts.
 * Rode depois de sync-payroll-empresas.ts (precisa da empresa e dos centros).
 *
 * Uso: npx tsx scripts/sync-payroll-colaboradores.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { sincronizarColaboradoresGt } from '../src/lib/payroll/sync-colaboradores-gt';

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

  const r = await sincronizarColaboradoresGt(supabase);
  console.log(
    `Colaboradores: ${r.inseridos} inseridos, ${r.atualizados} atualizados, ${r.inalterados} sem mudança.`,
  );
  if (r.pendencias.length) {
    console.log(`\nPendências (${r.pendencias.length}) — nada foi gravado para estes:`);
    for (const p of r.pendencias.slice(0, 30)) console.log(`  ${p.cpf} ${p.nome} — ${p.motivo}`);
    if (r.pendencias.length > 30) console.log(`  ... e mais ${r.pendencias.length - 30}`);
  }
  if (r.semSalario.length) {
    console.log(`\nSem salário base (${r.semSalario.length}) — a ficha existe, mas o valor precisa ser informado:`);
    for (const s of r.semSalario.slice(0, 30)) console.log(`  ${s.cpf} ${s.nome}`);
    if (r.semSalario.length > 30) console.log(`  ... e mais ${r.semSalario.length - 30}`);
  }
  console.log('\nSYNC_PAYROLL_COLABORADORES_OK');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
