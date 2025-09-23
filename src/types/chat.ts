// Tipos para Sistema de Chat Interno em Tempo Real

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'direct' | 'department' | 'project';
  avatar?: string;
  isArchived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  memberCount: number;
  unreadCount: number;
  settings: ChannelSettings;
  permissions: ChannelPermissions;
  metadata: ChannelMetadata;
}

export interface ChannelSettings {
  allowFileUploads: boolean;
  allowVoiceMessages: boolean;
  allowVideoMessages: boolean;
  allowScreenShare: boolean;
  allowReactions: boolean;
  allowThreads: boolean;
  allowMentions: boolean;
  allowBots: boolean;
  messageRetentionDays: number;
  maxFileSize: number; // em MB
  allowedFileTypes: string[];
  moderationEnabled: boolean;
  autoDeleteMessages: boolean;
  requireApproval: boolean;
  slowMode: number; // segundos entre mensagens
}

export interface ChannelPermissions {
  owner: string;
  admins: string[];
  moderators: string[];
  members: string[];
  viewers: string[];
  blocked: string[];
  roles: {
    [role: string]: 'owner' | 'admin' | 'moderator' | 'member' | 'viewer';
  };
  departments: {
    [department: string]: 'admin' | 'moderator' | 'member' | 'viewer';
  };
  isPublic: boolean;
  allowInvites: boolean;
  requireApproval: boolean;
}

export interface ChannelMetadata {
  department?: string;
  project?: string;
  tags: string[];
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'active' | 'inactive' | 'archived';
  externalIntegrations: ExternalIntegration[];
  customFields: { [key: string]: any };
}

export interface ExternalIntegration {
  id: string;
  type: 'webhook' | 'bot' | 'api' | 'email' | 'slack' | 'teams' | 'discord';
  name: string;
  config: { [key: string]: any };
  isActive: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  threadId?: string;
  parentMessageId?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: MessageContent;
  type: 'text' | 'file' | 'image' | 'video' | 'audio' | 'system' | 'bot' | 'poll' | 'event';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'deleted' | 'edited';
  timestamp: string;
  editedAt?: string;
  deletedAt?: string;
  reactions: MessageReaction[];
  mentions: MessageMention[];
  attachments: MessageAttachment[];
  metadata: MessageMetadata;
  isSystem: boolean;
  isPinned: boolean;
  isImportant: boolean;
  replyCount: number;
  readBy: MessageRead[];
}

export interface MessageContent {
  text?: string;
  html?: string;
  markdown?: string;
  formatted?: FormattedContent[];
  poll?: PollContent;
  event?: EventContent;
  system?: SystemContent;
}

export interface FormattedContent {
  type: 'text' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'link' | 'mention' | 'emoji' | 'channel';
  content: string;
  attributes?: { [key: string]: any };
}

export interface PollContent {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  allowAddOptions: boolean;
  expiresAt?: string;
  isAnonymous: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // user IDs
  createdBy?: string;
}

export interface EventContent {
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  location?: string;
  attendees: string[];
  isAllDay: boolean;
  recurrence?: EventRecurrence;
}

export interface EventRecurrence {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: string;
  count?: number;
}

export interface SystemContent {
  type: 'user_joined' | 'user_left' | 'channel_created' | 'channel_updated' | 'message_pinned' | 'file_uploaded' | 'integration_added';
  data: { [key: string]: any };
}

export interface MessageReaction {
  id: string;
  emoji: string;
  users: string[];
  count: number;
  createdAt: string;
}

export interface MessageMention {
  id: string;
  type: 'user' | 'channel' | 'role' | 'everyone' | 'here';
  targetId: string;
  targetName: string;
  startIndex: number;
  endIndex: number;
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
  url: string;
  thumbnailUrl?: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number; // para vídeos/áudios em segundos
  uploadedAt: string;
  metadata: AttachmentMetadata;
}

export interface AttachmentMetadata {
  originalName: string;
  uploadedBy: string;
  isPublic: boolean;
  expiresAt?: string;
  downloadCount: number;
  virusScanStatus: 'pending' | 'clean' | 'infected' | 'error';
  compressionApplied: boolean;
  customFields: { [key: string]: any };
}

