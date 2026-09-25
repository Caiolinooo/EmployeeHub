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
 * Vigência: competência anterior a 2026 usa a tabela 2025; de janeiro/2026 em diante,
 * INSS da Portaria MPS/MF nº 13/2026 e redutor mensal da Lei 15.270/2025.
 * Sem competência informada, vale a tabela corrente (2026).
 * Todos os campos/parâmetros novos são OPCIONAIS — consumidores antigos não quebram.
 */

export type VigenciaFolha = '2025' | '2026';

/** Competência civil da folha. Mês 1–12. */
export interface CompetenciaLegal {
  ano: number;
  mes: number;
}

export interface FaixaLegal {
  min: number;
  max: number;
  rate: number;
  deduction: number;
}

/** Redutor do art. 3º-A da Lei 9.250, incluído pela Lei 15.270/2025. */
export interface ReducaoIrrfMensal {
  /** Até este rendimento, a redução é de até REDUCAO_ISENCAO. */
  ISENCAO_ATE: number;
  REDUCAO_ISENCAO: number;
  /** Até este rendimento, redução = TETO_FORMULA − FATOR × rendimento. Acima, zero. */
  FAIXA_ATE: number;
  TETO_FORMULA: number;
  FATOR: number;
}

export interface TabelaInss {
  SALARY_MIN: number;
  CEILING: number;
  MAX_DISCOUNT: number;
  BRACKETS: FaixaLegal[];
}

export interface TabelaIrrf {
  /** Rendimento bruto a partir do qual o imposto deixa de ser zero na prática desta vigência. */
  EXEMPTION_LIMIT: number;
  EXEMPTION_BASE: number;
  SIMPLIFIED_DEDUCTION: number;
  DEPENDENT_DEDUCTION: number;
  BRACKETS: FaixaLegal[];
  REDUCAO?: ReducaoIrrfMensal;
}

export interface TabelasLegais {
  INSS: TabelaInss;
  IRRF: TabelaIrrf;
  FGTS: { RATE: number };
}

/**
 * INSS 2025 — empregado/segurado.
 * Parcela a deduzir: acumulado exato das diferenças de alíquota, arredondado
 * na 2ª casa (190,403 → 190,40). Desconto máximo: soma das faixas no teto,
 * cada faixa truncada na 2ª casa (951,62).
 */
export const TABELA_INSS_2025: TabelaInss = {
  SALARY_MIN: 1518.00,
  CEILING: 8157.41,
  MAX_DISCOUNT: 951.62,
  BRACKETS: [
    { min: 0, max: 1518.00, rate: 0.075, deduction: 0 },
    { min: 1518.01, max: 2793.88, rate: 0.09, deduction: 22.77 },
    { min: 2793.89, max: 4190.83, rate: 0.12, deduction: 106.59 },
    { min: 4190.84, max: 8157.41, rate: 0.14, deduction: 190.40 }
  ]
};

/**
 * INSS 2026 — Portaria Interministerial MPS/MF nº 13, de 9 de janeiro de 2026.
 * Faixas (vigência 01/01/2026): 1.621,00 / 2.902,84 / 4.354,27 / teto 8.475,55,
 * alíquotas 7,5% / 9% / 12% / 14%.
 * A portaria não publica parcela a deduzir. Os números abaixo usam o mesmo
 * método da tabela 2025 deste arquivo. 957,37 não fecha com estas faixas.
 * Deduções: 0 / 24,32 / 111,40 / 198,49. Desconto no teto: 988,07.
 */
export const TABELA_INSS_2026: TabelaInss = {
  SALARY_MIN: 1621.00,
  CEILING: 8475.55,
  MAX_DISCOUNT: 988.07,
  BRACKETS: [
    { min: 0, max: 1621.00, rate: 0.075, deduction: 0 },
    { min: 1621.01, max: 2902.84, rate: 0.09, deduction: 24.32 },
    { min: 2902.85, max: 4354.27, rate: 0.12, deduction: 111.40 },
    { min: 4354.28, max: 8475.55, rate: 0.14, deduction: 198.49 }
  ]
};

/** Faixas progressivas do IRRF. Não mudaram com a Lei 15.270/2025. */
const FAIXAS_IRRF_PROGRESSIVO: FaixaLegal[] = [
  { min: 0, max: 2428.80, rate: 0, deduction: 0 },
  { min: 2428.81, max: 2826.65, rate: 0.075, deduction: 182.16 },
  { min: 2826.66, max: 3751.05, rate: 0.15, deduction: 394.16 },
  { min: 3751.06, max: 4664.68, rate: 0.225, deduction: 675.49 },
  { min: 4664.69, max: Infinity, rate: 0.275, deduction: 908.73 }
];

