/**
 * Dedupe de payroll_employees por (company_id, cpf normalizado 11 dígitos).
 * Pré-requisito da migration 20260923_000003_payroll_employees_cpf_unique.sql
 * (design §1): o CREATE UNIQUE INDEX falha enquanto houver duplicata.
 *
 * Uso:
 *   npx tsx scripts/dedupe-payroll-employees.ts            # dry-run (default, só lista)
 *   npx tsx scripts/dedupe-payroll-employees.ts --apply    # aplica o dedupe
 *
 * --apply, por grupo de duplicados:
 *   1. mantém o registro MAIS ANTIGO (created_at, desempate por id);
 *   2. re-aponta payroll_sheet_items / payroll_employee_summaries /
 *      payroll_contracheque_aceites (se a tabela existir) para o mantido;
 *   3. merge ADITIVO de campos (só preenche vazio no mantido; status
 *      'terminated' do duplicado prevalece — rescisão é terminal);
 *   4. deleta o duplicado e loga cada operação (+ payroll_audit_log).
 */
import fs from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of ['.env.local', '.env']) {
    try {
      for (const l of fs.readFileSync(f, 'utf-8').split('\n')) {
        const t = l.trim();
        if (!t || t.startsWith('#') || !t.includes('=')) continue;
        const [k, ...r] = t.split('=');
        env[k.trim()] = r.join('=').trim();
      }
    } catch { /* ausente */ }
  }
  return env;
}

const digitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');
const vazio = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  (typeof v === 'string' && v.trim() === '') ||
  (typeof v === 'number' && v === 0);

interface EmployeeRow {
  id: string;
  company_id: string;
  employee_id: string | null;
  department_id: string | null;
  registration_number: string | null;
  name: string | null;
  cpf: string | null;
  position: string | null;
  base_salary: number | null;
  admission_date: string | null;
  termination_date: string | null;
  status: string | null;
  pis_pasep: string | null;
  bank_code: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  created_at: string;
  [col: string]: unknown;
}

/** Colunas candidatas ao merge aditivo (espelha colaborador-merge.ts). */
const CAMPOS_MERGE = [
  'employee_id',
  'department_id',
  'registration_number',
  'name',
  'position',
  'base_salary',
  'admission_date',
  'termination_date',
  'pis_pasep',
  'bank_code',
  'bank_agency',
  'bank_account',
] as const;

/** Merge aditivo mantido ← duplicado. Rescisão (terminated) prevalece. */
function calcularMergeAditivo(mantido: EmployeeRow, dup: EmployeeRow): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const campo of CAMPOS_MERGE) {
    if (vazio(mantido[campo]) && !vazio(dup[campo])) {
      patch[campo] = dup[campo];
    }
  }
  if (dup.status === 'terminated' && mantido.status !== 'terminated') {
    patch.status = 'terminated';
  }
  return patch;
}

async function reapontar(
  supabase: SupabaseClient,
  tabela: string,
  manterId: string,
  dupId: string,
  aplicar: boolean,
): Promise<number> {
  if (!aplicar) {
    const { count, error } = await supabase
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', dupId);
    if (error) return -1; // tabela ausente ou sem acesso
    return count ?? 0;
  }
  const { count, error } = await supabase
    .from(tabela)
    .update({ employee_id: manterId }, { count: 'exact' })
    .eq('employee_id', dupId);
  if (error) return -1;
  return count ?? 0;
}

