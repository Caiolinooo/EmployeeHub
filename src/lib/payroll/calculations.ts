/**
 * Motor de Cálculo da Folha de Pagamento
 * Sistema de Folha de Pagamento - Painel ABZ
 *
 * Função PURA: sem acesso a banco/HTTP. O chamador lê os perfis
 * (payroll_calculation_profiles.rules) e passa `perfil`.
 *
 * Mudanças 2025 (Onda 0 dp-rubricas-wkradar):
 * - IRRF efetivo: menor imposto entre tabela progressiva e dedução simplificada.
 * - `case 'formula'` real via FORMULAS_FOLHA (fórmula desconhecida → aviso, nunca inventa valor).
 * - Perfis: teto de VT e flags para desligar INSS/IRRF/FGTS.
 * - Naturezas (mensal/ferias/decimo/rescisao): tributos calculados POR GRUPO.
 * Todos os campos/parâmetros novos são OPCIONAIS — consumidores antigos não quebram.
 */

// Tabelas da legislação brasileira 2025
export const LEGAL_TABLES = {
  // INSS 2025
  INSS: {
    SALARY_MIN: 1518.00,
    CEILING: 8157.41,
    MAX_DISCOUNT: 951.62,
    BRACKETS: [
      { min: 0, max: 1518.00, rate: 0.075, deduction: 0 },
      { min: 1518.01, max: 2793.88, rate: 0.09, deduction: 22.77 },
      { min: 2793.89, max: 4190.83, rate: 0.12, deduction: 106.59 },
      { min: 4190.84, max: 8157.41, rate: 0.14, deduction: 190.40 }
    ]
  },

  // IRRF 2025 (vigente a partir de maio/2025)
  IRRF: {
    EXEMPTION_LIMIT: 3036.00, // Rendimento bruto
    EXEMPTION_BASE: 2428.80,  // Base de cálculo
    SIMPLIFIED_DEDUCTION: 607.20,
    DEPENDENT_DEDUCTION: 189.59,
    BRACKETS: [
      { min: 0, max: 2428.80, rate: 0, deduction: 0 },
      { min: 2428.81, max: 2826.65, rate: 0.075, deduction: 182.16 },
      { min: 2826.66, max: 3751.05, rate: 0.15, deduction: 394.16 },
      { min: 3751.06, max: 4664.68, rate: 0.225, deduction: 675.49 },
      { min: 4664.69, max: Infinity, rate: 0.275, deduction: 908.73 }
    ]
  },

  // FGTS
  FGTS: {
    RATE: 0.08 // 8%
  }
};

/** Natureza da verba — define em qual grupo de tributos o item entra. */
export type NaturezaFolha = 'mensal' | 'ferias' | 'decimo' | 'rescisao';

/** Perfil de cálculo (derivado de payroll_calculation_profiles.rules pelo chamador). */
export interface PerfilCalculo {
  /** Teto do desconto de Vale Transporte em % do bruto (ex.: 6). */
  tetoVTPercentual?: number;
  ignorarInss?: boolean;
  ignorarIrrf?: boolean;
  ignorarFgts?: boolean;
}

/** Contexto entregue às fórmulas de rubrica. */
export interface FormulaContextItem {
  /** Valor calculado do item de base. */
  valor: number;
  /** Item integra a base de reflexo de DSR (HE, adicionais, dobra). */
  refleteDsr: boolean;
  /** Item é hora extra (base de 'reflexo_he'). */
  ehHoraExtra: boolean;
}

export interface FormulaContext {
  /** Valor de referência (normalmente o salário mensal). */
  referencia: number;
  /** Quantidade do item (ex.: dias de DSR). */
  quantidade: number;
  /** Percentual do item (item.value). */
  percentual: number;
  /** Demais proventos calculados do MESMO grupo de natureza. */
  itensBase: FormulaContextItem[];
}

/**
 * Fórmulas de rubrica (chave = payroll_codes.formula).
 * Retornar null = fórmula não implementada/inválida → o item ganha
 * `aviso: 'formula_nao_implementada'` e valor 0. NUNCA inventar valor.
 */
