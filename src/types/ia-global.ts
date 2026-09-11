/**
 * Tipos Globais para o Sistema de IA do Portal ABZ
 * Arquitetura modular para ferramentas e ações
 */

// =====================================================
// Permissões e Configurações
// =====================================================

export type IARole = 'ADMIN' | 'GERENTE' | 'USER';

export interface IAPermission {
  module: string;
  allowRead: boolean;
  allowWrite: boolean;
  writeRoles: IARole[];
}

export interface IAModuleConfig {
  key: string;
  name: string;
  description: string;
  icon?: string;
  allowRead: boolean;
  allowWrite: boolean;
  writeRoles: IARole[];
  enabled: boolean;
}

export interface IAWritePermissions {
  ferias: boolean;
  reembolso: boolean;
  suprimentos: boolean;
  avaliacao: boolean;
  chat: boolean;
  calendario: boolean;
  microsoft: {
    mail: boolean;
    calendar: boolean;
    contacts: boolean;
    users: boolean;
    groups: boolean;
    directory: boolean;
    teams: boolean;
    chat: boolean;
    calls: boolean;
    files: boolean;
    notes: boolean;
    tasks: boolean;
    security: boolean;
    audit: boolean;
    identity: boolean;
    applications: boolean;
    devices: boolean;
    compliance: boolean;
    bookings: boolean;
    notifications: boolean;
    synchronization: boolean;
    copilot: boolean;
    backup: boolean;
    network: boolean;
    management_apis: boolean;
  };
}

// =====================================================
// Ferramentas (Tools)
// =====================================================

export interface IAToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface IAToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, IAToolParameter>;
    required: string[];
  };
}

export interface IATool {
  id: string;
  name: string;
  description: string;
  module: string;
  definition: IAToolDefinition;
  requireModule?: string;
  adminOnly: boolean;
  requiresPermission?: string;
  handler: IAToolHandler;
}

export type IAToolHandler = (
  args: Record<string, unknown>,
  context: IAToolContext
) => Promise<IAToolResult>;

export interface IAToolContext {
  userId: string;
  userRole: IARole;
  userEmail?: string;
  teamMemberIds?: string[];
}

export interface IAToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresAction?: boolean;
  actionData?: IAActionData;
}

// =====================================================
// Ações Interativas
// =====================================================

export interface IAActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required: boolean;
}

export interface IAAction {
  id: string;
  name: string;
  label: string;
  description: string;
  module: string;
  icon?: string;
  requiresPermission: string;
  requiresRole: IARole[];
  parameters: IAActionParameter[];
  execute: IAActionExecutor;
  confirmBeforeExecute: boolean;
  requiresTargetVerification: boolean;
}

export type IAActionExecutor = (
  params: Record<string, unknown>,
  context: IAActionContext
) => Promise<IAActionResult>;

export interface IAActionContext {
  userId: string;
  userRole: IARole;
  userEmail: string;
  teamMemberIds?: string[];
  targetUserId?: string;
  targetUserRole?: IARole;
}

export interface IAActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  notification?: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  };
  requiresRefresh?: boolean;
  redirectUrl?: string;
}

export interface IAActionData {
  actionId: string;
  actionName: string;
  module: string;
  title: string;
  data: Record<string, unknown>;
  actions: IAActionButton[];
  permissions: {
    canExecute: boolean;
    reason?: string;
  };
}

export interface IAActionButton {
  id: string;
  label: string;
  action: string;
  params: Record<string, unknown>;
  variant: 'primary' | 'secondary' | 'danger';
  icon?: string;
}

// =====================================================
// Respostas Interativas para o Frontend
// =====================================================

export type IAResponseType = 
  | 'text' 
  | 'table' 
  | 'card' 
  | 'interactive_card' 
  | 'list' 
  | 'chart'
  | 'error';

export interface IATextResponse {
  type: 'text';
  content: string;
}

export interface IATableResponse {
  type: 'table';
  headers: string[];
  rows: Record<string, unknown>[];
  title?: string;
}

export interface IACardResponse {
  type: 'card';
  title: string;
  subtitle?: string;
  fields: Record<string, unknown>;
  imageUrl?: string;
  actions?: IAActionButton[];
}

export interface IAInteractiveCardResponse {
  type: 'interactive_card';
  module: string;
  title: string;
  subtitle?: string;
  data: Record<string, unknown>;
  fields: Record<string, unknown>;
  actions: IAActionButton[];
  permissions: {
    canExecute: boolean;
    reason?: string;
  };
}

export interface IAListResponse {
  type: 'list';
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    icon?: string;
    actions?: IAActionButton[];
  }>;
  pagination?: {
    page: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface IAErrorResponse {
  type: 'error';
  title: string;
  message: string;
  code?: string;
}

export type IAResponse = 
  | IATextResponse 
  | IATableResponse 
  | IACardResponse 
  | IAInteractiveCardResponse 
  | IAListResponse 
  | IAErrorResponse;

// =====================================================
// Microsoft Graph Types
// =====================================================

export interface MSGraphConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

export interface MSGraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  manager?: MSGraphUser;
}

export interface MSGraphEmail {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  sentDateTime?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  bodyPreview?: string;
  body?: string;
  bodyType?: string;
  isRead: boolean;
  isDraft?: boolean;
  hasAttachments: boolean;
  importance?: string;
  categories?: string[];
  flag?: { flagStatus?: string };
  parentFolderId?: string;
  webLink?: string;
  inferenceClassification?: string;
  toRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
  ccRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
  bccRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
  replyTo?: Array<{ emailAddress: { name?: string; address: string } }>;
}

export interface MSGraphCalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  isAllDay: boolean;
  bodyPreview?: string;
}

export interface MSGraphChat {
  id: string;
  topic?: string;
  lastMessagePreview?: string;
  chatType?: string;
  lastUpdatedDateTime?: string;
  members: Array<{
    displayName: string;
    email: string;
  }>;
}

export interface MSGraphTeamsMessage {
  id: string;
  body: {
    contentType: string;
    content: string;
  };
  from: {
    displayName: string;
    email: string;
  };
  createdDateTime: string;
}

// =====================================================
// Banco de Dados
// =====================================================

export interface IAModulePermission {
  id: string;
  module_key: string;
  allow_read: boolean;
  allow_write: boolean;
  write_roles: IARole[];
  created_at: string;
  updated_at: string;
}

export interface IAGlobalConfig {
  id: string;
  config_key: string;
  config_value: Record<string, unknown>;
  description?: string;
  created_at: string;
  updated_at: string;
}