export interface MessageMetadata {
  editHistory: EditHistory[];
  deliveryStatus: DeliveryStatus[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
  customFields: { [key: string]: any };
  aiGenerated: boolean;
  translatedFrom?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  language?: string;
}

export interface EditHistory {
  editedAt: string;
  editedBy: string;
  previousContent: MessageContent;
  reason?: string;
}

export interface DeliveryStatus {
  userId: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

export interface MessageRead {
  userId: string;
  userName: string;
  readAt: string;
}

export interface ChatThread {
  id: string;
  channelId: string;
  parentMessageId: string;
  title?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  messageCount: number;
  participantCount: number;
  participants: string[];
  isArchived: boolean;
  isLocked: boolean;
}

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline' | 'invisible';
  statusMessage?: string;
  lastSeen: string;
  timezone: string;
  preferences: UserPreferences;
  permissions: UserPermissions;
  statistics: UserStatistics;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  accessibility: AccessibilityPreferences;
  customSettings: { [key: string]: any };
}

export interface NotificationPreferences {
  desktop: boolean;
  mobile: boolean;
  email: boolean;
  sound: boolean;
  mentions: boolean;
  directMessages: boolean;
  channelMessages: boolean;
  keywords: string[];
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  frequency: 'immediate' | 'batched' | 'daily' | 'weekly';
}

export interface PrivacyPreferences {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowDirectMessages: 'everyone' | 'contacts' | 'nobody';
  allowMentions: 'everyone' | 'contacts' | 'nobody';
  showReadReceipts: boolean;
  showTypingIndicator: boolean;
  allowFileSharing: boolean;
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
}

export interface AccessibilityPreferences {
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  highContrast: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  colorBlindSupport: boolean;
}

export interface UserPermissions {
  canCreateChannels: boolean;
  canDeleteMessages: boolean;
  canEditMessages: boolean;
  canPinMessages: boolean;
  canManageUsers: boolean;
  canManageChannels: boolean;
  canUploadFiles: boolean;
  canUseVoice: boolean;
  canUseVideo: boolean;
  canShareScreen: boolean;
  canCreatePolls: boolean;
  canCreateEvents: boolean;
  canUseBots: boolean;
  canManageIntegrations: boolean;
  maxFileSize: number;
  maxChannels: number;
  maxDirectMessages: number;
}

export interface UserStatistics {
  messagesCount: number;
  channelsJoined: number;
  filesShared: number;
  reactionsGiven: number;
  reactionsReceived: number;
  mentionsGiven: number;
  mentionsReceived: number;
  voiceMinutes: number;
  videoMinutes: number;
  screenShareMinutes: number;
  joinedAt: string;
  lastActiveAt: string;
  averageResponseTime: number;
  favoriteChannels: string[];
  blockedUsers: string[];
}

export interface ChatNotification {
  id: string;
  userId: string;
  type: 'message' | 'mention' | 'reaction' | 'channel_invite' | 'direct_message' | 'system' | 'reminder';
  title: string;
  message: string;
  channelId?: string;
  messageId?: string;
  senderId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
  metadata: { [key: string]: any };
}

export interface ChatSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'web';
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  startTime: string;
  lastActivity: string;
  isActive: boolean;
  location?: SessionLocation;
}

export interface SessionLocation {
  country: string;
  region: string;
  city: string;
  timezone: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ChatBot {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  type: 'system' | 'custom' | 'integration' | 'ai';
  status: 'active' | 'inactive' | 'maintenance';
  capabilities: BotCapability[];
  commands: BotCommand[];
  triggers: BotTrigger[];
  settings: BotSettings;
  permissions: BotPermissions;
  statistics: BotStatistics;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BotCapability {
  id: string;
  name: string;
  description: string;
  type: 'command' | 'trigger' | 'ai' | 'integration' | 'automation';
  isEnabled: boolean;
  config: { [key: string]: any };
}

export interface BotCommand {
  id: string;
  command: string;
  description: string;
  usage: string;
  aliases: string[];
  parameters: BotParameter[];
  permissions: string[];
  isEnabled: boolean;
  cooldown: number; // segundos
  examples: string[];
}

export interface BotParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'user' | 'channel' | 'role' | 'file';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: ParameterValidation;
}

export interface ParameterValidation {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  allowedValues?: any[];
}

export interface BotTrigger {
  id: string;
  type: 'keyword' | 'mention' | 'reaction' | 'join' | 'leave' | 'message' | 'schedule' | 'webhook';
  condition: string;
  action: BotAction;
  isEnabled: boolean;
  channels: string[];
  users: string[];
  cooldown: number;
}

export interface BotAction {
  type: 'message' | 'reaction' | 'dm' | 'webhook' | 'api' | 'function';
  config: { [key: string]: any };
  retries: number;
  timeout: number;
}

export interface BotSettings {
  prefix: string;
  caseSensitive: boolean;
  allowDM: boolean;
  allowMentions: boolean;
  logCommands: boolean;
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number; // segundos
  autoRespond: boolean;
  learningEnabled: boolean;
  moderationEnabled: boolean;
}

export interface BotPermissions {
  channels: string[];
  users: string[];
  roles: string[];
  canReadMessages: boolean;
  canSendMessages: boolean;
  canDeleteMessages: boolean;
  canManageChannels: boolean;
  canManageUsers: boolean;
  canUploadFiles: boolean;
  canUseExternalAPIs: boolean;
  canAccessDatabase: boolean;
}

export interface BotStatistics {
  commandsExecuted: number;
  messagesProcessed: number;
  errorsCount: number;
  averageResponseTime: number;
  uptime: number;
  lastRestart: string;
  popularCommands: { [command: string]: number };
  userInteractions: { [userId: string]: number };
  channelActivity: { [channelId: string]: number };
}

export interface ChatIntegration {
  id: string;
  name: string;
  type: 'webhook' | 'api' | 'bot' | 'email' | 'sms' | 'push' | 'external';
  description: string;
  isActive: boolean;
  config: IntegrationConfig;
  channels: string[];
  events: IntegrationEvent[];
  statistics: IntegrationStatistics;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationConfig {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: { [key: string]: string };
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'apikey' | 'oauth';
    credentials: { [key: string]: string };
  };
  retries: number;
  timeout: number;
  rateLimit: {
    requests: number;
    window: number; // segundos
  };
  customFields: { [key: string]: any };
}

export interface IntegrationEvent {
  type: 'message' | 'user_join' | 'user_leave' | 'channel_create' | 'channel_update' | 'file_upload' | 'reaction_add';
  isEnabled: boolean;
  filters: EventFilter[];
  transformation: EventTransformation;
}

export interface EventFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex';
  value: any;
  logic?: 'and' | 'or';
}