export const FORMULAS_FOLHA: Record<string, (ctx: FormulaContext) => number | null> = {
  /** DSR: 1/30 da referência por dia de descanso remunerado. */
  dsr: ({ referencia, quantidade }) => (referencia / 30) * quantidade,
  /** Reflexo do DSR sobre a soma das verbas que refletem (× percentual). */
  reflexo: ({ percentual, itensBase }) =>
    itensBase.filter((i) => i.refleteDsr).reduce((acc, i) => acc + i.valor, 0) * (percentual / 100),
  /** Reflexo do DSR restrito à base de horas extras. */
  reflexo_he: ({ percentual, itensBase }) =>
    itensBase.filter((i) => i.refleteDsr && i.ehHoraExtra).reduce((acc, i) => acc + i.valor, 0) * (percentual / 100),
};

/**
 * Códigos (seed-payroll-data.sql) que refletem no DSR / são hora extra.
 * Convenção enquanto payroll_codes não tem coluna própria de reflexo.
 */
const REFLETE_DSR_POR_CODIGO: Record<string, true> = {
  '002': true, // Horas Extras 50%
  '003': true, // Horas Extras 100%
  '063': true, // Adicional de Sobreaviso 20%
  '131': true, // Adicional Noturno 20%
  '138': true, // Dobra
  '213': true  // Adicional de Periculosidade 30%
};
const HORA_EXTRA_POR_CODIGO: Record<string, true> = { '002': true, '003': true };

/** Código do Vale Transporte (alvo do teto do perfil). */
const CODIGO_VT = '201';

const round2 = (v: number) => Math.round(v * 100) / 100;

// Interfaces para os cálculos
export interface PayrollEmployee {
  id: string;
  name: string;
  baseSalary: number;
  dependents?: number;
}

export interface PayrollItem {
  codeId: string;
  code: string;
  type: 'provento' | 'desconto' | 'outros';
  name: string;
  calculationType: 'fixed' | 'percentage' | 'formula' | 'legal';
  value: number;
  quantity?: number;
  referenceValue?: number;
  legalType?: 'inss' | 'irrf' | 'fgts';
  /** Chave de FORMULAS_FOLHA quando calculationType = 'formula'. */
  formula?: string;
  /** Grupo de tributos (default 'mensal'). */
  natureza?: NaturezaFolha;
}

/** Totais por natureza (só naturezas presentes no cálculo). */
export interface TotaisNatureza {
  bruto: number;
  inssBase: number;
  inss: number;
  irrfBase: number;
  irrf: number;
  fgtsBase: number;
  fgts: number;
  liquido: number;
}

export interface PayrollCalculationResult {
  employeeId: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalOthers: number;
  inssBase: number;
  inssValue: number;
  irrfBase: number;
  irrfValue: number;
  fgtsBase: number;
  fgtsValue: number;
  grossSalary: number;
  netSalary: number;
  items: PayrollCalculatedItem[];
  /** Totais por grupo de natureza (mensal/ferias/decimo/rescisao). */
  porNatureza: Partial<Record<NaturezaFolha, TotaisNatureza>>;
}

export interface PayrollCalculatedItem {
  codeId: string;
  code: string;
  type: 'provento' | 'desconto' | 'outros';
  name: string;
  quantity: number;
  referenceValue: number;
  calculatedValue: number;
  /** Preenchido quando algo não pôde ser calculado (ex.: 'formula_nao_implementada'). */
  aviso?: string;
  /** Natureza do grupo em que o item foi calculado. */
  natureza?: NaturezaFolha;
}

/**
 * Calcula o INSS baseado no salário
 */
export function calculateINSS(salary: number): { base: number; value: number } {
  const base = Math.min(salary, LEGAL_TABLES.INSS.CEILING);

  if (base <= 0) return { base: 0, value: 0 };

  // Usar a fórmula com parcela a deduzir para cálculo mais preciso
  let value = 0;

  for (const bracket of LEGAL_TABLES.INSS.BRACKETS) {
    if (base >= bracket.min) {
      if (base <= bracket.max) {
        value = (base * bracket.rate) - bracket.deduction;
        break;
      }
    }
  }

  // Garantir que não ultrapasse o desconto máximo
  value = Math.min(value, LEGAL_TABLES.INSS.MAX_DISCOUNT);
  value = Math.max(value, 0); // Não pode ser negativo

  return { base, value: round2(value) };
}

/**
 * Aplica a tabela progressiva do IRRF a uma base de cálculo.
 */
function impostoTabelaIRRF(base: number): number {
  let value = 0;

  for (const bracket of LEGAL_TABLES.IRRF.BRACKETS) {
    if (base >= bracket.min) {
      if (base <= bracket.max || bracket.max === Infinity) {
        value = (base * bracket.rate) - bracket.deduction;
        break;
      }
    }
  }

  return round2(Math.max(0, value));
}

