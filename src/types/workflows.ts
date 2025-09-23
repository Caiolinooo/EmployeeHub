// Tipos para Sistema de Workflows Automatizados

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  category: string;
  version: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
  settings: WorkflowSettings;
  permissions: WorkflowPermissions;
  statistics: WorkflowStatistics;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
  tags: string[];
  isTemplate: boolean;
  templateId?: string;
}

export interface WorkflowTrigger {
  id: string;
  type: 'manual' | 'schedule' | 'webhook' | 'event' | 'email' | 'file' | 'database' | 'api';
  name: string;
  config: TriggerConfig;
  conditions?: TriggerCondition[];
  isActive: boolean;
}

export interface TriggerConfig {
  // Schedule trigger
  cronExpression?: string;
  timezone?: string;
  
  // Webhook trigger
  webhookUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: { [key: string]: string };
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'apikey';
    credentials?: { [key: string]: string };
  };
  
  // Event trigger
  eventType?: string;
  eventSource?: string;
  
  // Email trigger
  emailAddress?: string;
  emailSubjectPattern?: string;
  emailBodyPattern?: string;
  
  // File trigger
  filePath?: string;
  filePattern?: string;
  watchType?: 'created' | 'modified' | 'deleted';
  
  // Database trigger
  tableName?: string;
  operation?: 'insert' | 'update' | 'delete';
  
  // API trigger
  apiEndpoint?: string;
  apiMethod?: string;
  apiHeaders?: { [key: string]: string };
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'regex';
  value: any;
  logic?: 'and' | 'or';
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'loop' | 'parallel' | 'delay' | 'approval' | 'notification' | 'integration';
  position: { x: number; y: number };
  config: StepConfig;
  connections: StepConnection[];
  isActive: boolean;
  timeout?: number; // em segundos
  retryConfig?: RetryConfig;
  errorHandling?: ErrorHandling;
}

export interface StepConfig {
  // Action step
  actionType?: 'email' | 'sms' | 'webhook' | 'database' | 'file' | 'api' | 'script' | 'notification';
  actionConfig?: ActionConfig;
  
  // Condition step
  conditions?: StepCondition[];
  
  // Loop step
  loopType?: 'for' | 'while' | 'foreach';
  loopConfig?: LoopConfig;
  
  // Parallel step
  parallelBranches?: string[];
  
  // Delay step
  delayDuration?: number; // em segundos
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  
  // Approval step
  approvers?: string[];
  approvalType?: 'any' | 'all' | 'majority';
  approvalTimeout?: number;
  
  // Notification step
  notificationType?: 'email' | 'sms' | 'push' | 'slack' | 'teams';
  recipients?: string[];
  template?: string;
  
  // Integration step
  integrationType?: 'erp' | 'crm' | 'api' | 'database' | 'file';
  integrationConfig?: IntegrationConfig;
}

export interface ActionConfig {
  // Email action
  emailTo?: string[];
  emailCc?: string[];
  emailBcc?: string[];
  emailSubject?: string;
  emailBody?: string;
  emailTemplate?: string;
  emailAttachments?: string[];
  
  // SMS action
  smsTo?: string[];
  smsMessage?: string;
  smsTemplate?: string;
  
  // Webhook action
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  webhookHeaders?: { [key: string]: string };
  webhookBody?: any;
  
  // Database action
  databaseOperation?: 'select' | 'insert' | 'update' | 'delete';
  databaseTable?: string;
  databaseQuery?: string;
  databaseData?: any;
  
  // File action
  fileOperation?: 'read' | 'write' | 'copy' | 'move' | 'delete';
  filePath?: string;
  fileContent?: string;
  fileDestination?: string;
  
  // API action
  apiUrl?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  apiHeaders?: { [key: string]: string };
  apiBody?: any;
  
  // Script action
  scriptLanguage?: 'javascript' | 'python' | 'bash';
  scriptCode?: string;
  scriptTimeout?: number;
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'regex' | 'exists' | 'not_exists';
  value: any;
  logic?: 'and' | 'or';
}

export interface LoopConfig {
  // For loop
  startValue?: number;
  endValue?: number;
  stepValue?: number;
  
  // While loop
  whileCondition?: StepCondition[];
  
  // Foreach loop
  iterableSource?: string;
  iteratorVariable?: string;
}

export interface IntegrationConfig {
  connectionId?: string;
  operation?: string;
  parameters?: { [key: string]: any };
  mapping?: FieldMapping[];
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: string;
  defaultValue?: any;
}

