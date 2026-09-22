/**
 * Importa o que o backup do WK Radar tem de aproveitável para a folha.
 * A leitura do zip vive em src/lib/payroll/wk-backup.ts.
 *
 * O que entra sozinho (dado de identidade, sem ambiguidade):
 *   PIS/PASEP, data de admissão e data de nascimento.
 * O que NÃO entra sozinho:
 *   salário. O backup só tem a remuneração mensal paga, que para offshore
 *   varia com embarque e dobra. Quem tem pagamento fixo sai sugerido na
 *   planilha; o resto vai em branco para o DP preencher.
 *
 * Uso:
 *   npx tsx scripts/importar-wk-backup.ts <caminho.zip>            (simulação)
 *   npx tsx scripts/importar-wk-backup.ts <caminho.zip> --aplicar  (grava)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { lerPessoasDoBackupWk, casarComPortal, type PessoaWk } from '../src/lib/payroll/wk-backup';

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

interface EmployeeRow {
  id: string;
  name: string | null;
  cpf: string | null;
  registration_number: string | null;
  base_salary: number | null;
  admission_date: string | null;
  pis_pasep: string | null;
  status: string | null;
}

const brl = (v: number | null | undefined) =>
  v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** CSV para o DP conferir e devolver o salário contratual. */
function montarPlanilha(linhas: Array<{ pessoa: PessoaWk; emp: EmployeeRow | null }>): string {
  const competencias = [
    ...new Set(linhas.flatMap((l) => Object.keys(l.pessoa.remuneracao))),
  ]
    .sort()
    .slice(-6);

  const cab = [
    'CPF',
    'Nome',
    'Matricula',
    'No portal',
    'Salario base atual',
    'SALARIO CONTRATUAL (preencher)',
    'Sugestao (so quando o pagamento e fixo)',
    ...competencias.map((c) => `Bruto ${c}`),
  ];

  const corpo = linhas.map((l) => {
    const p = l.pessoa;
    return [
      p.cpf,
      p.nome,
      p.codigo ?? '',
      l.emp ? 'sim' : 'NAO ENCONTRADO',
      l.emp ? brl(Number(l.emp.base_salary) || 0) : '',
      '',
      p.remuneracaoEstavel ? brl(p.remuneracaoModa) : '',
      ...competencias.map((c) => brl(p.remuneracao[c])),
    ];
  });

  const escapar = (v: unknown) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ';' + BOM: é o que o Excel pt-BR abre sem pedir importação.
  return '\ufeff' + [cab, ...corpo].map((l) => l.map(escapar).join(';')).join('\r\n');
}

async function main() {
  const zipPath = process.argv[2];
  const aplicar = process.argv.includes('--aplicar');
  if (!zipPath) throw new Error('Informe o caminho do zip do backup WK.');
  if (!fs.existsSync(zipPath)) throw new Error(`Backup não encontrado: ${zipPath}`);

  const env = loadEnvFiles();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env ausente (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Lendo ${path.basename(zipPath)} …`);
  const pessoas = await lerPessoasDoBackupWk(fs.readFileSync(zipPath));
  console.log(`Pessoas com CPF no backup: ${pessoas.length}`);

  const { data, error } = await supabase
    .from('payroll_employees')
    .select('id, name, cpf, registration_number, base_salary, admission_date, pis_pasep, status')
    .limit(5000);
  if (error) throw new Error(`payroll_employees: ${error.message}`);
  const employees = (data || []) as EmployeeRow[];
  console.log(`Fichas na folha: ${employees.length}`);

  const casados = casarComPortal(pessoas, employees, {
    cpf: (e) => e.cpf || '',
    matricula: (e) => e.registration_number || '',
    nome: (e) => e.name || '',
  });

  const porVia = { cpf: 0, matricula: 0, nome: 0, nenhum: 0 };
  const semMatch: PessoaWk[] = [];
  let pisGravado = 0;
  let admissaoGravada = 0;
  let salarioSugerido = 0;

  for (const { pessoa, alvo, via } of casados) {
    if (!alvo) {
      porVia.nenhum += 1;
      semMatch.push(pessoa);
      continue;
    }
    porVia[via as 'cpf' | 'matricula' | 'nome'] += 1;

    // Só identidade entra sozinha. Salário não: o backup tem o bruto pago,
    // não o contratual, e um mês parcial viraria salário errado para sempre.
    // A sugestão vai para a planilha e volta conferida pelo DP.
    if (pessoa.remuneracaoEstavel && pessoa.remuneracaoModa && !(Number(alvo.base_salary) > 0)) {
      salarioSugerido += 1;
    }
    const patch: Record<string, unknown> = {};
    if (pessoa.pis && !alvo.pis_pasep) patch.pis_pasep = pessoa.pis;
    if (pessoa.admissao && !alvo.admission_date) patch.admission_date = pessoa.admissao;
    if (Object.keys(patch).length === 0) continue;

    if (patch.pis_pasep) pisGravado += 1;
    if (patch.admission_date) admissaoGravada += 1;

    if (aplicar) {
      patch.updated_at = new Date().toISOString();
      const { error: upErr } = await supabase.from('payroll_employees').update(patch).eq('id', alvo.id);
      if (upErr) throw new Error(`update ${pessoa.nome}: ${upErr.message}`);
    }
  }

  console.log('\n=== Casamento backup → folha ===');
  console.log(`  por CPF:       ${porVia.cpf}`);
  console.log(`  por matrícula: ${porVia.matricula}`);
  console.log(`  por nome:      ${porVia.nome}`);
  console.log(`  sem par:       ${porVia.nenhum}`);
  if (semMatch.length) {
    console.log('  (sem par no portal — provável desligado antigo ou outra empresa)');
    for (const p of semMatch.slice(0, 15)) console.log(`    ${p.cpf} ${p.nome} (cód ${p.codigo})`);
    if (semMatch.length > 15) console.log(`    ... e mais ${semMatch.length - 15}`);
  }

  const rotulo = aplicar ? 'gravados' : 'a gravar (simulação)';
  console.log(`\n=== Identidade ${rotulo} ===`);
  console.log(`  PIS/PASEP:        ${pisGravado}`);
  console.log(`  Data de admissão: ${admissaoGravada}`);
  console.log(`  Salário sugerido na planilha (pagamento fixo): ${salarioSugerido}`);

  const linhas = casados.map(({ pessoa, alvo }) => ({ pessoa, emp: alvo }));
  const destino = path.join(process.cwd(), 'wk-conferencia-salarios.csv');
  fs.writeFileSync(destino, montarPlanilha(linhas), 'utf8');
  const semSalario = employees.filter((e) => !(Number(e.base_salary) > 0)).length;
  console.log(`\nPlanilha de conferência: ${path.basename(destino)}`);
  console.log(`  Fichas ainda sem salário base: ${semSalario} de ${employees.length}`);
  console.log('  Preencha a coluna "SALARIO CONTRATUAL" e devolva para importar.');

  if (!aplicar) console.log('\nSimulação — nada foi gravado. Rode com --aplicar para valer.');
  console.log('\nIMPORTAR_WK_BACKUP_OK');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
