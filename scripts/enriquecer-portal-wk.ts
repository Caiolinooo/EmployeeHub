import { lerPessoasDoBackupWk } from '../src/lib/payroll/wk-backup';
/**
 * Enriquece gt_colaboradores e payroll_employees com dados do WK.
 *
 * Fontes:
 *   1. wk-export/wk-export.json (RadarAPI) → cargo, departamento
 *   2. backup zip WK (se fornecido) → PIS, data de nascimento, remuneração estável
 *
 * Uso:
 *   npx tsx scripts/enriquecer-portal-wk.ts                        (dry-run, só API)
 *   npx tsx scripts/enriquecer-portal-wk.ts --backup <caminho.zip> (dry-run, API + backup)
 *   npx tsx scripts/enriquecer-portal-wk.ts --aplicar              (grava)
 *   npx tsx scripts/enriquecer-portal-wk.ts --backup <zip> --aplicar
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
function loadEnvFiles(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of ['.env.local', '.env', '.env.production']) {
    const fp = path.resolve(process.cwd(), f);
    if (!fs.existsSync(fp)) continue;
    for (const line of fs.readFileSync(fp, 'utf-8').split('\n')) {
      const l = line.trim();
      if (!l || l.startsWith('#') || !l.includes('=')) continue;
      const [k, ...rest] = l.split('=');
      env[k.trim()] = rest.join('=').trim();
    }
  }
  return env;
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface GtColaborador {
  id: string;
  cpf: string | null;
  matricula: string | null;
  nome_completo: string | null;
  pis_pasep: string | null;
  salario: number | null;
  data_nascimento: string | null;
  matricula_esocial: string | null;
}

interface PayrollEmployee {
  id: string;
  cpf: string | null;
  registration_number: string | null;
  name: string | null;
  position: string | null;
  base_salary: number | null;
  pis_pasep: string | null;
  department_id: string | null;
  company_id: string | null;
}

interface PayrollDepartment {
  id: string;
  name: string;
  code: string;
  company_id: string;
}

interface WkFuncionario {
  id: number;
  codigo: string;
  nome: string;
  departamento: string | null;
  cargo: string | null;
}

interface WkExport {
  funcionarios: WkFuncionario[];
  centrosCusto: Array<{ id: number; codigo: string; nome: string }>;
  departamentosRH: Array<{ id: number; codigo: string; nome: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const digitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');
const round2 = (v: number) => Math.round(v * 100) / 100;
const normNome = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes('--aplicar');
  const backupIdx = args.indexOf('--backup');
  const backupPath = backupIdx >= 0 ? args[backupIdx + 1] : null;

  console.log(aplicar ? '*** MODO APLICAR ***' : 'MODO DRY-RUN — nada será gravado. Rode com --aplicar para gravar.');

  // ----- Supabase -----
  const envVars = loadEnvFiles();
  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar em .env.local');
    process.exit(1);
  }
  const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // ----- Carregar dados do portal -----
  const { data: gtRows, error: gtErr } = await sb
    .from('gt_colaboradores')
    .select('id,cpf,matricula,nome_completo,pis_pasep,salario,data_nascimento,matricula_esocial');
  if (gtErr) throw gtErr;
  const gtColabs = gtRows as GtColaborador[];
  console.log(`\ngt_colaboradores: ${gtColabs.length}`);

  const { data: peRows, error: peErr } = await sb
    .from('payroll_employees')
    .select('id,cpf,registration_number,name,position,base_salary,pis_pasep,department_id,company_id');
  if (peErr) throw peErr;
  const payEmps = peRows as PayrollEmployee[];
  console.log(`payroll_employees: ${payEmps.length}`);

  const { data: deptRows } = await sb
    .from('payroll_departments')
    .select('id,name,code,company_id');
  const depts = (deptRows || []) as PayrollDepartment[];

  // ----- Carregar WK export (API) -----
  const exportPath = path.resolve(process.cwd(), 'wk-export/wk-export.json');
  if (!fs.existsSync(exportPath)) {
    console.error('wk-export/wk-export.json não encontrado. Rode wk-extrair-api.ts primeiro.');
    process.exit(1);
  }
  const wkExport: WkExport = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
  console.log(`WK export: ${wkExport.funcionarios.length} funcionários`);

  // Indexar WK por código (matrícula)
  const wkPorCodigo = new Map<string, WkFuncionario>();
  for (const f of wkExport.funcionarios) {
    wkPorCodigo.set(String(f.codigo).trim(), f);
  }

  // ----- Carregar backup WK (opcional) -----
  // O zip completo (~730MB) não cabe na memória desta máquina. O fluxo é
  // extrair antes só os 3 cards DF/CRMINFP*.dat (Python zipfile, streaming)
  // para wk-export/_backup_cards/ e apontar --backup para essa pasta.
  let backupPorCpf = new Map<string, { pis: string | null; nascimento: string | null; moda: number | null; estavel: boolean }>();
  if (backupPath) {
    const cardsDir = backupPath;
    const CARDS = [
      'DF/CRMINFPINDICADORCOLABORADORES.dat',
      'DF/CRMINFPAVISOSVENCIMENTOS.dat',
      'DF/CRMINFPCUSTOFOLHA.dat',
    ];
    if (!fs.existsSync(cardsDir)) {
      console.error(`Pasta de cards não encontrada: ${cardsDir}`);
      process.exit(1);
    }
    const JSZip = (await import('jszip')).default;
    const mini = new JSZip();
    let algum = false;
    for (const card of CARDS) {
      const fp = path.join(cardsDir, card.replace(/\//g, path.sep));
      if (!fs.existsSync(fp)) continue;
      mini.file(card, fs.readFileSync(fp));
      algum = true;
    }
    if (!algum) {
      console.error('Nenhum card DF/CRMINFP*.dat na pasta informada.');
      process.exit(1);
    }
    const buf = await mini.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    const pessoas = await lerPessoasDoBackupWk(buf);
    console.log(`Backup WK: ${pessoas.length} pessoas com CPF`);
    for (const p of pessoas) {
      backupPorCpf.set(p.cpf, {
        pis: p.pis,
        nascimento: p.nascimento,
        moda: p.remuneracaoModa,
        estavel: p.remuneracaoEstavel,
      });
    }
  }

  // ----- Indexar payroll_departments por nome normalizado -----
  const deptPorNome = new Map<string, PayrollDepartment>();
  for (const d of depts) {
    deptPorNome.set(normNome(d.name), d);
    deptPorNome.set(normNome(d.code), d);
  }

  // ===================================================================
  // ENRIQUECER gt_colaboradores
  // ===================================================================
  console.log('\n== gt_colaboradores ==');
  let gtUpdates = 0, gtSkips = 0;
  for (const gt of gtColabs) {
    const cpf11 = digitos(gt.cpf);
    const mat = gt.matricula?.trim() || '';
    const wk = mat ? wkPorCodigo.get(mat) : undefined;
    const bk = cpf11.length === 11 ? backupPorCpf.get(cpf11) : undefined;

    const changes: Record<string, unknown> = {};

    // PIS: backup tem, portal não
    if (!gt.pis_pasep && bk?.pis) {
      changes.pis_pasep = bk.pis;
    }

    // Data de nascimento: backup tem, portal não
    if (!gt.data_nascimento && bk?.nascimento) {
      changes.data_nascimento = bk.nascimento;
    }

    // Salário: backup tem moda estável, portal é null. Valores abaixo do
    // mínimo podem ser legítimos (jovem aprendiz), então não há piso.
    if (gt.salario == null && bk?.estavel && bk.moda != null && bk.moda > 0) {
      changes.salario = round2(bk.moda);
    }

    // Matrícula eSocial. Evidência dos eventos do backup (46 eventos de
    // trabalhador, 45 casam): o WK usa o próprio código interno como
    // matrícula eSocial. As divergências encontradas no portal apontavam
    // para a matrícula de OUTRO funcionário (ex: 804→785, mas 785 é Silvio).
    // Regras: nula → copia a matrícula; existente em formato CNPJ.0000000
    // apontando para outra matrícula → corrige mantendo o formato.
    if (mat && /^\d+$/.test(mat)) {
      const eso = gt.matricula_esocial?.trim() || '';
      if (!eso) {
        changes.matricula_esocial = mat;
      } else if (eso.includes('.')) {
        const [cnpj, parte] = eso.split('.');
        if ((parte || '').replace(/^0+/, '') !== mat.replace(/^0+/, '')) {
          changes.matricula_esocial = `${cnpj}.${mat.padStart(7, '0')}`;
        }
      } else if (eso.replace(/^0+/, '') !== mat.replace(/^0+/, '')) {
        changes.matricula_esocial = mat;
      }
    }

    if (Object.keys(changes).length === 0) {
      gtSkips++;
      continue;
    }

    gtUpdates++;
    const campos = Object.entries(changes).map(([k, v]) => `${k}: ${gt[k as keyof GtColaborador] ?? '(vazio)'} → ${v}`).join(', ');
    console.log(`  [UPDATE] ${gt.nome_completo || gt.id}: ${campos}`);

    if (aplicar) {
      const { error } = await sb.from('gt_colaboradores').update(changes).eq('id', gt.id);
      if (error) console.error(`    ERRO: ${error.message}`);
      else console.log(`    [GRAVADO]`);
    }
  }
  console.log(`  Resumo GT: ${gtUpdates} update(s), ${gtSkips} sem mudança`);

  // ===================================================================
  // ENRIQUECER payroll_employees
  // ===================================================================
  console.log('\n== payroll_employees ==');
  let peUpdates = 0, peSkips = 0;
  for (const pe of payEmps) {
    const cpf11 = digitos(pe.cpf);
    const mat = pe.registration_number?.trim() || '';
    const wk = mat ? wkPorCodigo.get(mat) : undefined;
    const bk = cpf11.length === 11 ? backupPorCpf.get(cpf11) : undefined;

    const changes: Record<string, unknown> = {};

    // Position (cargo): WK API tem, portal não
    if (!pe.position && wk?.cargo) {
      changes.position = wk.cargo;
    }

    // PIS: backup tem, portal não
    if (!pe.pis_pasep && bk?.pis) {
      changes.pis_pasep = bk.pis;
    }

    // Base salary: backup tem moda estável, portal é zero
    if ((pe.base_salary == null || pe.base_salary === 0) && bk?.estavel && bk.moda != null && bk.moda > 0) {
      changes.base_salary = round2(bk.moda);
    }

    // Department: WK API tem, portal não
    if (!pe.department_id && wk?.departamento && pe.company_id) {
      const deptNorm = normNome(wk.departamento);
      // Procurar dept pelo nome normalizado dentro da company
      const matchDept = depts.find(
        (d) => d.company_id === pe.company_id && (normNome(d.name) === deptNorm || normNome(d.code) === deptNorm),
      );
      if (matchDept) {
        changes.department_id = matchDept.id;
      }
    }

    if (Object.keys(changes).length === 0) {
      peSkips++;
      continue;
    }

    peUpdates++;
    const campos = Object.entries(changes).map(([k, v]) => {
      const old = pe[k as keyof PayrollEmployee];
      return `${k}: ${old ?? '(vazio)'} → ${v}`;
    }).join(', ');
    console.log(`  [UPDATE] ${pe.name || pe.id} (mat=${mat}): ${campos}`);

    if (aplicar) {
      const { error } = await sb.from('payroll_employees').update(changes).eq('id', pe.id);
      if (error) console.error(`    ERRO: ${error.message}`);
      else console.log(`    [GRAVADO]`);
    }
  }
  console.log(`  Resumo Payroll: ${peUpdates} update(s), ${peSkips} sem mudança`);

  // ===================================================================
  // Resumo final
  // ===================================================================
  console.log('\n===== RESUMO FINAL =====');
  console.log(`gt_colaboradores: ${gtUpdates} update(s), ${gtSkips} sem mudança`);
  console.log(`payroll_employees: ${peUpdates} update(s), ${peSkips} sem mudança`);
  if (!aplicar) console.log('\nDRY-RUN: nenhum write executado.');
  console.log('\nENRIQUECIMENTO_WK_OK');
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
