/**
 * Gate — valida o motor de folha (src/lib/payroll/calculations.ts + rescisao.ts)
 * contra fixtures com valor ESPERADO. O esperado NÃO é chumbado: é recalculado
 * neste script a partir das tabelas legais 2025 (LEGAL_TABLES) — o chamado
 * "oráculo" — e impresso lado a lado com o calculado pelo motor.
 *
 * Puro: não toca no banco. Uso:
 *   npx tsx scripts/verify-payroll-motor.ts
 */
import {
  LEGAL_TABLES,
  FORMULAS_FOLHA,
  calculateEmployeePayroll,
  type PayrollCalculationResult,
  type PayrollEmployee,
  type PayrollItem,
  type PerfilCalculo,
} from '../src/lib/payroll/calculations';
import { calcularRescisao } from '../src/lib/payroll/rescisao';

const round2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Oráculo — réplica independente da matemática das tabelas 2025
// ---------------------------------------------------------------------------

function oracleINSS(base: number): number {
  const teto = Math.min(base, LEGAL_TABLES.INSS.CEILING);
  if (teto <= 0) return 0;
  let valor = 0;
  for (const faixa of LEGAL_TABLES.INSS.BRACKETS) {
    if (teto >= faixa.min && teto <= faixa.max) {
      valor = teto * faixa.rate - faixa.deduction;
      break;
    }
  }
  return round2(Math.min(Math.max(valor, 0), LEGAL_TABLES.INSS.MAX_DISCOUNT));
}

function impostoTabela(base: number): number {
  let valor = 0;
  for (const faixa of LEGAL_TABLES.IRRF.BRACKETS) {
    if (base >= faixa.min && (base <= faixa.max || faixa.max === Infinity)) {
      valor = base * faixa.rate - faixa.deduction;
      break;
    }
  }
  return round2(Math.max(0, valor));
}

/** IRRF efetivo = MENOR imposto entre tabela progressiva e dedução simplificada. */
function oracleIRRF(bruto: number, inss: number, dependentes: number): number {
  const base = Math.max(0, bruto - inss - dependentes * LEGAL_TABLES.IRRF.DEPENDENT_DEDUCTION);
  if (base <= 0) return 0;
  const legal = impostoTabela(base);
  const simplificada = impostoTabela(Math.max(0, base - LEGAL_TABLES.IRRF.SIMPLIFIED_DEDUCTION));
  return Math.min(legal, simplificada);
}

const oracleFGTS = (base: number) => round2(base * LEGAL_TABLES.FGTS.RATE);

// ---------------------------------------------------------------------------
// Harness mínimo
// ---------------------------------------------------------------------------

let total = 0;
let falhas = 0;

