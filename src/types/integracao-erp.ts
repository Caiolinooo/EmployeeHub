// Tipos para Integração com Sistemas ERP

export interface ERPConnection {
  id: string;
  name: string;
  type: 'sap' | 'oracle' | 'totvs' | 'senior' | 'microsiga' | 'custom';
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  host: string;
  port?: number;
  database?: string;
  username: string;
  password?: string; // Criptografado
  apiKey?: string;
  apiSecret?: string;
  connectionString?: string;
  lastSync: string;
  lastError?: string;
  syncFrequency: number; // em minutos
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  config: ERPConfig;
}

export interface ERPConfig {
  modules: {
    funcionarios: boolean;
    folhaPagamento: boolean;
    contabilidade: boolean;
    compras: boolean;
    vendas: boolean;
    estoque: boolean;
    financeiro: boolean;
  };
  mappings: {
    funcionarios: FieldMapping[];
    folhaPagamento: FieldMapping[];
    departamentos: FieldMapping[];
    centrosCusto: FieldMapping[];
  };
  filters: {
    funcionarios?: ERPFilter[];
    folhaPagamento?: ERPFilter[];
  };
  transformations: {
    dateFormat: string;
    currencyFormat: string;
    encoding: string;
    timezone: string;
  };
  authentication: {
    type: 'basic' | 'oauth' | 'apikey' | 'certificate';
    refreshToken?: string;
    tokenExpiry?: string;
    certificatePath?: string;
  };
}

export interface FieldMapping {
  localField: string;
  erpField: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'decimal';
  required: boolean;
  defaultValue?: any;
  transformation?: string; // Função de transformação
  validation?: string; // Regex de validação
}

export interface ERPFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between';
  value: any;
  condition?: 'AND' | 'OR';
}

export interface ERPSyncJob {
  id: string;
  connectionId: string;
  module: string;
  type: 'import' | 'export' | 'bidirectional';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: string;
  completedAt?: string;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: ERPSyncError[];
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // em segundos
  createdBy: string;
  scheduledAt?: string;
  isScheduled: boolean;
  config: SyncJobConfig;
}

export interface SyncJobConfig {
  batchSize: number;
  timeout: number; // em segundos
  retryAttempts: number;
  retryDelay: number; // em segundos
  skipErrors: boolean;
  validateData: boolean;
  backupBeforeSync: boolean;
  notifyOnCompletion: boolean;
  notifyOnError: boolean;
  emailRecipients: string[];
}

export interface ERPSyncError {
  id: string;
  recordId?: string;
  field?: string;
  errorType: 'validation' | 'transformation' | 'connection' | 'permission' | 'data';
  message: string;
  details?: any;
  timestamp: string;
  resolved: boolean;
  resolution?: string;
}

export interface ERPEmployee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  cpf: string;
  department: string;
  position: string;
  admissionDate: string;
  salary: number;
  status: 'active' | 'inactive' | 'terminated';
  costCenter: string;
  manager?: string;
  phone?: string;
  address?: ERPAddress;
  bankAccount?: ERPBankAccount;
  lastUpdated: string;
  erpData: { [key: string]: any }; // Dados originais do ERP
}

export interface ERPAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ERPBankAccount {
  bank: string;
  agency: string;
  account: string;
  accountType: 'checking' | 'savings';
  pixKey?: string;
}

export interface ERPPayroll {
  id: string;
  employeeId: string;
  employeeCode: string;
  referenceMonth: string;
  referenceYear: number;
  grossSalary: number;
  netSalary: number;
  deductions: ERPPayrollItem[];
  earnings: ERPPayrollItem[];
  taxes: ERPPayrollItem[];
  benefits: ERPPayrollItem[];
  totalDeductions: number;
  totalEarnings: number;
  totalTaxes: number;
  totalBenefits: number;
  paymentDate: string;
  status: 'draft' | 'calculated' | 'approved' | 'paid';
  lastUpdated: string;
  erpData: { [key: string]: any };
}

export interface ERPPayrollItem {
  code: string;
  description: string;
  type: 'earning' | 'deduction' | 'tax' | 'benefit';
  value: number;
  quantity?: number;
  rate?: number;
  basis?: number;
  isRecurring: boolean;
}

export interface ERPDepartment {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  managerId?: string;
  costCenter: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  erpData: { [key: string]: any };
}

export interface ERPCostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  type: 'revenue' | 'cost' | 'profit';
  budget?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  erpData: { [key: string]: any };
}

export interface ERPIntegrationLog {
  id: string;
  connectionId: string;
  jobId?: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  details?: any;
  timestamp: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ERPWebhook {
  id: string;
  connectionId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  headers?: { [key: string]: string };
  retryAttempts: number;
  retryDelay: number;
  lastTriggered?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ERPApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  requestId: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ERPConnectionTest {
  connectionId: string;
  status: 'testing' | 'success' | 'failed';
  message: string;
  details?: {
    responseTime: number;
    version?: string;
    modules?: string[];
    permissions?: string[];
  };
  timestamp: string;
}

export interface ERPSyncSchedule {
  id: string;
  connectionId: string;
  name: string;
  module: string;
  type: 'import' | 'export' | 'bidirectional';
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  lastRun?: string;
  nextRun: string;
  config: SyncJobConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ERPDataValidation {
  field: string;
  rules: ValidationRule[];
  message: string;
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'range' | 'custom';
  value?: any;
  customFunction?: string;
}

export interface ERPTransformation {
  field: string;
  type: 'format' | 'calculate' | 'lookup' | 'custom';
  config: {
    format?: string;
    calculation?: string;
    lookupTable?: string;
    customFunction?: string;
  };
}

export interface ERPMetrics {
  connectionId: string;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  lastSyncDuration: number;
  totalRecordsProcessed: number;
  errorRate: number;
  uptime: number;
  dataFreshness: number; // em minutos
  performanceScore: number; // 0-100
}

export interface ERPAlert {
  id: string;
  connectionId: string;
  type: 'connection_lost' | 'sync_failed' | 'data_inconsistency' | 'performance_degraded' | 'quota_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  details?: any;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  notificationsSent: string[];
}

export interface ERPBackup {
  id: string;
  connectionId: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'creating' | 'completed' | 'failed';
  size: number; // em bytes
  recordCount: number;
  filePath: string;
  checksum: string;
  createdAt: string;
  expiresAt: string;
  description?: string;
}

export interface ERPAuditLog {
  id: string;
  connectionId: string;
  action: 'create' | 'update' | 'delete' | 'sync' | 'export' | 'import';
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
}
