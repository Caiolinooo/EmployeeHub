/**
 * Tipos TypeScript para o sistema de IA Agent
 * Portal ABZ - Chat IA, Dashboard Inteligente, Config Admin
 */

// =====================================================
// Tipos de banco de dados
// =====================================================

export type IAProviderType = 'gemini' | 'openai' | 'lmstudio' | 'llamacpp' | 'custom';

export interface IAConfigProviderSetting {
  endpoint: string;
  api_key: string;
  model_default: string;
}

export interface IAConfig {
  id: string;
  endpoint: string;
  api_key: string;
  model_default: string;
  max_tokens: number;
  temperatura: number;
  system_prompt: string;
  ativo: boolean;
  provider: IAProviderType;
  provider_settings: Partial<Record<IAProviderType, IAConfigProviderSetting>>;
  created_at: string;
  updated_at: string;
}

/** Config sem dados sensíveis (para retorno em API não-admin) */
export type IAConfigPublic = Omit<IAConfig, 'api_key' | 'provider_settings'> & {
  api_key?: never;
  provider_settings: Partial<Record<IAProviderType, Omit<IAConfigProviderSetting, 'api_key'>>>;
};

export interface IAChatSession {
  id: string;
  user_id: string;
  session_title: string;
  model_used: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type IAMessageRole = 'user' | 'assistant' | 'system';

export interface IAChatMessage {
  id: string;
  session_id: string;
  role: IAMessageRole;
  content: string;
  tokens_used: number | null;
  response_time_ms: number | null;
  status?: string; // Status profissional da IA
  metadata: {
    dashboard?: IADashboardLayout;
    [key: string]: unknown;
  };
  created_at: string;
}

// =====================================================
// Tipos de Dashboard Generativo (AI-Driven)
// =====================================================

export type IADashboardWidgetType = 'metric' | 'table' | 'chart' | 'list' | 'markdown';

export interface IADashboardWidget {
  id: string;
  type: IADashboardWidgetType;
  title: string;
  data: any;
  config?: Record<string, any>;
}

export interface IADashboardLayout {
  id: string;
  widgets: IADashboardWidget[];
  columns?: number;
}

export interface IADashboardCache {
  id: string;
  user_id: string;
  dashboard_type: IADashboardType;
  data: Record<string, unknown>;
  generated_at: string;
  expires_at: string | null;
}

// =====================================================
// Tipos de domínio
// =====================================================

export type IADashboardType = 'summary' | 'kpi' | 'pendencies' | 'dept';
export type IAUserRole = 'ADMIN' | 'GERENTE' | 'USER';

// =====================================================
// Tipos de Request/Response das APIs
// =====================================================

/** POST /api/ia/chat */
export interface IAChatRequest {
  session_id: string;
  message: string;
}

export interface IAChatResponse {
  message: IAChatMessage;
  session: IAChatSession;
}

/** POST /api/ia/sessions */
export interface IACreateSessionRequest {
  title?: string;
}

export interface IACreateSessionResponse {
  session: IAChatSession;
}

/** GET /api/ia/sessions */
export interface IAListSessionsResponse {
  sessions: IAChatSession[];
}

/** GET /api/ia/models */
export interface IAModel {
  id: string;
  object: string;
  owned_by: string;
}

export interface IAListModelsResponse {
  models: IAModel[];
}

/** GET /api/ia/config (público: sem api_key) */
export interface IAConfigResponse {
  config: IAConfigPublic | IAConfig;
}

/** PUT /api/ia/config (admin) */
export interface IAUpdateConfigRequest {
  endpoint?: string;
  api_key?: string;
  model_default?: string;
  provider?: 'lmstudio' | 'llamacpp';
  provider_settings?: IAConfig['provider_settings'];
  max_tokens?: number;
  temperatura?: number;
  system_prompt?: string;
  ativo?: boolean;
}

/** GET /api/ia/dashboard */
export interface IADashboardKPI {
  label: string;
  value: string | number;
  target?: number;
  trend?: 'up' | 'down' | 'stable';
  change?: number;
  icon?: string;
  unit?: string;
}

export interface IADashboardPendency {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
  module: string;
}

export interface IADashboardSummary {
  greeting: string;
  highlights: string[];
  quickStats: IADashboardKPI[];
}

export interface IADashboardData {
  summary: IADashboardSummary;
  kpis: IADashboardKPI[];
  pendencies: IADashboardPendency[];
  generatedAt: string;
}

export interface IADashboardResponse {
  data: IADashboardData;
  cached: boolean;
}

// =====================================================
// Tipos internos do cliente LLM
// =====================================================

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
}

export interface LLMCompletionRequest {
  model: string;
  messages: LLMMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  stop?: string[];
}

export interface LLMCompletionChoice {
  index: number;
  message: {
    role: LLMMessage['role'] | string;
    content: string;
    tool_calls?: LLMToolCall[];
    metadata?: {
      dashboard?: IADashboardLayout;
      [key: string]: unknown;
    };
  };
  finish_reason: string;
}

export interface LLMCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: LLMCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMStreamDelta {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

// =====================================================
// Tipos de contexto do usuário
// =====================================================

export interface IAUserContext {
  userId: string;
  userName: string;
  role: IAUserRole;
  department: string;
  position: string;
  /** Dados do perfil relevantes */
  profile: {
    email: string | null;
    phone: string | null;
  };
  /** Dados de avaliações recentes */
  evaluations?: {
    count: number;
    avgScore: number | null;
    lastPeriod: string | null;
  };
  /** Dados de férias */
  vacations?: {
    pending: number;
    upcoming: Array<{ start: string; end: string; status: string }>;
  };
  /** Dados de reembolsos */
  reimbursements?: {
    pending: number;
    totalApproved: number;
  };
  /** E-mails recentes do Exchange */
  recentEmails?: Array<{
    subject: string;
    from: string;
    date: string;
  }>;
  /** IDs dos subordinados (se GERENTE) */
  teamMemberIds?: string[];
  /** Ferramentas disponíveis para o usuário (baseadas em RBAC e Módulos) */
  availableTools?: Array<{name: string; description: string}>;
  /** Feedbacks pendentes (apenas para administradores) */
  feedbacks?: {
    pending: number;
  };
}