/**
 * Calcula o IRRF efetivo: tabela progressiva × dedução simplificada.
 *
 * Regra vigente: o contribuinte pode optar pelo desconto simplificado fixo
 * de R$ 607,20 — na prática vale o MENOR imposto entre as duas formas.
 *
 * Fixture mental (tabelas 2025 deste arquivo):
 *   salário 3.000,00, 2 dependentes:
 *     INSS = 3.000 × 12% − 106,59 = 253,41 (faixa 3 da tabela)
 *     base legal = 3.000 − 253,41 − 2 × 189,59 = 2.367,41
 *       → faixa isenta (≤ 2.428,80) → imposto legal = 0
 *     base simplificada = 2.367,41 − 607,20 = 1.760,21 → também isenta → 0
 *     IRRF = min(0, 0) = 0
 */
export function calculateIRRF(
  grossSalary: number,
  inssValue: number,
  dependents: number = 0,
  useSimplifiedDeduction: boolean = true
): { base: number; value: number } {
  // Base de cálculo = Salário bruto - INSS - dependentes
  const base = Math.max(0, grossSalary - inssValue - (dependents * LEGAL_TABLES.IRRF.DEPENDENT_DEDUCTION));

  if (base <= 0) return { base: 0, value: 0 };

  const impostoLegal = impostoTabelaIRRF(base);

  if (!useSimplifiedDeduction) {
    return { base, value: impostoLegal };
  }

  const baseSimplificada = Math.max(0, base - LEGAL_TABLES.IRRF.SIMPLIFIED_DEDUCTION);
  const impostoSimplificado = impostoTabelaIRRF(baseSimplificada);

  // Menor imposto vence (opção legal pela dedução simplificada)
  return { base, value: Math.min(impostoLegal, impostoSimplificado) };
}

/**
 * Calcula o FGTS baseado no salário
 */
export function calculateFGTS(salary: number): { base: number; value: number } {
  const base = salary;
  const value = base * LEGAL_TABLES.FGTS.RATE;

  return {
    base,
    value: round2(value)
  };
}

/**
 * Calcula um item individual da folha. Para `formula`, a chave vem de
 * `item.formula` (FORMULAS_FOLHA); sem contexto/sem fórmula → 0.
 * Para sinalizar aviso use calculateEmployeePayroll (este wrapper retorna só número).
 */
export function calculatePayrollItem(
  item: PayrollItem,
  baseSalary: number,
  grossSalary: number,
  contexto?: FormulaContext
): number {
  const resultado = avaliarItem(item, baseSalary, grossSalary, contexto);
  return resultado.valor;
}

/**
 * Avalia o item retornando valor + possível aviso (fórmula ausente etc.).
 */
function avaliarItem(
  item: PayrollItem,
  baseSalary: number,
  grossSalary: number,
  contexto?: FormulaContext
): { valor: number; aviso?: string } {
  const quantity = item.quantity || 1;
  const referenceValue = item.referenceValue || baseSalary;

  switch (item.calculationType) {
    case 'fixed':
      return { valor: round2(item.value * quantity) };

    case 'percentage':
      return { valor: round2((referenceValue * (item.value / 100)) * quantity) };

    case 'legal':
      switch (item.legalType) {
        case 'inss':
          return { valor: calculateINSS(grossSalary).value };
        case 'irrf':
          // Para IRRF, precisamos do INSS já calculado
          const inss = calculateINSS(grossSalary).value;
          return { valor: calculateIRRF(grossSalary, inss).value };
        case 'fgts':
          return { valor: calculateFGTS(grossSalary).value };
        default:
          return { valor: 0 };
      }

    case 'formula': {
      const formula = item.formula ? FORMULAS_FOLHA[item.formula] : undefined;
      if (!formula || !contexto) {
        // Fórmula ausente do mapa ou sem contexto: NUNCA inventa valor.
        return { valor: 0, aviso: 'formula_nao_implementada' };
      }
      const resultado = formula(contexto);
      if (resultado === null || !Number.isFinite(resultado)) {
        return { valor: 0, aviso: 'formula_nao_implementada' };
      }
      return { valor: round2(resultado) };
    }

    default:
      return { valor: 0 };
  }
}

interface GrupoCalculado {
  bruto: number;
  inssBase: number;
  inss: number;
  irrfBase: number;
  irrf: number;
  fgtsBase: number;
  fgts: number;
  descontos: number;
}

const ORDEM_NATUREZAS: NaturezaFolha[] = ['mensal', 'ferias', 'decimo', 'rescisao'];

