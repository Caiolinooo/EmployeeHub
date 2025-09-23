// Tipos para Dashboard de BI Avançado

export interface BIDashboard {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: BIWidget[];
  filters: DashboardFilter[];
  permissions: DashboardPermissions;
  isPublic: boolean;
  isTemplate: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastAccessed?: string;
  accessCount: number;
  tags: string[];
  category: string;
  refreshInterval?: number; // em segundos
  autoRefresh: boolean;
}

export interface DashboardLayout {
  type: 'grid' | 'flex' | 'custom';
  columns: number;
  rows: number;
  gap: number;
  responsive: boolean;
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface BIWidget {
  id: string;
  type: 'chart' | 'kpi' | 'table' | 'text' | 'image' | 'iframe' | 'map' | 'gauge' | 'funnel' | 'heatmap';
  title: string;
  description?: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: WidgetConfig;
  dataSource: DataSource;
  query: DataQuery;
  styling: WidgetStyling;
  interactions: WidgetInteraction[];
  refreshInterval?: number;
  lastUpdated?: string;
  isVisible: boolean;
  conditionalVisibility?: ConditionalRule[];
}

export interface WidgetPosition {
  x: number;
  y: number;
  z?: number; // para sobreposição
}

export interface WidgetSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizable: boolean;
}

export interface WidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'bubble' | 'radar' | 'polar' | 'treemap';
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'mode';
  groupBy?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  showGrid?: boolean;
  showTooltips?: boolean;
  animation?: boolean;
  responsive?: boolean;
  colors?: string[];
  customOptions?: { [key: string]: any };
}

export interface DataSource {
  id: string;
  name: string;
  type: 'supabase' | 'api' | 'csv' | 'json' | 'sql' | 'mongodb' | 'elasticsearch';
  connection: DataConnection;
  schema?: DataSchema;
  lastSync?: string;
  syncStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  errorMessage?: string;
}

export interface DataConnection {
  url?: string;
  database?: string;
  table?: string;
  collection?: string;
  index?: string;
  credentials?: {
    username?: string;
    password?: string;
    apiKey?: string;
    token?: string;
  };
  headers?: { [key: string]: string };
  params?: { [key: string]: any };
}

export interface DataSchema {
  fields: DataField[];
  primaryKey?: string;
  relationships?: DataRelationship[];
}

export interface DataField {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array';
  nullable: boolean;
  unique?: boolean;
  description?: string;
  format?: string; // para datas, números, etc.
  enum?: string[]; // para campos com valores limitados
}

export interface DataRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  sourceField: string;
  targetTable: string;
  targetField: string;
}

export interface DataQuery {
  select: string[];
  from: string;
  joins?: QueryJoin[];
  where?: QueryCondition[];
  groupBy?: string[];
  having?: QueryCondition[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
  raw?: string; // para queries SQL customizadas
}

export interface QueryJoin {
  type: 'inner' | 'left' | 'right' | 'full';
  table: string;
  on: string;
  alias?: string;
}

export interface QueryCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'ilike' | 'is' | 'between';
  value: any;
  logic?: 'and' | 'or';
}

export interface WidgetStyling {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  shadow?: boolean;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  customCSS?: string;
}

export interface WidgetInteraction {
  type: 'click' | 'hover' | 'doubleClick' | 'rightClick';
  action: 'drillDown' | 'filter' | 'navigate' | 'modal' | 'tooltip' | 'custom';
  target?: string; // URL, dashboard ID, etc.
  parameters?: { [key: string]: any };
  condition?: ConditionalRule;
}

export interface ConditionalRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';
  value: any;
  logic?: 'and' | 'or';
  children?: ConditionalRule[];
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: 'dropdown' | 'multiselect' | 'daterange' | 'slider' | 'input' | 'checkbox' | 'radio';
  field: string;
  dataSource: string;
  options?: FilterOption[];
  defaultValue?: any;
  required: boolean;
  visible: boolean;
  position: 'top' | 'left' | 'right' | 'bottom' | 'floating';
  affectedWidgets: string[]; // IDs dos widgets afetados
  cascading?: string[]; // IDs de outros filtros que dependem deste
}

export interface FilterOption {
  label: string;
  value: any;
  color?: string;
  icon?: string;
  disabled?: boolean;
}

export interface DashboardPermissions {
  owner: string;
  viewers: string[];
  editors: string[];
  public: boolean;
  roles: {
    [role: string]: 'view' | 'edit' | 'admin';
  };
  departments: {
    [department: string]: 'view' | 'edit' | 'admin';
  };
}

export interface BIMetrics {
  dashboardId: string;
  totalViews: number;
  uniqueUsers: number;
  avgSessionDuration: number;
  bounceRate: number;
  mostViewedWidgets: WidgetMetric[];
  performanceMetrics: PerformanceMetric[];
  userEngagement: EngagementMetric[];
  errorRate: number;
  lastCalculated: string;
}

export interface WidgetMetric {
  widgetId: string;
  widgetTitle: string;
  views: number;
  interactions: number;
  avgLoadTime: number;
  errorCount: number;
}

export interface PerformanceMetric {
  timestamp: string;
  loadTime: number;
  queryTime: number;
  renderTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface EngagementMetric {
  userId: string;
  sessionId: string;
  startTime: string;
  endTime: string;
  interactions: InteractionEvent[];
  widgets: string[];
  filters: string[];
}

export interface InteractionEvent {
  timestamp: string;
  type: 'view' | 'click' | 'hover' | 'filter' | 'export' | 'refresh';
  target: string;
  duration?: number;
  metadata?: { [key: string]: any };
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  industry: string[];
  tags: string[];
  thumbnail: string;
  dashboard: Omit<BIDashboard, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;
  rating: number;
  downloads: number;
  createdBy: string;
  createdAt: string;
  isOfficial: boolean;
  isPremium: boolean;
}

export interface DashboardExport {
  format: 'pdf' | 'png' | 'jpg' | 'excel' | 'csv' | 'json';
  options: {
    includeFilters?: boolean;
    includeData?: boolean;
    pageSize?: 'A4' | 'A3' | 'letter' | 'legal';
    orientation?: 'portrait' | 'landscape';
    quality?: 'low' | 'medium' | 'high';
    watermark?: string;
    password?: string;
  };
  widgets?: string[]; // IDs específicos para exportar
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface DashboardAlert {
  id: string;
  dashboardId: string;
  widgetId?: string;
  name: string;
  description?: string;
  condition: AlertCondition;
  actions: AlertAction[];
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  lastTriggered?: string;
  triggerCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'change_gt' | 'change_lt';
  value: number;
  timeWindow?: number; // em minutos
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'notification' | 'slack' | 'teams';
  target: string; // email, phone, URL, etc.
  template?: string;
  parameters?: { [key: string]: any };
}

export interface DashboardComment {
  id: string;
  dashboardId: string;
  widgetId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mentions: string[];
  attachments: string[];
  parentId?: string; // para replies
  reactions: CommentReaction[];
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentReaction {
  userId: string;
  type: 'like' | 'dislike' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
  timestamp: string;
}

export interface DashboardVersion {
  id: string;
  dashboardId: string;
  version: string;
  changes: string;
  dashboard: BIDashboard;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
  tags: string[];
}

export interface BIApiResponse<T = any> {
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
    queryTime: number;
    cacheHit: boolean;
    dataFreshness: string;
  };
}