export interface StepConnection {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  condition?: 'success' | 'error' | 'timeout' | 'custom';
  customCondition?: StepCondition[];
  label?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  retryDelay: number; // em segundos
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  retryConditions: string[]; // tipos de erro que devem ser retentados
}

export interface ErrorHandling {
  strategy: 'stop' | 'continue' | 'retry' | 'fallback';
  fallbackStepId?: string;
  notifyOnError: boolean;
  errorNotificationRecipients?: string[];
  logErrors: boolean;
}

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  value?: any;
  defaultValue?: any;
  isRequired: boolean;
  isSecret: boolean;
  description?: string;
  validation?: VariableValidation;
}

export interface VariableValidation {
  pattern?: string; // regex
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  allowedValues?: any[];
}

export interface WorkflowSettings {
  maxExecutionTime: number; // em segundos
  maxConcurrentExecutions: number;
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableNotifications: boolean;
  notificationRecipients: string[];
  enableMetrics: boolean;
  autoCleanupLogs: boolean;
  logRetentionDays: number;
}

export interface WorkflowPermissions {
  owner: string;
  viewers: string[];
  editors: string[];
  executors: string[];
  roles: {
    [role: string]: 'view' | 'edit' | 'execute' | 'admin';
  };
  departments: {
    [department: string]: 'view' | 'edit' | 'execute' | 'admin';
  };
  isPublic: boolean;
}

export interface WorkflowStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: number;
  lastExecutionStatus?: 'success' | 'failed' | 'timeout' | 'cancelled';
  lastExecutionError?: string;
  executionHistory: ExecutionSummary[];
}

export interface ExecutionSummary {
  id: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
  duration?: number;
  stepsExecuted: number;
  stepsTotal: number;
  errorMessage?: string;
  triggeredBy: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | 'paused';
  startTime: string;
  endTime?: string;
  duration?: number;
  triggeredBy: string;
  triggerData?: any;
  variables: { [key: string]: any };
  steps: StepExecution[];
  logs: ExecutionLog[];
  metrics: ExecutionMetrics;
  parentExecutionId?: string; // para sub-workflows
  childExecutions?: string[]; // IDs de sub-workflows
}

export interface StepExecution {
  id: string;
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';
  startTime?: string;
  endTime?: string;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  retryCount: number;
  logs: string[];
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  stepId?: string;
  stepName?: string;
  data?: any;
  userId?: string;
}

export interface ExecutionMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkRequests: number;
  databaseQueries: number;
  fileOperations: number;
  apiCalls: number;
  emailsSent: number;
  notificationsSent: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  industry: string[];
  tags: string[];
  thumbnail: string;
  workflow: Omit<Workflow, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;
  rating: number;
  downloads: number;
  createdBy: string;
  createdAt: string;
  isOfficial: boolean;
  isPremium: boolean;
  documentation?: string;
  examples?: WorkflowExample[];
}

export interface WorkflowExample {
  name: string;
  description: string;
  variables: { [key: string]: any };
  expectedOutput?: any;
}

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  variables?: { [key: string]: any };
  lastRun?: string;
  nextRun: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowWebhook {
  id: string;
  workflowId: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: { [key: string]: string };
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'apikey';
    credentials?: { [key: string]: string };
  };
  isActive: boolean;
  lastTriggered?: string;
  triggerCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowAlert {
  id: string;
  workflowId: string;
  name: string;
  condition: AlertCondition;
  actions: AlertAction[];
  isActive: boolean;
  lastTriggered?: string;
  triggerCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertCondition {
  type: 'execution_failed' | 'execution_timeout' | 'execution_duration' | 'step_failed' | 'custom';
  threshold?: number;
  timeWindow?: number; // em minutos
  customCondition?: StepCondition[];
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'notification' | 'slack' | 'teams';
  target: string;
  template?: string;
  parameters?: { [key: string]: any };
}

export interface WorkflowApiResponse<T = any> {
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
  metadata?: {
    executionTime: number;
    version: string;
  };
}

export interface WorkflowBuilder {
  workflow: Workflow;
  selectedStep?: WorkflowStep;
  draggedStep?: WorkflowStep;
  zoom: number;
  pan: { x: number; y: number };
  mode: 'design' | 'test' | 'debug';
  showGrid: boolean;
  showMinimap: boolean;
  autoSave: boolean;
  validationErrors: ValidationError[];
}

export interface ValidationError {
  id: string;
  type: 'error' | 'warning';
  message: string;
  stepId?: string;
  field?: string;
}