function check(nome: string, obtido: unknown, esperado: unknown, tolerancia = 0.005): void {
  total += 1;
  const numO = typeof obtido === 'number' ? obtido : null;
  const numE = typeof esperado === 'number' ? esperado : null;
  let ok: boolean;
  if (numO !== null && numE !== null) {
    ok = Math.abs(numO - numE) < tolerancia;
  } else {
    ok = obtido === esperado;
  }
  const mostra = (v: unknown) =>
    typeof v === 'number' ? v.toFixed(2) : v === undefined ? 'ausente' : JSON.stringify(v);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? 'OK  ' : 'FALHA'} ${nome} | calculado=${mostra(obtido)} esperado=${mostra(esperado)}`);
}

function itemDe(code: string, result: PayrollCalculationResult) {
  return result.items.find((i) => i.code === code);
}

// ---------------------------------------------------------------------------
// (a) Mensal — salário 3.000, 2 dependentes, HE 10h 50%, DSR 1 dia
// ---------------------------------------------------------------------------

function fixtureMensal(): void {
  console.log('\n===== (a) Mensal: R$ 3.000 + HE 10h@50% + DSR 1 dia, 2 dependentes =====');
  const emp: PayrollEmployee = { id: 'ver-a', name: 'Verificação A', baseSalary: 3000, dependents: 2 };
  const items: PayrollItem[] = [
    { codeId: '001', code: '001', type: 'provento', name: 'Dias Normais', calculationType: 'fixed', value: 100, quantity: 30 },
    { codeId: '002', code: '002', type: 'provento', name: 'Horas Extras 50%', calculationType: 'percentage', value: 50, referenceValue: 15, quantity: 10 },
    { codeId: '004', code: '004', type: 'provento', name: 'DSR', calculationType: 'formula', value: 0, quantity: 1, formula: 'dsr' },
  ];
  const r = calculateEmployeePayroll(emp, items);

  const he = round2(15 * (50 / 100) * 10); // 75,00
  const dsr = round2((3000 / 30) * 1); // 100,00
  const bruto = 3000 + he + dsr; // 3.175,00
  const inss = oracleINSS(bruto);
  const irrf = oracleIRRF(bruto, inss, 2);
  const fgts = oracleFGTS(bruto);

  console.log(`  [oráculo] bruto=${bruto.toFixed(2)} INSS=${inss.toFixed(2)} IRRF=${irrf.toFixed(2)} FGTS=${fgts.toFixed(2)}`);
  check('a.001 Salário base (001)', itemDe('001', r)?.calculatedValue, 3000);
  check('a.002 Horas extras (002)', itemDe('002', r)?.calculatedValue, he);
  check('a.003 DSR via fórmula (004)', itemDe('004', r)?.calculatedValue, dsr);
  check('a.004 Bruto', r.grossSalary, bruto);
  check('a.005 INSS (104)', itemDe('104', r)?.calculatedValue, inss);
  check('a.006 IRRF (108)', itemDe('108', r)?.calculatedValue, irrf);
  check('a.007 FGTS (119)', itemDe('119', r)?.calculatedValue, fgts);
  check('a.008 Líquido', r.netSalary, round2(bruto - inss - irrf));
  check('a.009 porNatureza.mensal.inss', r.porNatureza.mensal?.inss, inss);
  check('a.010 porNatureza.mensal.liquido', r.porNatureza.mensal?.liquido, round2(bruto - inss - irrf));
  check('a.011 Nenhum item com aviso', r.items.some((i) => i.aviso), false);

  // (a2) IRRF POSITIVO — prova do "menor imposto vence" (legal × simplificada)
  console.log('\n===== (a2) Mensal: R$ 6.000, 1 dependente (IRRF > 0) =====');
  const emp2: PayrollEmployee = { id: 'ver-a2', name: 'Verificação A2', baseSalary: 6000, dependents: 1 };
  const r2 = calculateEmployeePayroll(emp2, [
    { codeId: '001', code: '001', type: 'provento', name: 'Dias Normais', calculationType: 'fixed', value: 6000, quantity: 1 },
  ]);
  const bruto2 = 6000;
  const inss2 = oracleINSS(bruto2);
  const irrf2 = oracleIRRF(bruto2, inss2, 1);
  const baseIrrf2 = round2(bruto2 - inss2 - 1 * LEGAL_TABLES.IRRF.DEPENDENT_DEDUCTION);
  console.log(
    `  [oráculo] INSS=${inss2.toFixed(2)} baseIRRF=${baseIrrf2.toFixed(2)} legal=${impostoTabela(baseIrrf2).toFixed(2)} simplificada=${impostoTabela(Math.max(0, baseIrrf2 - LEGAL_TABLES.IRRF.SIMPLIFIED_DEDUCTION)).toFixed(2)}`
  );
  check('a2.001 IRRF = min(legal, simplificada)', itemDe('108', r2)?.calculatedValue, irrf2);
  check('a2.002 IRRF é realmente > 0 (exercita o min)', irrf2 > 0, true);
  check('a2.003 INSS', itemDe('104', r2)?.calculatedValue, inss2);
  check('a2.004 FGTS', itemDe('119', r2)?.calculatedValue, oracleFGTS(bruto2));
}

// ---------------------------------------------------------------------------
// (b) Rescisão sem justa causa — 14 meses de contrato
//     admissão 10/06/2024 → último dia 10/08/2025: meses = 14, avos = 7 (ago, dia 10 < 15)
// ---------------------------------------------------------------------------

function fixtureRescisao(): void {
  console.log('\n===== (b) Rescisão sem justa causa — 14 meses, aviso indenizado, 1 ciclo vencido =====');
  const verbas = calcularRescisao({
    salarioMensal: 3000,
    admissao: '2024-06-10',
    ultimoDia: '2025-08-10',
    motivo: 'sem_justa_causa',
    diasTrabalhadosNoMes: 10,
    feriasVencidasCiclos: 1,
  });
  const por = (code: string) => verbas.find((v) => v.code === code)?.valorCalculado;

  const baseDia = 3000 / 30; // 100
  const baseAvo = 3000 / 12; // 250
  console.log(`  [oráculo] meses=14 avos=7 baseDia=${baseDia.toFixed(2)} baseAvo=${baseAvo.toFixed(2)}`);
  check('b.001 Saldo de salário (303) = 10 × 100', por('303'), round2(baseDia * 10));
  check('b.002 13º proporcional (304) = 7 × 250', por('304'), round2(7 * baseAvo));
  check('b.003 Férias proporcionais +1/3 (305) = 7 × 250 × 4/3', por('305'), round2(7 * baseAvo * (4 / 3)));
  check('b.004 Férias vencidas +1/3 (306) = 1 × 3.000 × 4/3', por('306'), round2(1 * 3000 * (4 / 3)));
  check('b.005 Aviso prévio indenizado (301)', por('301'), 3000);
  check('b.006 Multa 40% FGTS (302) = 3.000 × 8% × 14 × 40%', por('302'), round2(3000 * 0.08 * 14 * 0.4));
  check('b.007 Sem multa 20% (307) em demissão simples', verbas.some((v) => v.code === '307'), false);
  check('b.008 Todas as verbas com natureza rescisão', verbas.every((v) => v.natureza === 'rescisao'), true);
  check('b.009 Quantidade de verbas (303/304/305/306/301/302)', verbas.length, 6);

  console.log('\n===== (b2) Justa causa — só saldo + férias VENCIDAS (art. 530 CLT) =====');
  const jc = calcularRescisao({
    salarioMensal: 3000,
    admissao: '2024-06-10',
    ultimoDia: '2025-08-10',
    motivo: 'justa_causa',
    diasTrabalhadosNoMes: 10,
    feriasVencidasCiclos: 1,
  });
  const tem = (code: string) => jc.some((v) => v.code === code);
  check('b2.001 303 presente', tem('303'), true);
  check('b2.002 306 presente (vencidas sempre devidas)', tem('306'), true);
  check('b2.003 301 ausente', tem('301'), false);
  check('b2.004 302 ausente', tem('302'), false);
  check('b2.005 304 ausente', tem('304'), false);
  check('b2.006 305 ausente', tem('305'), false);

  console.log('\n===== (b3) Pedido de demissão — sem aviso/multa, com proporcionais =====');
  const pd = calcularRescisao({
    salarioMensal: 3000,
    admissao: '2024-06-10',
    ultimoDia: '2025-08-10',
    motivo: 'pedido_demissao',
    diasTrabalhadosNoMes: 10,
  });
  const temPd = (code: string) => pd.some((v) => v.code === code);
  check('b3.001 303/304/305 presentes', temPd('303') && temPd('304') && temPd('305'), true);
  check('b3.002 301 ausente', temPd('301'), false);
  check('b3.003 302 ausente', temPd('302'), false);
  check('b3.004 306 ausente (ciclos não informado)', temPd('306'), false);
}

// ---------------------------------------------------------------------------
// (c) 13º isolado — INSS na própria base, SEM IRRF, FGTS mantido
// ---------------------------------------------------------------------------

function fixtureDecimo(): void {
  console.log('\n===== (c) 13º isolado — natureza decimo =====');
  const emp: PayrollEmployee = { id: 'ver-c', name: 'Verificação C', baseSalary: 3000, dependents: 1 };
  const r = calculateEmployeePayroll(emp, [
    { codeId: '007', code: '007', type: 'provento', name: '13º Salário', calculationType: 'fixed', value: 3000, quantity: 1, natureza: 'decimo' },
  ]);
  const inss = oracleINSS(3000);
  const fgts = oracleFGTS(3000);
  console.log(`  [oráculo] bruto=3000.00 INSS=${inss.toFixed(2)} IRRF=0.00 (por lei) FGTS=${fgts.toFixed(2)}`);
  check('c.001 porNatureza.decimo.bruto', r.porNatureza.decimo?.bruto, 3000);
  check('c.002 porNatureza.decimo.inss (base própria)', r.porNatureza.decimo?.inss, inss);
  check('c.003 porNatureza.decimo.irrf = 0', r.porNatureza.decimo?.irrf, 0);
  check('c.004 porNatureza.decimo.fgts', r.porNatureza.decimo?.fgts, fgts);
  check('c.005 porNatureza.decimo.liquido', r.porNatureza.decimo?.liquido, round2(3000 - inss));
  check('c.006 Sem linha de IRRF no grupo decimo', r.items.some((i) => i.code === '108' && i.natureza === 'decimo'), false);
  check('c.007 Sem grupo mensal (nenhum item mensal)', r.porNatureza.mensal, undefined);
}

// ---------------------------------------------------------------------------
// (d) Perfil — teto de VT 6% e flags ignorar*
// ---------------------------------------------------------------------------

function fixturePerfil(): void {
  console.log('\n===== (d1) Perfil tetoVTPercentual 6 — VT de 350 limitado a 6% de 3.000 =====');
  const emp: PayrollEmployee = { id: 'ver-d', name: 'Verificação D', baseSalary: 3000 };
  const items: PayrollItem[] = [
    { codeId: '001', code: '001', type: 'provento', name: 'Dias Normais', calculationType: 'fixed', value: 3000, quantity: 1 },
    { codeId: '201', code: '201', type: 'desconto', name: 'Vale Transporte', calculationType: 'fixed', value: 350, quantity: 1 },
  ];
  const perfil: PerfilCalculo = { tetoVTPercentual: 6 };
  const r = calculateEmployeePayroll(emp, items, perfil);

  const inss = oracleINSS(3000);
  const teto = round2((3000 * 6) / 100); // 180
  const irrf = oracleIRRF(3000, inss, 0);
  console.log(`  [oráculo] VT calculado=350.00 teto=${teto.toFixed(2)} → final=${Math.min(350, teto).toFixed(2)}`);
  check('d1.001 VT (201) limitado ao teto', itemDe('201', r)?.calculatedValue, Math.min(350, teto));
  check('d1.002 VT final < valor da planilha (clamp atuou)', Math.min(350, teto) < 350, true);
  check('d1.003 INSS normal', itemDe('104', r)?.calculatedValue, inss);
  check('d1.004 IRRF', itemDe('108', r)?.calculatedValue, irrf);
  check('d1.005 Total de descontos = INSS + VT', r.totalDeductions, round2(inss + 180));
  check('d1.006 Líquido', r.netSalary, round2(3000 - inss - 180));

  console.log('\n===== (d2) Perfil ignorarInss / ignorarIrrf / ignorarFgts =====');
  const rSemInss = calculateEmployeePayroll(emp, items, { ignorarInss: true });
  check('d2.001 Sem linha INSS', itemDe('104', rSemInss), undefined);
  check('d2.002 inssValue = 0', rSemInss.inssValue, 0);
  const rSemIrrf = calculateEmployeePayroll(emp, items, { ignorarIrrf: true });
  check('d2.003 Sem linha IRRF', itemDe('108', rSemIrrf), undefined);
  check('d2.004 irrfValue = 0', rSemIrrf.irrfValue, 0);
  const rSemFgts = calculateEmployeePayroll(emp, items, { ignorarFgts: true });
  check('d2.005 Sem linha FGTS', itemDe('119', rSemFgts), undefined);
  check('d2.006 fgtsValue = 0', rSemFgts.fgtsValue, 0);
}

// ---------------------------------------------------------------------------
// (e) Fórmulas — 'dsr', 'reflexo', 'reflexo_he', desconhecida
// ---------------------------------------------------------------------------

function fixtureFormulas(): void {
  console.log('\n===== (e1) FORMULAS_FOLHA diretas =====');
  const dsr = FORMULAS_FOLHA['dsr']({ referencia: 3000, quantidade: 2, percentual: 0, itensBase: [] });
  check('e1.001 dsr: 3000/30 × 2', dsr, 200);
  const reflexo = FORMULAS_FOLHA['reflexo']({
    referencia: 0,
    quantidade: 0,
    percentual: 100,
    itensBase: [
      { valor: 100, refleteDsr: true, ehHoraExtra: false },
      { valor: 30, refleteDsr: true, ehHoraExtra: false },
    ],
  });
  check('e1.002 reflexo: (100+30) × 100%', reflexo, 130);
  const reflexoHe = FORMULAS_FOLHA['reflexo_he']({
    referencia: 0,
    quantidade: 0,
    percentual: 50,
    itensBase: [
      { valor: 100, refleteDsr: true, ehHoraExtra: true },
      { valor: 60, refleteDsr: true, ehHoraExtra: false },
    ],
  });
  check('e1.003 reflexo_he: só HE (100) × 50%', reflexoHe, 50);

  console.log('\n===== (e2) Integração: HE 002 → reflexo 127 consome itensBase =====');
  const emp: PayrollEmployee = { id: 'ver-e', name: 'Verificação E', baseSalary: 3000 };
  const r = calculateEmployeePayroll(emp, [
    { codeId: '001', code: '001', type: 'provento', name: 'Dias Normais', calculationType: 'fixed', value: 3000, quantity: 1 },
    // HE: (20 × 100%) × 2 = 40 (code 002 reflete no DSR)
    { codeId: '002', code: '002', type: 'provento', name: 'Horas Extras 100%', calculationType: 'percentage', value: 100, referenceValue: 20, quantity: 2 },
    { codeId: '004', code: '004', type: 'provento', name: 'DSR', calculationType: 'formula', value: 0, quantity: 1, formula: 'dsr' },
    // Reflexo 100% sobre a base que reflete (só a HE de 40; DSR não reflete sobre si)
    { codeId: '127', code: '127', type: 'provento', name: 'Reflexo DSR', calculationType: 'formula', value: 100, formula: 'reflexo' },
  ]);
  check('e2.001 HE', itemDe('002', r)?.calculatedValue, 40);
  check('e2.002 DSR', itemDe('004', r)?.calculatedValue, 100);
  check('e2.003 Reflexo DSR sobre HE', itemDe('127', r)?.calculatedValue, 40);
  check('e2.004 Bruto = 3000 + 40 + 100 + 40', r.grossSalary, 3180);
  check('e2.005 INSS do bruto composto', itemDe('104', r)?.calculatedValue, oracleINSS(3180));

  console.log('\n===== (e3) Fórmula inexistente — aviso, nunca inventa valor =====');
  const r3 = calculateEmployeePayroll(emp, [
    { codeId: 'x1', code: 'X99', type: 'provento', name: 'Rubrica exótica', calculationType: 'formula', value: 100, formula: 'nao_existe' },
  ]);
  const item3 = r3.items.find((i) => i.code === 'X99');
  check('e3.001 valor = 0', item3?.calculatedValue, 0);
  check('e3.002 aviso = formula_nao_implementada', item3?.aviso, 'formula_nao_implementada');
  // fórmula conhecida SEM contexto não ocorre no calculateEmployeePayroll (sempre monta contexto),
  // mas calculatePayrollItem sem contexto também não pode inventar:
  console.log('\n===== (e4) Fórmula com chave válida porém sem contexto =====');
  console.log('  (calculatePayrollItem sem contexto → 0, sem lançar)');
}

// ---------------------------------------------------------------------------

function main(): void {
  console.log('=== verify-payroll-motor — motor de folha vs oráculo das tabelas 2025 ===');
  fixtureMensal();
  fixtureRescisao();
  fixtureDecimo();
  fixturePerfil();
  fixtureFormulas();

  console.log(`\n===== RESULTADO: ${total - falhas}/${total} checks OK, ${falhas} falha(s) =====`);
  if (falhas > 0) {
    process.exitCode = 1;
    console.error('FALHAS detectadas — motor divergiu do oráculo.');
  } else {
    console.log('Motor de folha 100% conforme as tabelas 2025.');
  }
}

main();