export interface EventTransformation {
  template: string;
  fields: { [key: string]: string };
  format: 'json' | 'xml' | 'form' | 'text';
}

export interface IntegrationStatistics {
  eventsProcessed: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastExecution: string;
  errorRate: number;
  popularEvents: { [event: string]: number };
}

export interface ChatAnalytics {
  channelId?: string;
  userId?: string;
  period: {
    start: string;
    end: string;
  };
  metrics: AnalyticsMetrics;
  trends: AnalyticsTrend[];
  insights: AnalyticsInsight[];
  comparisons: AnalyticsComparison[];
}

export interface AnalyticsMetrics {
  totalMessages: number;
  totalUsers: number;
  totalChannels: number;
  activeUsers: number;
  averageResponseTime: number;
  messageFrequency: number;
  peakHours: { [hour: string]: number };
  topChannels: { [channelId: string]: number };
  topUsers: { [userId: string]: number };
  fileUploads: number;
  reactions: number;
  mentions: number;
  threads: number;
  polls: number;
  events: number;
}

export interface AnalyticsTrend {
  metric: string;
  data: { [date: string]: number };
  direction: 'up' | 'down' | 'stable';
  change: number;
  changePercent: number;
}

export interface AnalyticsInsight {
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  description: string;
  metric: string;
  value: number;
  recommendation?: string;
}

export interface AnalyticsComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  period: string;
}

export interface ChatApiResponse<T = any> {
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
    hasNext: boolean;
    hasPrev: boolean;
  };
  metadata?: {
    executionTime: number;
    version: string;
    rateLimit?: {
      remaining: number;
      reset: number;
    };
  };
}

export interface ChatWebSocketMessage {
  type: 'message' | 'typing' | 'presence' | 'reaction' | 'channel_update' | 'user_update' | 'system' | 'error';
  channelId?: string;
  userId?: string;
  data: any;
  timestamp: string;
  messageId?: string;
}

export interface TypingIndicator {
  channelId: string;
  userId: string;
  userName: string;
  startedAt: string;
  expiresAt: string;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline' | 'invisible';
  statusMessage?: string;
  lastSeen: string;
  currentChannel?: string;
  isTyping: boolean;
  device: string;
}

export interface ChatSearch {
  query: string;
  filters: SearchFilter[];
  sort: SearchSort;
  pagination: SearchPagination;
}

export interface SearchFilter {
  field: 'content' | 'sender' | 'channel' | 'date' | 'type' | 'attachments';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'before' | 'after' | 'between';
  value: any;
  logic?: 'and' | 'or';
}

export interface SearchSort {
  field: 'relevance' | 'date' | 'sender' | 'channel';
  direction: 'asc' | 'desc';
}

export interface SearchPagination {
  page: number;
  limit: number;
  offset: number;
}

export interface SearchResult {
  messages: ChatMessage[];
  channels: ChatChannel[];
  users: ChatUser[];
  files: MessageAttachment[];
  total: number;
  took: number; // tempo de busca em ms
  highlights: { [messageId: string]: string[] };
}