/** IRRF a partir de maio/2025, sem o redutor de 2026. */
export const TABELA_IRRF_2025: TabelaIrrf = {
  EXEMPTION_LIMIT: 3036.00,
  EXEMPTION_BASE: 2428.80,
  SIMPLIFIED_DEDUCTION: 607.20,
  DEPENDENT_DEDUCTION: 189.59,
  BRACKETS: FAIXAS_IRRF_PROGRESSIVO
};

/**
 * IRRF 2026. Tabela progressiva igual à de 2025. Depois do imposto, a Lei
 * 15.270/2025 reduz: até R$ 5.000,00, até R$ 312,89; de R$ 5.000,01 a
 * R$ 7.350,00, 978,62 − 0,133145 × rendimento; acima, sem redução.
 * O rendimento é o salário tributável, não a base já líquida de INSS.
 */
export const TABELA_IRRF_2026: TabelaIrrf = {
  EXEMPTION_LIMIT: 5000.00,
  EXEMPTION_BASE: 2428.80,
  SIMPLIFIED_DEDUCTION: 607.20,
  DEPENDENT_DEDUCTION: 189.59,
  BRACKETS: FAIXAS_IRRF_PROGRESSIVO,
  REDUCAO: {
    ISENCAO_ATE: 5000.00,
    REDUCAO_ISENCAO: 312.89,
    FAIXA_ATE: 7350.00,
    TETO_FORMULA: 978.62,
    FATOR: 0.133145
  }
};

const FGTS_8 = { RATE: 0.08 };

export function vigenciaDaCompetencia(competencia?: CompetenciaLegal | null): VigenciaFolha {
  if (competencia && Number.isFinite(competencia.ano) && competencia.ano < 2026) return '2025';
  return '2026';
}

export function tabelasDaVigencia(vigencia: VigenciaFolha = '2026'): TabelasLegais {
  if (vigencia === '2025') {
    return { INSS: TABELA_INSS_2025, IRRF: TABELA_IRRF_2025, FGTS: FGTS_8 };
  }
  return { INSS: TABELA_INSS_2026, IRRF: TABELA_IRRF_2026, FGTS: FGTS_8 };
}

/** Tabela corrente (2026). Consumidores que não passam vigência. */
export const LEGAL_TABLES: TabelasLegais = tabelasDaVigencia('2026');

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
  /**
   * Valor já apurado por uma fonte (dias × diária, WK, lançamento manual).
   * Quando finito, o motor NÃO recomputa pela definição do código — o cadastro
   * da rubrica tem value 0 e recalcular zeraria embarque/dobra/férias.
   * Tributos legais (INSS/IRRF/FGTS) ignoram este campo: nascem do bruto.
   */
  valorInformado?: number;
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
 * Calcula o INSS do segurado na vigência pedida (default: 2026).
 */
export function calculateINSS(salary: number, vigencia: VigenciaFolha = '2026'): { base: number; value: number } {
  const tabela = tabelasDaVigencia(vigencia).INSS;
  const tetoCentavos = Math.round(tabela.CEILING * 100);
  const baseCentavos = Math.min(Math.max(Math.round(salary * 100), 0), tetoCentavos);
  if (baseCentavos <= 0) return { base: 0, value: 0 };

  let valorCentavos = 0;
  for (const bracket of tabela.BRACKETS) {
    const minCentavos = Math.round(bracket.min * 100);
    const maxCentavos = Math.round(bracket.max * 100);
    if (baseCentavos >= minCentavos && baseCentavos <= maxCentavos) {
      const aliquota = Math.round(bracket.rate * 10000);
      const deducao = Math.round(bracket.deduction * 100);
      valorCentavos = Math.round((baseCentavos * aliquota) / 10000) - deducao;
      break;
    }
  }

  const tetoDesconto = Math.round(tabela.MAX_DISCOUNT * 100);
  valorCentavos = Math.min(Math.max(valorCentavos, 0), tetoDesconto);
  return { base: baseCentavos / 100, value: valorCentavos / 100 };
}

/**
 * Aplica a tabela progressiva do IRRF a uma base de cálculo.
 */
function impostoTabelaIRRF(base: number, faixas: FaixaLegal[]): number {
  let value = 0;

  for (const bracket of faixas) {
    if (base >= bracket.min && (base <= bracket.max || bracket.max === Infinity)) {
      value = (base * bracket.rate) - bracket.deduction;
      break;
    }
  }

  return round2(Math.max(0, value));
}

