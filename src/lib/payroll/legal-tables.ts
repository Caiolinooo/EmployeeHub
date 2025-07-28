/**
 * Tabelas da Legislação Trabalhista Brasileira 2025
 * Sistema de Folha de Pagamento - Painel ABZ
 */

// Tabela INSS 2025
export const INSS_TABLE_2025 = {
  salaryMin: 1518.00,
  ceiling: 8157.41,
  maxDiscount: 951.62,
  brackets: [
    {
      id: 1,
      description: 'Até R$ 1.518,00',
      min: 0,
      max: 1518.00,
      rate: 7.5,
      deduction: 0
    },
    {
      id: 2,
      description: 'De R$ 1.518,01 até R$ 2.793,88',
      min: 1518.01,
      max: 2793.88,
      rate: 9.0,
      deduction: 22.77
    },
    {
      id: 3,
      description: 'De R$ 2.793,89 até R$ 4.190,83',
      min: 2793.89,
      max: 4190.83,
      rate: 12.0,
      deduction: 106.59
    },
    {
      id: 4,
      description: 'De R$ 4.190,84 até R$ 8.157,41',
      min: 4190.84,
      max: 8157.41,
      rate: 14.0,
      deduction: 190.40
    }
  ]
};

// Tabela IRRF 2025 (vigente a partir de maio/2025)
export const IRRF_TABLE_2025 = {
  exemptionLimit: 3036.00, // Rendimento bruto
  exemptionBase: 2428.80,  // Base de cálculo
  simplifiedDeduction: 607.20,
  dependentDeduction: 189.59,
  brackets: [
    {
      id: 1,
      description: 'Até R$ 2.428,80',
      min: 0,
      max: 2428.80,
      rate: 0,
      deduction: 0
    },
    {
      id: 2,
      description: 'De R$ 2.428,81 até R$ 2.826,65',
      min: 2428.81,
      max: 2826.65,
      rate: 7.5,
      deduction: 182.16
    },
    {
      id: 3,
      description: 'De R$ 2.826,66 até R$ 3.751,05',
      min: 2826.66,
      max: 3751.05,
      rate: 15.0,
      deduction: 394.16
    },
    {
      id: 4,
      description: 'De R$ 3.751,06 até R$ 4.664,68',
      min: 3751.06,
      max: 4664.68,
      rate: 22.5,
      deduction: 675.49
    },
    {
      id: 5,
      description: 'Acima de R$ 4.664,68',
      min: 4664.69,
      max: Infinity,
      rate: 27.5,
      deduction: 908.73
    }
  ]
};

// Tabela FGTS
export const FGTS_TABLE = {
  rate: 8.0, // 8%
  description: 'Fundo de Garantia do Tempo de Serviço'
};

// Códigos padrão da folha de pagamento
export const PAYROLL_CODES = {
  // Proventos
  PROVENTOS: {
    '001': { name: 'Dias Normais', type: 'fixed' },
    '002': { name: 'Horas Extras 50%', type: 'percentage', value: 50 },
    '003': { name: 'Horas Extras 100%', type: 'percentage', value: 100 },
    '004': { name: 'DSR', type: 'formula' },
    '005': { name: 'Férias', type: 'fixed' },
    '006': { name: '1/3 Férias', type: 'percentage', value: 33.33 },
    '007': { name: '13º Salário', type: 'fixed' },
    '063': { name: 'Adicional de Sobreaviso 20%', type: 'percentage', value: 20 },
    '125': { name: 'Folga Indenizada', type: 'fixed' },
    '127': { name: 'Reflexo DSR s/adicional noturno', type: 'formula' },
    '131': { name: 'Adicional Noturno 20%', type: 'percentage', value: 20 },
    '138': { name: 'Dobra', type: 'percentage', value: 100 },
    '213': { name: 'Adicional de Periculosidade 30%', type: 'percentage', value: 30 }
  },

  // Descontos
  DESCONTOS: {
    '104': { name: 'INSS', type: 'legal', legalType: 'inss' },
    '108': { name: 'IRRF', type: 'legal', legalType: 'irrf' },
    '201': { name: 'Vale Transporte', type: 'percentage', value: 6, maxPercentage: 20 },
    '202': { name: 'Vale Refeição', type: 'fixed' },
    '203': { name: 'Plano de Saúde', type: 'fixed' },
    '204': { name: 'Seguro de Vida', type: 'fixed' },
    '205': { name: 'Empréstimo', type: 'fixed' },
    '206': { name: 'Pensão Alimentícia', type: 'percentage' },
    '207': { name: 'Sindicato', type: 'fixed' }
  },

  // Outros
  OUTROS: {
    '119': { name: 'FGTS 8%', type: 'legal', legalType: 'fgts' },
    '301': { name: 'Aviso Prévio', type: 'fixed' },
    '302': { name: 'Multa 40% FGTS', type: 'percentage', value: 40 }
  }
};