/**
 * Calcula a folha completa de um funcionário.
 *
 * `perfil` (opcional) aplica o payroll_calculation_profiles.rules:
 * - tetoVTPercentual: desconto de VT limitado a bruto × teto/100;
 * - ignorarInss/ignorarIrrf/ignorarFgts: desligam os descontos legais.
 *
 * Itens são agrupados por natureza e os tributos calculados POR GRUPO:
 * - decimo: INSS na própria base, SEM IRRF (FGTS mantido);
 * - ferias: IRRF sobre bruto − 1/3 constitucional isento (base = bruto − bruto/3 − INSS − dependentes);
 * - mensal/rescisao: padrão.
 */
export function calculateEmployeePayroll(
  employee: PayrollEmployee,
  items: PayrollItem[],
  perfil?: PerfilCalculo
): PayrollCalculationResult {
  const baseSalary = employee.baseSalary;
  const dependentes = employee.dependents || 0;
  let totalEarnings = 0;
  let totalDeductions = 0;
  let totalOthers = 0;

  const calculatedItems: PayrollCalculatedItem[] = [];
  const porNatureza: Partial<Record<NaturezaFolha, TotaisNatureza>> = {};

  // Agrupar itens por natureza (default 'mensal')
  const grupos = new Map<NaturezaFolha, PayrollItem[]>();
  for (const item of items) {
    const natureza = item.natureza ?? 'mensal';
    const lista = grupos.get(natureza) ?? [];
    lista.push(item);
    grupos.set(natureza, lista);
  }

  for (const natureza of ORDEM_NATUREZAS) {
    const itensGrupo = grupos.get(natureza);
    if (!itensGrupo || itensGrupo.length === 0) continue;

    const grupo: GrupoCalculado = { bruto: 0, inssBase: 0, inss: 0, irrfBase: 0, irrf: 0, fgtsBase: 0, fgts: 0, descontos: 0 };

    // 1) Proventos — não-fórmula primeiro (fórmulas consomem os valores calculados)
    const proventos = itensGrupo.filter((item) => item.type === 'provento');
    const proventosSimples = proventos.filter((item) => item.calculationType !== 'formula');
    const proventosFormula = proventos.filter((item) => item.calculationType === 'formula');
    const itensBase: FormulaContextItem[] = [];

    const processarProvento = (item: PayrollItem, contexto?: FormulaContext) => {
      const { valor, aviso } = avaliarItem(item, baseSalary, grupo.bruto, contexto);
      grupo.bruto = round2(grupo.bruto + valor);
      calculatedItems.push({
        codeId: item.codeId,
        code: item.code,
        type: item.type,
        name: item.name,
        quantity: item.quantity || 1,
        referenceValue: item.referenceValue || baseSalary,
        calculatedValue: valor,
        ...(aviso ? { aviso } : {}),
        natureza
      });
      itensBase.push({
        valor,
        refleteDsr: REFLETE_DSR_POR_CODIGO[item.code] === true,
        ehHoraExtra: HORA_EXTRA_POR_CODIGO[item.code] === true
      });
    };

    for (const item of proventosSimples) processarProvento(item);
    for (const item of proventosFormula) {
      const contexto: FormulaContext = {
        referencia: baseSalary,
        quantidade: item.quantity || 1,
        percentual: item.value,
        itensBase: [...itensBase]
      };
      processarProvento(item, contexto);
    }

    // 2) Descontos legais POR GRUPO
    const inssGrupo = perfil?.ignorarInss
      ? { base: 0, value: 0 }
      : calculateINSS(grupo.bruto);
    let irrfGrupo = { base: 0, value: 0 };
    if (!perfil?.ignorarIrrf && natureza !== 'decimo') {
      let baseIrrf = grupo.bruto - inssGrupo.value;
      if (natureza === 'ferias') {
        // 1/3 constitucional de férias é isento
        baseIrrf -= grupo.bruto / 3;
      }
      irrfGrupo = calculateIRRF(baseIrrf, 0, dependentes);
    }
    const fgtsGrupo = perfil?.ignorarFgts
      ? { base: 0, value: 0 }
      : calculateFGTS(grupo.bruto);

    grupo.inssBase = inssGrupo.base;
    grupo.inss = inssGrupo.value;
    grupo.irrfBase = irrfGrupo.base;
    grupo.irrf = irrfGrupo.value;
    grupo.fgtsBase = fgtsGrupo.base;
    grupo.fgts = fgtsGrupo.value;

    // 3) Descontos manuais do grupo (legais já calculados acima são ignorados aqui)
    const descontos = itensGrupo.filter(
      (item) => item.type === 'desconto' && item.legalType !== 'inss' && item.legalType !== 'irrf'
    );
    for (const item of descontos) {
      const { valor, aviso } = avaliarItem(item, baseSalary, grupo.bruto);
      let valorFinal = valor;
      if (item.code === CODIGO_VT && perfil?.tetoVTPercentual !== undefined) {
        // Teto do VT: min(valor calculado, bruto × teto%)
        valorFinal = Math.min(valorFinal, round2((grupo.bruto * perfil.tetoVTPercentual) / 100));
      }
      grupo.descontos = round2(grupo.descontos + valorFinal);
      totalDeductions += valorFinal;
      calculatedItems.push({
        codeId: item.codeId,
        code: item.code,
        type: item.type,
        name: item.name,
        quantity: item.quantity || 1,
        referenceValue: item.referenceValue || baseSalary,
        calculatedValue: valorFinal,
        ...(aviso ? { aviso } : {}),
        natureza
      });
    }

    // 4) Outros manuais do grupo (FGTS legal é tratado à parte)
    const outros = itensGrupo.filter((item) => item.type === 'outros' && item.legalType !== 'fgts');
    for (const item of outros) {
      const { valor, aviso } = avaliarItem(item, baseSalary, grupo.bruto);
      totalOthers += valor;
      calculatedItems.push({
        codeId: item.codeId,
        code: item.code,
        type: item.type,
        name: item.name,
        quantity: item.quantity || 1,
        referenceValue: item.referenceValue || baseSalary,
        calculatedValue: valor,
        ...(aviso ? { aviso } : {}),
        natureza
      });
    }

    totalEarnings += grupo.bruto;

    // 5) Linhas legais do grupo (INSS/IRRF/FGTS)
    if (!perfil?.ignorarInss) {
      calculatedItems.push({
        codeId: 'inss-legal',
        code: '104',
        type: 'desconto',
        name: 'INSS',
        quantity: 1,
        referenceValue: inssGrupo.base,
        calculatedValue: inssGrupo.value,
        natureza
      });
    }
    if (!perfil?.ignorarIrrf && natureza !== 'decimo') {
      calculatedItems.push({
        codeId: 'irrf-legal',
        code: '108',
        type: 'desconto',
        name: 'IRRF',
        quantity: 1,
        referenceValue: irrfGrupo.base,
        calculatedValue: irrfGrupo.value,
        natureza
      });
    }
    if (!perfil?.ignorarFgts) {
      calculatedItems.push({
        codeId: 'fgts-legal',
        code: '119',
        type: 'outros',
        name: 'FGTS 8%',
        quantity: 1,
        referenceValue: fgtsGrupo.base,
        calculatedValue: fgtsGrupo.value,
        natureza
      });
    }

    totalDeductions += grupo.inss + grupo.irrf;
    totalOthers += grupo.fgts;

    porNatureza[natureza] = {
      bruto: grupo.bruto,
      inssBase: grupo.inssBase,
      inss: grupo.inss,
      irrfBase: grupo.irrfBase,
      irrf: grupo.irrf,
      fgtsBase: grupo.fgtsBase,
      fgts: grupo.fgts,
      liquido: round2(grupo.bruto - grupo.inss - grupo.irrf - grupo.descontos)
    };
  }

  const grossSalary = round2(totalEarnings);
  const netSalary = round2(grossSalary - totalDeductions);

  return {
    employeeId: employee.id,
    baseSalary,
    totalEarnings,
    totalDeductions,
    totalOthers,
    inssBase: round2([...Object.values(porNatureza)].reduce((acc, g) => acc + g.inssBase, 0)),
    inssValue: round2([...Object.values(porNatureza)].reduce((acc, g) => acc + g.inss, 0)),
    irrfBase: round2([...Object.values(porNatureza)].reduce((acc, g) => acc + g.irrfBase, 0)),
    irrfValue: round2([...Object.values(porNatureza)].reduce((acc, g) => acc + g.irrf, 0)),
    fgtsBase: round2([...Object.values(porNatureza)].reduce((acc, g) => acc + g.fgtsBase, 0)),
    fgtsValue: round2([...Object.values(porNatureza)].reduce((acc, g) => acc + g.fgts, 0)),
    grossSalary,
    netSalary,
    items: calculatedItems,
    porNatureza
  };
}