/**
 * Redução mensal da Lei 15.270/2025. Zero fora de 2026.
 * O rendimento é o tributável sujeito à incidência mensal (salário), não a base líquida de INSS.
 * A redução fica limitada ao imposto já apurado (§1º).
 */
export function reducaoMensalIRRF(rendimento: number, vigencia: VigenciaFolha = '2026'): number {
  const red = tabelasDaVigencia(vigencia).IRRF.REDUCAO;
  if (!red || rendimento <= 0) return 0;
  if (rendimento <= red.ISENCAO_ATE) return red.REDUCAO_ISENCAO;
  if (rendimento <= red.FAIXA_ATE) {
    return Math.max(0, round2(red.TETO_FORMULA - red.FATOR * rendimento));
  }
  return 0;
}

/**
 * IRRF efetivo.
 *
 * A dedução simplificada de R$ 607,20 substitui as deduções legais (INSS,
 * dependentes, pensão). Não se soma a elas. Vale o menor imposto.
 * Em 2026, o redutor da Lei 15.270 incide sobre esse imposto, limitado a ele.
 *
 * `grossSalary` é o rendimento tributável antes do INSS. Em férias, o chamador
 * já tira o 1/3 constitucional isento.
 */
export function calculateIRRF(
  grossSalary: number,
  inssValue: number,
  dependents: number = 0,
  useSimplifiedDeduction: boolean = true,
  vigencia: VigenciaFolha = '2026'
): { base: number; value: number } {
  const tabela = tabelasDaVigencia(vigencia).IRRF;
  const baseLegal = Math.max(0, grossSalary - inssValue - (dependents * tabela.DEPENDENT_DEDUCTION));
  const impostoLegal = impostoTabelaIRRF(baseLegal, tabela.BRACKETS);

  let base = baseLegal;
  let imposto = impostoLegal;

  if (useSimplifiedDeduction) {
    const baseSimplificada = Math.max(0, grossSalary - tabela.SIMPLIFIED_DEDUCTION);
    const impostoSimplificado = impostoTabelaIRRF(baseSimplificada, tabela.BRACKETS);
    if (impostoSimplificado < impostoLegal) {
      base = baseSimplificada;
      imposto = impostoSimplificado;
    }
  }

  const reducao = Math.min(reducaoMensalIRRF(grossSalary, vigencia), imposto);
  return { base: round2(base), value: round2(Math.max(0, imposto - reducao)) };
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
  if (item.legalType !== 'inss' && item.legalType !== 'irrf' && item.legalType !== 'fgts'
      && typeof item.valorInformado === 'number' && Number.isFinite(item.valorInformado)) {
    return { valor: round2(item.valorInformado) };
  }

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
      const formulaNome = item.formula;
      const formula =
        formulaNome && Object.hasOwn(FORMULAS_FOLHA, formulaNome)
          ? FORMULAS_FOLHA[formulaNome]
          : undefined;
      if (typeof formula !== 'function' || !contexto) {
        // Fórmula ausente do mapa ou sem contexto: NUNCA inventa valor.
        // Object.hasOwn bloqueia __proto__/constructor e chaves da cadeia.
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
 * - decimo: INSS na própria base, SEM IRRF (a Lei 15.270 também reduz o 13º,
 *   mas este motor ainda não retém IR de 13º);
 * - ferias: o 1/3 constitucional sai do rendimento tributável antes do IR;
 * - mensal/rescisao: padrão.
 * `competencia` escolhe a tabela: ano < 2026 → 2025; senão, ou se omitida, 2026.
 */
export function calculateEmployeePayroll(
  employee: PayrollEmployee,
  items: PayrollItem[],
  perfil?: PerfilCalculo,
  competencia?: CompetenciaLegal | null,
): PayrollCalculationResult {
  const vigencia = vigenciaDaCompetencia(competencia);
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
      : calculateINSS(grupo.bruto, vigencia);
    let irrfGrupo = { base: 0, value: 0 };
    if (!perfil?.ignorarIrrf && natureza !== 'decimo') {
      // Redutor e dedução simplificada usam o rendimento tributável, não a base já líquida de INSS.
      const rendimentoTributavel = natureza === 'ferias'
        ? round2(grupo.bruto - grupo.bruto / 3)
        : grupo.bruto;
      irrfGrupo = calculateIRRF(rendimentoTributavel, inssGrupo.value, dependentes, true, vigencia);
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
