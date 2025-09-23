// Tipos para API Mobile

export interface MobileAuthRequest {
  email: string;
  password: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'ios' | 'android';
  pushToken?: string;
  biometricEnabled?: boolean;
}

export interface MobileAuthResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: MobileUser;
  permissions: string[];
  settings: MobileAppSettings;
  syncData?: SyncData;
}

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  lastName: string;
  phone: string;
  role: string;
  department: string;
  position: string;
  avatar?: string;
  isActive: boolean;
  lastLogin: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: 'pt-BR' | 'en-US' | 'es-ES';
  notifications: NotificationSettings;
  theme: 'light' | 'dark' | 'auto';
  biometricAuth: boolean;
  offlineMode: boolean;
  syncFrequency: number; // em minutos
}

export interface NotificationSettings {
  push: boolean;
  email: boolean;
  avaliacoes: boolean;
  reembolsos: boolean;
  noticias: boolean;
  eventos: boolean;
  lembretes: boolean;
  sound: boolean;
  vibration: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
  };
}

export interface MobileAppSettings {
  version: string;
  minVersion: string;
  forceUpdate: boolean;
  maintenanceMode: boolean;
  features: {
    avaliacoes: boolean;
    reembolsos: boolean;
    noticias: boolean;
    calendario: boolean;
    perfil: boolean;
    offline: boolean;
    biometric: boolean;
  };
  endpoints: {
    base: string;
    websocket: string;
    upload: string;
  };
  limits: {
    maxFileSize: number;
    maxFilesPerUpload: number;
    offlineDataDays: number;
  };
}

export interface SyncData {
  lastSync: string;
  version: number;
  data: {
    avaliacoes: MobileAvaliacao[];
    reembolsos: MobileReembolso[];
    noticias: MobileNoticia[];
    eventos: MobileEvento[];
    notificacoes: MobileNotificacao[];
  };
  deletedIds: {
    avaliacoes: string[];
    reembolsos: string[];
    noticias: string[];
    eventos: string[];
  };
}

export interface MobileAvaliacao {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  dataInicio: string;
  dataFim: string;
  avaliadorId: string;
  avaliadorNome: string;
  funcionarioId: string;
  funcionarioNome: string;
  criterios: CriterioAvaliacao[];
  pontuacaoTotal?: number;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
  offline?: boolean;
  syncStatus?: 'pending' | 'synced' | 'error';
}

export interface CriterioAvaliacao {
  id: string;
  nome: string;
  descricao: string;
  peso: number;
  pontuacao?: number;
  observacoes?: string;
}

export interface MobileReembolso {
  id: string;
  titulo: string;
  descricao: string;
  valor: number;
  categoria: string;
  status: 'pendente' | 'aprovado' | 'reprovado' | 'pago';
  dataGasto: string;
  comprovantes: string[];
  aprovadorId?: string;
  aprovadorNome?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
  offline?: boolean;
  syncStatus?: 'pending' | 'synced' | 'error';
}

export interface MobileNoticia {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  imagem?: string;
  categoria: string;
  autor: string;
  dataPublicacao: string;
  visualizada: boolean;
  curtida: boolean;
  comentarios: number;
  tags: string[];
}

export interface MobileEvento {
  id: string;
  titulo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  local: string;
  tipo: string;
  participantes: string[];
  confirmado: boolean;
  lembretes: EventoLembrete[];
}

export interface EventoLembrete {
  id: string;
  tempo: number; // minutos antes do evento
  enviado: boolean;
}

export interface MobileNotificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  categoria: string;
  lida: boolean;
  acao?: NotificacaoAcao;
  dataEnvio: string;
  dataLeitura?: string;
}

export interface NotificacaoAcao {
  tipo: 'navigate' | 'url' | 'action';
  destino: string;
  parametros?: { [key: string]: any };
}

export interface MobileSyncRequest {
  lastSync?: string;
  version?: number;
  deviceId: string;
  changes?: {
    avaliacoes?: MobileAvaliacao[];
    reembolsos?: MobileReembolso[];
    configuracoes?: UserPreferences;
  };
}

export interface MobileSyncResponse {
  success: boolean;
  data: SyncData;
  conflicts?: SyncConflict[];
  errors?: SyncError[];
}

export interface SyncConflict {
  id: string;
  type: 'avaliacao' | 'reembolso';
  localVersion: any;
  serverVersion: any;
  resolution: 'server' | 'local' | 'merge';
}

export interface SyncError {
  id: string;
  type: string;
  message: string;
  retryable: boolean;
}

export interface MobilePushNotification {
  to: string | string[];
  title: string;
  body: string;
  data?: { [key: string]: any };
  badge?: number;
  sound?: string;
  category?: string;
  priority?: 'high' | 'normal';
  ttl?: number;
}

export interface DeviceInfo {
  id: string;
  userId: string;
  name: string;
  type: 'ios' | 'android';
  version: string;
  appVersion: string;
  pushToken?: string;
  isActive: boolean;
  lastSeen: string;
  registeredAt: string;
}

export interface MobileApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  version: number;
}

export interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'avaliacao' | 'reembolso' | 'configuracao';
  entityId: string;
  data: any;
  timestamp: string;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface MobileUploadRequest {
  file: File | Blob;
  type: 'avatar' | 'comprovante' | 'documento';
  entityId?: string;
  metadata?: {
    originalName: string;
    mimeType: string;
    size: number;
  };
}

export interface MobileUploadResponse {
  success: boolean;
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  metadata: {
    size: number;
    mimeType: string;
    uploadedAt: string;
  };
}

export interface MobileAnalytics {
  userId: string;
  deviceId: string;
  event: string;
  properties?: { [key: string]: any };
  timestamp: string;
  sessionId: string;
}

export interface MobileHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    database: 'up' | 'down';
    storage: 'up' | 'down';
    notifications: 'up' | 'down';
    websocket: 'up' | 'down';
  };
  metrics: {
    responseTime: number;
    activeUsers: number;
    errorRate: number;
  };
}

// Tipos para WebSocket
export interface WebSocketMessage {
  type: 'notification' | 'sync' | 'update' | 'ping' | 'pong';
  data?: any;
  timestamp: string;
  id: string;
}

export interface WebSocketAuth {
  token: string;
  deviceId: string;
}

// Tipos para configuração de endpoints
export interface MobileEndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  auth: boolean;
  rateLimit?: {
    requests: number;
    window: number; // em segundos
  };
  cache?: {
    ttl: number; // em segundos
    key?: string;
  };
  offline?: boolean;
  validation?: any; // Schema de validação
}

// Tipos para cache mobile
export interface MobileCacheEntry {
  key: string;
  data: any;
  timestamp: string;
  ttl: number;
  version: number;
}

export interface MobileCacheConfig {
  maxSize: number; // em MB
  defaultTtl: number; // em segundos
  cleanupInterval: number; // em segundos
  strategies: {
    avaliacoes: 'cache-first' | 'network-first' | 'cache-only';
    reembolsos: 'cache-first' | 'network-first' | 'cache-only';
    noticias: 'cache-first' | 'network-first' | 'cache-only';
  };
}

// Tipos para métricas e monitoramento
export interface MobileMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  deviceId?: string;
  timestamp: string;
  userAgent?: string;
  error?: string;
}

export interface MobileErrorReport {
  id: string;
  userId: string;
  deviceId: string;
  appVersion: string;
  error: {
    message: string;
    stack?: string;
    type: string;
  };
  context: {
    screen: string;
    action: string;
    timestamp: string;
  };
  device: {
    platform: string;
    version: string;
    model?: string;
  };
}
