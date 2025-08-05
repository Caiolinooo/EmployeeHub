/**
 * Tipos TypeScript para o Sistema de Folha de Pagamento
 * Sistema de Folha de Pagamento - Painel ABZ
 */

// Tipos básicos
export type PayrollCodeType = 'provento' | 'desconto' | 'outros';
export type PayrollCalculationType = 'fixed' | 'percentage' | 'formula' | 'legal';
export type PayrollLegalType = 'inss' | 'irrf' | 'fgts';
export type PayrollSheetStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'cancelled';
export type PayrollEmployeeStatus = 'active' | 'inactive' | 'terminated';

// Empresa/Cliente
export interface PayrollCompany {
  id: string;
  name: string;
  cnpj: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  isActive: boolean;
  // Configurações específicas do cliente
  payrollType?: 'standard' | 'custom' | 'import_based';
  templateVersion?: string;
  calculationMethod?: string;
  customSettings?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Departamento
export interface PayrollDepartment {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  company?: PayrollCompany;
}

// Funcionário da folha
export interface PayrollEmployee {
  id: string;
  employeeId?: string; // Referência ao sistema existente
  companyId: string;
  departmentId?: string;
  registrationNumber?: string;
  name: string;
  cpf?: string;
  position?: string;
  baseSalary: number;
  admissionDate?: Date;
  terminationDate?: Date;
  status: PayrollEmployeeStatus;
  bankCode?: string;
  bankAgency?: string;
  bankAccount?: string;
  pisPasep?: string;
  dependents?: number;
  createdAt: Date;
  updatedAt: Date;
  company?: PayrollCompany;
  department?: PayrollDepartment;
}

// Perfil de cálculo
export interface PayrollCalculationProfile {
  id: string;
  name: string;
  description?: string;
  companyId?: string;
  rules: Record<string, any>;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  company?: PayrollCompany;
}

// Código de provento/desconto/outros
export interface PayrollCode {
  id: string;
  code: string;
  type: PayrollCodeType;
  name: string;
  description?: string;
  calculationType: PayrollCalculationType;
  value: number;
  formula?: string;
  legalType?: PayrollLegalType;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Folha de pagamento
export interface PayrollSheet {
  id: string;
  companyId: string;
  departmentId?: string;
  referenceMonth: number;
  referenceYear: number;
  periodStart: Date;
  periodEnd: Date;
  status: PayrollSheetStatus;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalInss: number;
  totalIrrf: number;
  totalFgts: number;
  notes?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  company?: PayrollCompany;
  department?: PayrollDepartment;
  items?: PayrollSheetItem[];
  summaries?: PayrollEmployeeSummary[];
}

// Item da folha de pagamento
export interface PayrollSheetItem {
  id: string;
  sheetId: string;
  employeeId: string;
  codeId: string;
  quantity: number;
  referenceValue: number;
  calculatedValue: number;
  observation?: string;
  createdAt: Date;
  updatedAt: Date;
  sheet?: PayrollSheet;
  employee?: PayrollEmployee;
  code?: PayrollCode;
}

// Resumo por funcionário
export interface PayrollEmployeeSummary {
  id: string;
  sheetId: string;
  employeeId: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalOthers: number;
  inssBase: number;
  irrfBase: number;
  fgtsBase: number;
  inssValue: number;
  irrfValue: number;
  fgtsValue: number;
  grossSalary: number;
  netSalary: number;
  createdAt: Date;
  updatedAt: Date;
  sheet?: PayrollSheet;
  employee?: PayrollEmployee;
}

// Log de auditoria
export interface PayrollAuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changedBy?: string;
  changedAt: Date;
}

// Tipos para cálculos
export interface PayrollCalculationInput {
  employee: PayrollEmployee;
  items: PayrollCalculationItem[];
  profile?: PayrollCalculationProfile;
}

export interface PayrollCalculationItem {
  codeId: string;
  code: string;
  type: PayrollCodeType;
  name: string;
  calculationType: PayrollCalculationType;
  value: number;
  quantity?: number;
  referenceValue?: number;
  legalType?: PayrollLegalType;
  formula?: string;
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
  type: PayrollCodeType;
  name: string;
  quantity: number;
  referenceValue: number;
  calculatedValue: number;
  observation?: string;
}

// Tipos para relatórios
export interface PayrollReport {
  id: string;
  type: 'sheet' | 'summary' | 'legal' | 'invoice';
  title: string;
  description?: string;
  data: any;
  generatedAt: Date;
  generatedBy?: string;
}

export interface PayrollInvoice {
  id: string;
  companyId: string;
  sheetId: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  company?: PayrollCompany;
  sheet?: PayrollSheet;
}

// Tipos para filtros e consultas
export interface PayrollCompanyFilter {
  name?: string;
  cnpj?: string;
  isActive?: boolean;
}

export interface PayrollEmployeeFilter {
  companyId?: string;
  departmentId?: string;
  name?: string;
  position?: string;
  status?: PayrollEmployeeStatus;
}

export interface PayrollSheetFilter {
  companyId?: string;
  departmentId?: string;
  referenceMonth?: number;
  referenceYear?: number;
  status?: PayrollSheetStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

// Tipos para formulários
export interface PayrollCompanyForm {
  name: string;
  cnpj: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  isActive: boolean;
}

export interface PayrollEmployeeForm {
  employeeId?: string;
  companyId: string;
  departmentId?: string;
  registrationNumber?: string;
  name: string;
  cpf?: string;
  position?: string;
  baseSalary: number;
  admissionDate?: Date;
  terminationDate?: Date;
  status: PayrollEmployeeStatus;
  bankCode?: string;
  bankAgency?: string;
  bankAccount?: string;
  pisPasep?: string;
  dependents?: number;
}

export interface PayrollSheetForm {
  companyId: string;
  departmentId?: string;
  referenceMonth: number;
  referenceYear: number;
  periodStart: Date;
  periodEnd: Date;
  notes?: string;
}

// Tipos para API responses
export interface PayrollApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PayrollPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

// Tipos para dashboard
export interface PayrollDashboardStats {
  totalCompanies: number;
  totalEmployees: number;
  totalActiveSheets: number;
  totalMonthlyPayroll: number;
  recentSheets: PayrollSheet[];
  monthlyTrends: {
    month: string;
    totalPayroll: number;
    totalEmployees: number;
  }[];
}

// Tipos para workflows específicos por cliente
export interface PayrollWorkflow {
  id: string;
  companyId: string;
  workflowType: 'standard' | 'import_excel' | 'custom_calculation';
  name: string;
  description?: string;
  steps: PayrollWorkflowStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollWorkflowStep {
  id: string;
  stepOrder: number;
  stepType: 'import' | 'manual_input' | 'calculation' | 'approval' | 'export';
  name: string;
  description?: string;
  configuration: any;
  isRequired: boolean;
}

// Tipos específicos para importação de dados
export interface PayrollImportTemplate {
  id: string;
  companyId: string;
  templateName: string;
  templateVersion: string;
  fileFormat: 'xlsx' | 'csv' | 'xml';
  sheetMappings: PayrollSheetMapping[];
  validationRules: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollSheetMapping {
  sheetName: string;
  startRow: number;
  columnMappings: {
    [columnIndex: string]: {
      fieldName: string;
      dataType: 'string' | 'number' | 'date' | 'boolean';
      isRequired: boolean;
      validationRules?: any;
    };
  };
}
