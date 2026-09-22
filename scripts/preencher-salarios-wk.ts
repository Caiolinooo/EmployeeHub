/**
 * Preenche salario (GT) e base_salary (payroll) com a moda da remuneração
 * mensal do backup WK quando ela se repete ≥2x nos últimos 12 meses —
 * repetição exata é sinal forte de salário fixo. Offshore variável (moda 1x)
 * fica vazio de propósito: preencher com um mês qualquer corromperia a
 * diária da folha (salário/30) — a planilha de conferência cobre esses.
 *
 * Uso:
 *   npx tsx scripts/preencher-salarios-wk.ts [pasta-cards] [--aplicar]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { lerCardJson, lerPessoasDeCards } from '../src/lib/payroll/wk-backup';

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

/** Moda dos últimos 12 meses com ≥2 repetições (sinal de salário fixo). */
function modaEstavel(hist: Record<string, number>): number | null {
  const ultimos = Object.keys(hist).sort().slice(-12).map((c) => hist[c]);
  if (!ultimos.length) return null;
  const contagem = new Map<number, number>();
  for (const v of ultimos) contagem.set(v, (contagem.get(v) || 0) + 1);
  let melhor = 0;
  let valor: number | null = null;
  for (const [v, n] of contagem) {
    if (n > melhor) { melhor = n; valor = v; }
  }
  return melhor >= 2 ? valor : null;
}

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes('--aplicar');
  const cardsDir = args.find((a) => !a.startsWith('--')) || 'wk-export/_backup_cards';

  console.log(aplicar ? '*** MODO APLICAR ***' : 'MODO DRY-RUN');

  const identidade: unknown[] = [];
  let custo: unknown = null;
  for (const nome of ['DF/CRMINFPINDICADORCOLABORADORES.dat', 'DF/CRMINFPAVISOSVENCIMENTOS.dat']) {
    const fp = path.join(cardsDir, nome.replace(/\//g, path.sep));
    if (fs.existsSync(fp)) identidade.push(lerCardJson(fs.readFileSync(fp)));
  }
  const fpCusto = path.join(cardsDir, 'DF', 'CRMINFPCUSTOFOLHA.dat');
  if (fs.existsSync(fpCusto)) custo = lerCardJson(fs.readFileSync(fpCusto));
  if (!identidade.length) {
    console.error(`Cards não encontrados em ${cardsDir}`);
    process.exit(1);
  }

  const pessoas = lerPessoasDeCards(identidade, custo);
  console.log(`Backup: ${pessoas.length} pessoas com CPF`);

  const candidatos: Array<{ cpf: string; nome: string; salario: number }> = [];
  for (const p of pessoas) {
    const m = modaEstavel(p.remuneracao);
    if (m != null && m > 0) candidatos.push({ cpf: p.cpf, nome: p.nome, salario: m });
  }
  console.log(`Moda ≥2x nos últimos 12m: ${candidatos.length} pessoas`);

  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let gtOk = 0, gtJa = 0, gtSemFicha = 0, peOk = 0, peJa = 0;
  for (const c of candidatos) {
    const variantes = [c.cpf, `${c.cpf.slice(0, 3)}.${c.cpf.slice(3, 6)}.${c.cpf.slice(6, 9)}-${c.cpf.slice(9)}`];

    // GT
    const { data: gts } = await sb
      .from('gt_colaboradores')
      .select('id,salario')
      .in('cpf', variantes)
      .is('deleted_at', null)
      .limit(1);
    const gt = gts?.[0];
    if (!gt) gtSemFicha++;
    else if (gt.salario != null && gt.salario > 0) gtJa++;
    else {
      console.log(`  [GT] ${c.nome}: ${c.salario}`);
      if (aplicar) {
        const { error } = await sb.from('gt_colaboradores').update({ salario: c.salario }).eq('id', gt.id);
        if (error) console.error(`    ERRO: ${error.message}`);
      }
      gtOk++;
    }

    // Payroll
    const { data: emps } = await sb
      .from('payroll_employees')
      .select('id,base_salary')
      .in('cpf', variantes)
      .limit(1);
    const pe = emps?.[0];
    if (pe && (pe.base_salary == null || pe.base_salary === 0)) {
      if (aplicar) {
        await sb.from('payroll_employees').update({ base_salary: c.salario }).eq('id', pe.id);
      }
      peOk++;
    } else if (pe) peJa++;
  }

  console.log('\n===== RESUMO =====');
  console.log(`GT: ${gtOk} a preencher, ${gtJa} já tinham, ${gtSemFicha} sem ficha`);
  console.log(`Payroll: ${peOk} a preencher, ${peJa} já tinham`);
  if (!aplicar) console.log('DRY-RUN: nada gravado.');
  console.log('SALARIOS_WK_OK');
}

main().catch((e) => { console.error('Erro fatal:', e); process.exit(1); });