// Funções utilitárias para trabalhar com as tabelas
export class LegalTablesHelper {
  /**
   * Formatar valor monetário para exibição
   */
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Formatar percentual para exibição
   */
  static formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /**
   * Obter faixa do INSS para um salário
   */
  static getINSSBracket(salary: number) {
    return INSS_TABLE_2025.brackets.find(bracket => 
      salary >= bracket.min && salary <= bracket.max
    );
  }

  /**
   * Obter faixa do IRRF para uma base de cálculo
   */
  static getIRRFBracket(base: number) {
    return IRRF_TABLE_2025.brackets.find(bracket => 
      base >= bracket.min && (base <= bracket.max || bracket.max === Infinity)
    );
  }

  /**
   * Verificar se um salário está isento de IRRF
   */
  static isIRRFExempt(grossSalary: number): boolean {
    return grossSalary <= IRRF_TABLE_2025.exemptionLimit;
  }

  /**
   * Calcular base de cálculo do IRRF
   */
  static calculateIRRFBase(
    grossSalary: number, 
    inssValue: number, 
    dependents: number = 0,
    useSimplifiedDeduction: boolean = true
  ): number {
    let base = grossSalary - inssValue - (dependents * IRRF_TABLE_2025.dependentDeduction);
    
    if (useSimplifiedDeduction) {
      base = Math.max(0, base - IRRF_TABLE_2025.simplifiedDeduction);
    }
    
    return Math.max(0, base);
  }

  /**
   * Obter informações completas sobre as tabelas legais
   */
  static getLegalTablesInfo() {
    return {
      inss: {
        ...INSS_TABLE_2025,
        formattedCeiling: this.formatCurrency(INSS_TABLE_2025.ceiling),
        formattedMaxDiscount: this.formatCurrency(INSS_TABLE_2025.maxDiscount),
        brackets: INSS_TABLE_2025.brackets.map(bracket => ({
          ...bracket,
          formattedMin: this.formatCurrency(bracket.min),
          formattedMax: this.formatCurrency(bracket.max),
          formattedRate: this.formatPercentage(bracket.rate),
          formattedDeduction: this.formatCurrency(bracket.deduction)
        }))
      },
      irrf: {
        ...IRRF_TABLE_2025,
        formattedExemptionLimit: this.formatCurrency(IRRF_TABLE_2025.exemptionLimit),
        formattedExemptionBase: this.formatCurrency(IRRF_TABLE_2025.exemptionBase),
        formattedSimplifiedDeduction: this.formatCurrency(IRRF_TABLE_2025.simplifiedDeduction),
        formattedDependentDeduction: this.formatCurrency(IRRF_TABLE_2025.dependentDeduction),
        brackets: IRRF_TABLE_2025.brackets.map(bracket => ({
          ...bracket,
          formattedMin: this.formatCurrency(bracket.min),
          formattedMax: bracket.max === Infinity ? 'Acima' : this.formatCurrency(bracket.max),
          formattedRate: this.formatPercentage(bracket.rate),
          formattedDeduction: this.formatCurrency(bracket.deduction)
        }))
      },
      fgts: {
        ...FGTS_TABLE,
        formattedRate: this.formatPercentage(FGTS_TABLE.rate)
      }
    };
  }

  /**
   * Validar se as tabelas estão atualizadas
   */
  static validateTables(): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const currentYear = new Date().getFullYear();
    
    if (currentYear > 2025) {
      warnings.push('As tabelas podem estar desatualizadas. Verifique a legislação vigente.');
    }
    
    // Verificar se os valores fazem sentido
    if (INSS_TABLE_2025.ceiling < INSS_TABLE_2025.salaryMin) {
      warnings.push('Teto do INSS menor que o salário mínimo.');
    }
    
    if (IRRF_TABLE_2025.exemptionLimit < INSS_TABLE_2025.salaryMin) {
      warnings.push('Limite de isenção do IRRF menor que o salário mínimo.');
    }
    
    return {
      isValid: warnings.length === 0,
      warnings
    };
  }
}

// Exportar as tabelas principais
// export { INSS_TABLE_2025, IRRF_TABLE_2025, FGTS_TABLE }; // Removido para evitar duplicação
