/**
 * Motor de Cálculo da Folha de Pagamento
 * Sistema de Folha de Pagamento - Painel ABZ
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
}

export interface PayrollCalculatedItem {
  codeId: string;
  code: string;
  type: 'provento' | 'desconto' | 'outros';
  name: string;
  quantity: number;
  referenceValue: number;
  calculatedValue: number;
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
  
  return { base, value: Math.round(value * 100) / 100 };
}

/**
 * Calcula o IRRF baseado no salário e dependentes
 */
export function calculateIRRF(
  grossSalary: number, 
  inssValue: number, 
  dependents: number = 0,
  useSimplifiedDeduction: boolean = true
): { base: number; value: number } {
  // Base de cálculo = Salário bruto - INSS - Dependentes
  let base = grossSalary - inssValue - (dependents * LEGAL_TABLES.IRRF.DEPENDENT_DEDUCTION);
  
  // Aplicar dedução simplificada se habilitada
  if (useSimplifiedDeduction) {
    base = Math.max(0, base - LEGAL_TABLES.IRRF.SIMPLIFIED_DEDUCTION);
  }
  
  if (base <= 0) return { base: 0, value: 0 };
  
  // Calcular IRRF usando as faixas
  let value = 0;
  
  for (const bracket of LEGAL_TABLES.IRRF.BRACKETS) {
    if (base >= bracket.min) {
      if (base <= bracket.max || bracket.max === Infinity) {
        value = (base * bracket.rate) - bracket.deduction;
        break;
      }
    }
  }
  
  value = Math.max(value, 0); // Não pode ser negativo
  
  return { 
    base: grossSalary - inssValue, // Base original para relatórios
    value: Math.round(value * 100) / 100 
  };
}

/**
 * Calcula o FGTS baseado no salário
 */
export function calculateFGTS(salary: number): { base: number; value: number } {
  const base = salary;
  const value = base * LEGAL_TABLES.FGTS.RATE;
  
  return { 
    base, 
    value: Math.round(value * 100) / 100 
  };
}

/**
 * Calcula um item individual da folha
 */
export function calculatePayrollItem(
  item: PayrollItem, 
  baseSalary: number, 
  grossSalary: number
): number {
  const quantity = item.quantity || 1;
  const referenceValue = item.referenceValue || baseSalary;
  
  switch (item.calculationType) {
    case 'fixed':
      return item.value * quantity;
      
    case 'percentage':
      return (referenceValue * (item.value / 100)) * quantity;
      
    case 'legal':
      switch (item.legalType) {
        case 'inss':
          return calculateINSS(grossSalary).value;
        case 'irrf':
          // Para IRRF, precisamos do INSS já calculado
          const inss = calculateINSS(grossSalary).value;
          return calculateIRRF(grossSalary, inss).value;
        case 'fgts':
          return calculateFGTS(grossSalary).value;
        default:
          return 0;
      }
      
    case 'formula':
      // Para fórmulas mais complexas, implementar conforme necessário
      // Por enquanto, retornar valor fixo
      return item.value * quantity;
      
    default:
      return 0;
  }
}

/**
 * Calcula a folha completa de um funcionário
 */
export function calculateEmployeePayroll(
  employee: PayrollEmployee,
  items: PayrollItem[]
): PayrollCalculationResult {
  const baseSalary = employee.baseSalary;
  let totalEarnings = 0;
  let totalDeductions = 0;
  let totalOthers = 0;
  
  const calculatedItems: PayrollCalculatedItem[] = [];
  
  // Primeiro, calcular todos os proventos para obter o salário bruto
  const earnings = items.filter(item => item.type === 'provento');
  for (const item of earnings) {
    const calculatedValue = calculatePayrollItem(item, baseSalary, baseSalary);
    totalEarnings += calculatedValue;
    
    calculatedItems.push({
      codeId: item.codeId,
      code: item.code,
      type: item.type,
      name: item.name,
      quantity: item.quantity || 1,
      referenceValue: item.referenceValue || baseSalary,
      calculatedValue
    });
  }
  
  const grossSalary = totalEarnings;
  
  // Calcular descontos legais
  const inssResult = calculateINSS(grossSalary);
  const irrfResult = calculateIRRF(grossSalary, inssResult.value, employee.dependents || 0);
  const fgtsResult = calculateFGTS(grossSalary);
  
  // Calcular outros descontos
  const deductions = items.filter(item => item.type === 'desconto' && item.legalType !== 'inss' && item.legalType !== 'irrf');
  for (const item of deductions) {
    const calculatedValue = calculatePayrollItem(item, baseSalary, grossSalary);
    totalDeductions += calculatedValue;
    
    calculatedItems.push({
      codeId: item.codeId,
      code: item.code,
      type: item.type,
      name: item.name,
      quantity: item.quantity || 1,
      referenceValue: item.referenceValue || baseSalary,
      calculatedValue
    });
  }
  
  // Adicionar descontos legais ao total
  totalDeductions += inssResult.value + irrfResult.value;
  
  // Calcular outros (FGTS, etc.)
  const others = items.filter(item => item.type === 'outros' && item.legalType !== 'fgts');
  for (const item of others) {
    const calculatedValue = calculatePayrollItem(item, baseSalary, grossSalary);
    totalOthers += calculatedValue;
    
    calculatedItems.push({
      codeId: item.codeId,
      code: item.code,
      type: item.type,
      name: item.name,
      quantity: item.quantity || 1,
      referenceValue: item.referenceValue || baseSalary,
      calculatedValue
    });
  }
  
  // Adicionar FGTS ao total de outros
  totalOthers += fgtsResult.value;
  
  // Adicionar itens legais aos calculados
  calculatedItems.push(
    {
      codeId: 'inss-legal',
      code: '104',
      type: 'desconto',
      name: 'INSS',
      quantity: 1,
      referenceValue: inssResult.base,
      calculatedValue: inssResult.value
    },
    {
      codeId: 'irrf-legal',
      code: '108',
      type: 'desconto',
      name: 'IRRF',
      quantity: 1,
      referenceValue: irrfResult.base,
      calculatedValue: irrfResult.value
    },
    {
      codeId: 'fgts-legal',
      code: '119',
      type: 'outros',
      name: 'FGTS 8%',
      quantity: 1,
      referenceValue: fgtsResult.base,
      calculatedValue: fgtsResult.value
    }
  );
  
  const netSalary = grossSalary - totalDeductions;
  
  return {
    employeeId: employee.id,
    baseSalary,
    totalEarnings,
    totalDeductions,
    totalOthers,
    inssBase: inssResult.base,
    inssValue: inssResult.value,
    irrfBase: irrfResult.base,
    irrfValue: irrfResult.value,
    fgtsBase: fgtsResult.base,
    fgtsValue: fgtsResult.value,
    grossSalary,
    netSalary,
    items: calculatedItems
  };
}
