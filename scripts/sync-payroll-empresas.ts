/**
 * Sync — espelha a estrutura organizacional do GT na folha:
 *   gt_empresas       → payroll_companies  (upsert por CNPJ dígitos ou nome)
 *   gt_centros_custo  → payroll_departments (upsert por company_id+code)
 *
 * GT é a fonte da verdade (decisão do usuário):
 *   - GT ativa   → payroll is_active = true (insere se faltar)
 *   - GT inativa → is_active = false se já existir; nunca insere inativa
 *   - Sem CNPJ   → só atualiza por nome; não insere (cnpj é NOT NULL UNIQUE)
 *   - payroll_companies sem contraparte em gt_empresas → is_active = false
 *     (cobre o protótipo "LUZ MARÍTIMA LTDA", que não existe no GT)
 *   - departments: centros ativos viram departments de TODA payroll company
 *     ativa (GT tem 1 empresa-holding; os centros cortam todas as fichas)
 *
 * Idempotente: re-executar não duplica nem desfaz edições manuais de outros
 * campos (só name/is_active/cnpj e code/name/is_active são tocados).
 *
 * Uso: npx tsx scripts/sync-payroll-empresas.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

const digitos = (v: string | null | undefined): string => (v || '').replace(/\D/g, '');

const formatarCnpj = (v: string): string => {
  const d = digitos(v);
  return d.length === 14
    ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : v;
};

interface GtEmpresa {
  id: string;
  nome: string | null;
  cnpj: string | null;
  ativo: boolean | null;
}

interface GtCentroCusto {
  id: string;
  nome: string | null;
  codigo: string | null;
  ativo: boolean | null;
}

interface PayrollCompany {
  id: string;
  name: string;
  cnpj: string;
  is_active: boolean;
}

interface PayrollDepartment {
  id: string;
  company_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

async function main() {
  const env = loadEnvFiles();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env ausente (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // ─── Empresas ──────────────────────────────────────────────────────────────
  const { data: gtRows, error: gtErr } = await supabase
    .from('gt_empresas')
    .select('id, nome, cnpj, ativo')
    .order('nome');
  if (gtErr) throw new Error(`gt_empresas: ${gtErr.message}`);
  const gt = (gtRows || []) as GtEmpresa[];
  console.log(`gt_empresas: ${gt.length} linhas (${gt.filter((e) => e.ativo !== false).length} ativas)`);

  const { data: prRows, error: prErr } = await supabase
    .from('payroll_companies')
    .select('id, name, cnpj, is_active');
  if (prErr) throw new Error(`payroll_companies: ${prErr.message}`);
  const payroll = (prRows || []) as PayrollCompany[];
  const porCnpj = new Map(payroll.map((p) => [digitos(p.cnpj), p]));
  const porNome = new Map(payroll.map((p) => [p.name.trim().toLowerCase(), p]));

  let inseridas = 0;
  let atualizadas = 0;
  const semCnpjPuladas: string[] = [];
  const inativasIgnoradas: string[] = [];

  for (const e of gt) {
    const nome = (e.nome || '').trim();
    if (!nome) continue;
    const ativa = e.ativo !== false;
    const d = digitos(e.cnpj);

    const existente = (d && porCnpj.get(d)) || porNome.get(nome.toLowerCase()) || null;

    if (!ativa && !existente) {
      inativasIgnoradas.push(nome);
      continue;
    }
    if (!d && !existente) {
      semCnpjPuladas.push(nome);
      continue;
    }

    if (existente) {
      const patch: Record<string, unknown> = { name: nome, is_active: ativa };
      if (d && !digitos(existente.cnpj)) patch.cnpj = formatarCnpj(e.cnpj || '');
      const { error } = await supabase.from('payroll_companies').update(patch).eq('id', existente.id);
      if (error) throw new Error(`update ${nome}: ${error.message}`);
      atualizadas += 1;
      console.log(`  ~ ${nome} (is_active=${ativa})`);
    } else {
      const { error } = await supabase
        .from('payroll_companies')
        .insert({ name: nome, cnpj: formatarCnpj(e.cnpj || ''), is_active: true });
      if (error) throw new Error(`insert ${nome}: ${error.message}`);
      inseridas += 1;
      console.log(`  + ${nome}`);
    }
  }

  // Sem contraparte GT ativa → sai do select (protótipo Luz Marítima cai aqui).
  const gtAtivosCnpj = new Set(gt.filter((e) => e.ativo !== false).map((e) => digitos(e.cnpj)).filter(Boolean));
  const gtAtivosNome = new Set(gt.filter((e) => e.ativo !== false).map((e) => (e.nome || '').trim().toLowerCase()));
  let desativadas = 0;
  for (const p of payroll) {
    const temContraparte = gtAtivosCnpj.has(digitos(p.cnpj)) || gtAtivosNome.has(p.name.trim().toLowerCase());
    if (!temContraparte && p.is_active) {
      const { error } = await supabase.from('payroll_companies').update({ is_active: false }).eq('id', p.id);
      if (error) throw new Error(`desativar ${p.name}: ${error.message}`);
      desativadas += 1;
      console.log(`  - ${p.name} (sem contraparte GT ativa → is_active=false)`);
    }
  }

  console.log(`\nEmpresas: ${inseridas} inseridas, ${atualizadas} atualizadas, ${desativadas} desativadas.`);
  if (semCnpjPuladas.length) {
    console.log(`Sem CNPJ (não inseridas, cnpj é NOT NULL): ${semCnpjPuladas.join(', ')}`);
  }
  if (inativasIgnoradas.length) {
    console.log(`Inativas no GT (não semeadas): ${inativasIgnoradas.join(', ')}`);
  }

  // ─── Centros de custo → departments ────────────────────────────────────────
  const { data: ccRows, error: ccErr } = await supabase
    .from('gt_centros_custo')
    .select('id, nome, codigo, ativo')
    .order('nome');
  if (ccErr) throw new Error(`gt_centros_custo: ${ccErr.message}`);
  const centros = (ccRows || []) as GtCentroCusto[];
  const centrosAtivos = centros.filter((c) => c.ativo !== false && (c.nome || '').trim());
  console.log(`\ngt_centros_custo: ${centros.length} linhas (${centrosAtivos.length} ativas)`);

  const { data: empresasAtivas, error: eaErr } = await supabase
    .from('payroll_companies')
    .select('id, name')
    .eq('is_active', true);
  if (eaErr) throw new Error(`payroll_companies ativas: ${eaErr.message}`);

  let deptInseridos = 0;
  let deptAtualizados = 0;
  for (const emp of empresasAtivas || []) {
    const { data: deptRows, error: dErr } = await supabase
      .from('payroll_departments')
      .select('id, company_id, code, name, is_active')
      .eq('company_id', emp.id);
    if (dErr) throw new Error(`payroll_departments ${emp.name}: ${dErr.message}`);
    const existentes = new Map(((deptRows || []) as PayrollDepartment[]).map((d) => [d.code, d]));

    for (const c of centrosAtivos) {
      const nome = (c.nome || '').trim();
      const code = ((c.codigo || nome).trim() || nome).slice(0, 10);
      const existente = existentes.get(code);
      if (existente) {
        if (existente.name !== nome || !existente.is_active) {
          const { error } = await supabase
            .from('payroll_departments')
            .update({ name: nome, is_active: true })
            .eq('id', existente.id);
          if (error) throw new Error(`update dept ${code}: ${error.message}`);
          deptAtualizados += 1;
        }
      } else {
        const { error } = await supabase
          .from('payroll_departments')
          .insert({ company_id: emp.id, code, name: nome, is_active: true });
        if (error) throw new Error(`insert dept ${code} em ${emp.name}: ${error.message}`);
        deptInseridos += 1;
        console.log(`  + [${emp.name}] ${code} — ${nome}`);
      }
    }

    // Centro que deixou de existir/estar ativo no GT → department inativo (soft).
    const codigosAtivos = new Set(centrosAtivos.map((c) => (((c.codigo || c.nome || '').trim()) || '').slice(0, 10)));
    for (const d of (deptRows || []) as PayrollDepartment[]) {
      if (!codigosAtivos.has(d.code) && d.is_active) {
        const { error } = await supabase
          .from('payroll_departments')
          .update({ is_active: false })
          .eq('id', d.id);
        if (error) throw new Error(`desativar dept ${d.code}: ${error.message}`);
        console.log(`  - [${emp.name}] ${d.code} (centro inativo/removido no GT → is_active=false)`);
      }
    }
  }
  console.log(`Departments: ${deptInseridos} inseridos, ${deptAtualizados} atualizados.`);

  // ─── Estado final ──────────────────────────────────────────────────────────
  const { data: finalRows } = await supabase
    .from('payroll_companies')
    .select('name, cnpj, is_active')
    .order('name');
  console.log('\npayroll_companies agora:');
  for (const p of finalRows || []) {
    console.log(`  ${p.is_active ? '[x]' : '[ ]'} ${p.name} — ${p.cnpj}`);
  }
  const { data: finalDepts } = await supabase
    .from('payroll_departments')
    .select('code, name, is_active, company:payroll_companies(name)')
    .order('code');
  console.log('\npayroll_departments agora:');
  for (const d of finalDepts || []) {
    const emp = Array.isArray(d.company) ? d.company[0] : d.company;
    console.log(`  ${d.is_active ? '[x]' : '[ ]'} ${d.code} — ${d.name} (${emp?.name || '?'})`);
  }

  console.log('\nSYNC_PAYROLL_EMPRESAS_OK');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