async function main() {
  const aplicar = process.argv.slice(2).includes('--apply');
  console.log(aplicar ? '*** MODO APPLY ***' : 'MODO DRY-RUN (default — use --apply para gravar)');

  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('SUPABASE env ausente (.env.local)');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('payroll_employees')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error(`payroll_employees: ${error.message}`);
    process.exit(1);
  }
  const todos = (data || []) as EmployeeRow[];

  const grupos = new Map<string, EmployeeRow[]>();
  for (const e of todos) {
    const cpf = digitos(e.cpf);
    if (cpf.length !== 11) continue;
    const chave = `${e.company_id}|${cpf}`;
    const lista = grupos.get(chave) || [];
    lista.push(e);
    grupos.set(chave, lista);
  }
  const duplicados = [...grupos.entries()].filter(([, lista]) => lista.length > 1);

  console.log(`payroll_employees: ${todos.length} fichas; ${duplicados.length} grupo(s) com CPF duplicado.`);

  // payroll_contracheque_aceites pode não existir ainda (migration 000002) — probe uma vez.
  const { error: probeAceites } = await supabase
    .from('payroll_contracheque_aceites')
    .select('id', { head: true, count: 'exact' })
    .limit(1);
  const temAceites = !probeAceites;
  if (!temAceites) {
    console.log('payroll_contracheque_aceites ausente — re-apontamento dessa tabela ignorado.');
  }

  let removidos = 0;
  let reapontados = 0;
  let merges = 0;

  for (const [chave, lista] of duplicados) {
    const ordenada = [...lista].sort((a, b) =>
      a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
    );
    const mantido = ordenada[0];
    const dups = ordenada.slice(1);
    console.log(`\nGrupo ${chave} (${lista.length} fichas):`);
    console.log(`  MANTER  ${mantido.id} | ${mantido.name} | matrícula ${mantido.registration_number ?? '(vazia)'} | criado ${mantido.created_at}`);

    for (const dup of dups) {
      console.log(`  DUP     ${dup.id} | ${dup.name} | matrícula ${dup.registration_number ?? '(vazia)'} | criado ${dup.created_at}`);
      const patch = calcularMergeAditivo(mantido, dup);
      const camposMerge = Object.keys(patch);
      if (camposMerge.length > 0) {
        console.log(`    merge aditivo → ${camposMerge.join(', ')}`);
      }

      if (aplicar) {
        // 1) re-apontar referências
        for (const tabela of ['payroll_sheet_items', 'payroll_employee_summaries']) {
          const n = await reapontar(supabase, tabela, mantido.id, dup.id, true);
          if (n < 0) {
            console.error(`    FALHA ao re-apontar ${tabela} — duplicado ${dup.id} NÃO removido`);
            continue;
          }
          if (n > 0) console.log(`    ${tabela}: ${n} linha(s) re-apontada(s)`);
          reapontados += n;
        }
        if (temAceites) {
          const n = await reapontar(supabase, 'payroll_contracheque_aceites', mantido.id, dup.id, true);
          if (n > 0) console.log(`    payroll_contracheque_aceites: ${n} linha(s) re-apontada(s)`);
          if (n >= 0) reapontados += n;
        }

        // 2) merge aditivo no mantido
        if (camposMerge.length > 0) {
          const { error: errMerge } = await supabase
            .from('payroll_employees')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', mantido.id);
          if (errMerge) {
            console.error(`    FALHA no merge aditivo do mantido ${mantido.id}: ${errMerge.message}`);
            continue;
          }
          merges += 1;
        }

        // 3) auditoria + delete do duplicado
        const { error: errAudit } = await supabase.from('payroll_audit_log').insert({
          table_name: 'payroll_employees',
          record_id: dup.id,
          action: 'DELETE',
          old_values: { ...dup, dedupe_mantido: mantido.id, origem_evento: 'dedupe_payroll_employees' },
          new_values: null,
          changed_by: null,
        });
        if (errAudit) console.error(`    auditoria do dup ${dup.id} não gravada (dedupe mantido): ${errAudit.message}`);

        const { error: errDel } = await supabase
          .from('payroll_employees')
          .delete()
          .eq('id', dup.id);
        if (errDel) {
          console.error(`    FALHA ao deletar dup ${dup.id}: ${errDel.message}`);
          continue;
        }
        console.log(`    removido ${dup.id}`);
        removidos += 1;
      }
    }
  }

  console.log(`\nResumo: ${duplicados.length} grupo(s), ${removidos} removido(s), ${reapontados} linha(s) re-apontada(s), ${merges} merge(s) aditivo(s)${aplicar ? '' : ' (dry-run — nada gravado)'}.`);
  console.log('DEDUPE_OK');
}

main().catch((e) => {
  console.error('Dedupe falhou:', e);
  process.exit(1);
});
