
export type UserRole = 'ADMIN' | 'MANAGER' | 'USER';

export type ModuleCategory = 'system' | 'business' | 'hr' | 'department' | 'core' | 'content';

export interface ModuleFeatureDefinition {
  key: string;
  title: string;
  description: string;
  defaultRoles: UserRole[];
  /** When false, hide from UserEditor / role feature lists. Default true. */
  userEditor?: boolean;
}

export interface ModuleAclDefinition {
  name: string;
  action: string;
  description: string;
  level: number;
  defaultRoles: UserRole[];
}

export interface ModuleDefinition {
  key: string;
  name: string;
  description?: string;
  defaultRoles: UserRole[];
  category?: ModuleCategory;
  href?: string;
  visible?: boolean;
  /** ACL resource id when it differs from `key` (noticias → news). */
  aclResource?: string;
  features?: ModuleFeatureDefinition[];
  acl?: ModuleAclDefinition[];
}

export interface ExtraAclResource {
  resource: string;
  label: string;
  permissions: ModuleAclDefinition[];
}

const ALL: UserRole[] = ['ADMIN', 'MANAGER', 'USER'];
const STAFF: UserRole[] = ['ADMIN', 'MANAGER'];
const ADMIN_ONLY: UserRole[] = ['ADMIN'];

function feat(
  key: string,
  title: string,
  description: string,
  defaultRoles: UserRole[],
  userEditor = true
): ModuleFeatureDefinition {
  return { key, title, description, defaultRoles, userEditor };
}

function acl(
  name: string,
  action: string,
  description: string,
  level: number,
  defaultRoles: UserRole[]
): ModuleAclDefinition {
  return { name, action, description, level, defaultRoles };
}

function crudAcl(
  resource: string,
  label: string,
  roles: { read: UserRole[]; write: UserRole[]; admin: UserRole[] }
): ModuleAclDefinition[] {
  return [
    acl(`${resource}.view`, 'view', `Visualizar ${label}`, 0, roles.read),
    acl(`${resource}.manage`, 'manage', `Gerenciar ${label}`, 2, roles.write),
    acl(`${resource}.admin`, 'admin', `Administrar ${label}`, 3, roles.admin),
  ];
}

export const SYSTEM_MODULES: ModuleDefinition[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    description: 'Visão geral do sistema',
    defaultRoles: ALL,
    category: 'system',
    href: '/dashboard',
  },
  {
    key: 'noticias',
    name: 'Notícias',
    description: 'Portal de comunicação e novidades',
    defaultRoles: ALL,
    category: 'system',
    href: '/noticias',
    aclResource: 'news',
    features: [
      feat('news_editor', 'Editor de Notícias', 'Pode criar e editar notícias', STAFF),
      feat('news_manager', 'Gerente de Notícias', 'Pode gerenciar, publicar e excluir notícias', ADMIN_ONLY),
    ],
    acl: [
      acl('news.read', 'read', 'Visualizar notícias', 0, ALL),
      acl('news.create', 'create', 'Criar notícias', 1, STAFF),
      acl('news.update', 'update', 'Editar notícias', 2, STAFF),
      acl('news.update.all', 'update.all', 'Editar qualquer notícia', 3, ADMIN_ONLY),
      acl('news.publish', 'publish', 'Publicar notícias', 2, STAFF),
      acl('news.schedule', 'schedule', 'Agendar notícias', 2, STAFF),
      acl('news.moderate', 'moderate', 'Moderar notícias', 2, STAFF),
      acl('news.delete', 'delete', 'Excluir notícias', 3, ADMIN_ONLY),
      acl('news.delete.all', 'delete.all', 'Excluir qualquer notícia', 3, ADMIN_ONLY),
      acl('news.analytics', 'analytics', 'Analytics de notícias', 2, STAFF),
    ],
  },
  {
    key: 'calendario',
    name: 'Calendário',
    description: 'Eventos corporativos e datas importantes',
    defaultRoles: ALL,
    category: 'system',
    href: '/calendario',
    acl: [
      acl('calendario.read', 'read', 'Visualizar calendário', 0, ALL),
      acl('calendario.manage', 'manage', 'Gerenciar eventos do calendário', 2, STAFF),
    ],
  },
  {
    key: 'ia-assistant',
    name: 'ABZ Assistant',
    description: 'Assistente inteligente com IA',
    defaultRoles: ALL,
    category: 'system',
    href: '/ia',
    acl: [acl('ia-assistant.view', 'view', 'Usar o assistente IA', 0, ALL)],
  },
  {
    key: 'ponto',
    name: 'Ponto',
    description: 'Registro e espelho de ponto',
    defaultRoles: ALL,
    category: 'hr',
    href: '/ponto',
    acl: crudAcl('ponto', 'ponto', { read: ALL, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'contracheque',
    name: 'Contracheque',
    description: 'Visualização de holerites e rendimentos',
    defaultRoles: ALL,
    category: 'hr',
    href: '/contracheque',
    acl: [
      acl('contracheque.view', 'view', 'Visualizar contracheque', 0, ALL),
      acl('contracheque.manage', 'manage', 'Gerenciar contracheques', 3, ADMIN_ONLY),
    ],
  },
  {
    key: 'reembolso',
    name: 'Reembolso',
    description: 'Solicitação e acompanhamento de reembolsos',
    defaultRoles: ALL,
    category: 'hr',
    href: '/reembolso',
    aclResource: 'reimbursement',
    features: [
      feat('reimbursement_view', 'Visualizar Reembolsos', 'Permite visualizar solicitações de reembolso', ALL),
      feat('reimbursement_approval', 'Aprovar Reembolsos', 'Permite aprovar ou rejeitar solicitações de reembolso', STAFF),
      feat('reimbursement_edit', 'Editar Configurações de Reembolso', 'Permite editar configurações do sistema de reembolso', STAFF),
    ],
    acl: [
      acl('reimbursement.create', 'create', 'Criar reembolsos', 0, ALL),
      acl('reimbursement.approve', 'approve', 'Aprovar reembolsos', 2, STAFF),
      acl('reimbursement.manage', 'manage', 'Gerenciar reembolsos', 3, ADMIN_ONLY),
    ],
  },
  {
    key: 'kpi',
    name: 'KPIs',
    description: 'Indicadores de desempenho',
    defaultRoles: STAFF,
    category: 'hr',
    href: '/kpi',
    acl: crudAcl('kpi', 'KPIs', { read: STAFF, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'avaliacao',
    name: 'Avaliação de Desempenho',
    description: 'Ciclos de avaliação e feedback',
    defaultRoles: STAFF,
    category: 'hr',
    href: '/avaliacao',
    features: [
      feat('avaliacoes.metricas.read', 'Métricas de Avaliação', 'Ler métricas de avaliação', STAFF),
      feat('avaliacoes.relatorios.read', 'Relatórios de Avaliação', 'Ler relatórios de avaliação', STAFF),
      feat('avaliacoes.dashboard.config', 'Configurar Dashboard de Avaliação', 'Configurar dashboard de avaliação', ADMIN_ONLY, false),
    ],
    acl: crudAcl('avaliacao', 'avaliação de desempenho', { read: STAFF, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'epi',
    name: 'EPI',
    description: 'Equipamentos de Proteção Individual',
    defaultRoles: ALL,
    category: 'hr',
    href: '/epi',
    acl: crudAcl('epi', 'EPI / QHSE', { read: ALL, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'ferias',
    name: 'Férias',
    description: 'Solicitação e aprovação de férias',
    defaultRoles: ALL,
    category: 'hr',
    href: '/ferias',
    features: [
      feat('ferias.read', 'Visualizar Férias', 'Pode visualizar pedidos de férias e saldo', ALL),
      feat('ferias.create', 'Solicitar Férias', 'Pode submeter pedidos de férias', ALL),
      feat('ferias.approve', 'Aprovar Férias', 'Pode aprovar ou rejeitar pedidos de férias', STAFF),
      feat('ferias.manage', 'Gerenciar Férias', 'Pode gerenciar saldos e períodos', ADMIN_ONLY),
      feat('ferias.admin', 'Administrador de Férias', 'Acesso total ao módulo de férias', ADMIN_ONLY, false),
    ],
    acl: [
      acl('ferias.read', 'read', 'Visualizar férias e saldo', 0, ALL),
      acl('ferias.create', 'create', 'Solicitar férias', 1, ALL),
      acl('ferias.approve', 'approve', 'Aprovar pedidos de férias', 2, STAFF),
      acl('ferias.manage', 'manage', 'Gerenciar saldos e períodos de férias', 3, ADMIN_ONLY),
      acl('ferias.admin', 'admin', 'Administrador de férias', 3, ADMIN_ONLY),
    ],
  },
  {
    key: 'lista-presenca',
    name: 'Lista de Presença',
    description: 'Controle de presença e assinaturas',
    defaultRoles: ALL,
    category: 'hr',
    href: '/lista-presenca',
    features: [
      feat('lista-presenca.read', 'Visualizar Lista de Presença', 'Visualizar listas e registros', ALL),
      feat('lista-presenca.create', 'Criar Lista de Presença', 'Criar novas listas', ALL),
      feat('lista-presenca.manage', 'Gerenciar Lista de Presença', 'Fechar e assinar listas', STAFF),
    ],
    acl: [
      acl('lista-presenca.read', 'read', 'Visualizar listas de presença', 0, ALL),
      acl('lista-presenca.create', 'create', 'Criar listas de presença', 1, ALL),
      acl('lista-presenca.manage', 'manage', 'Gerenciar e assinar listas de presença', 3, STAFF),
    ],
  },
  {
    key: 'contratos',
    name: 'Contratos',
    description: 'Gestão de documentos e assinaturas digitais',
    defaultRoles: ALL,
    category: 'hr',
    href: '/contratos',
    features: [
      feat('contracts.sign', 'Assinar Contratos', 'Assinar documentos atribuídos', ALL),
      feat('contracts.manage', 'Gerenciar Contratos', 'Upload e posições de assinatura', STAFF),
    ],
    acl: [
      acl('contratos.read', 'read', 'Visualizar contratos atribuídos', 0, ALL),
      acl('contratos.sign', 'sign', 'Assinar contratos atribuídos', 1, ALL),
      acl('contratos.manage', 'manage', 'Gerenciar uploads e assinaturas de contratos', 3, STAFF),
    ],
  },
  {
    key: 'academy',
    name: 'Academy',
    description: 'Plataforma de cursos e treinamentos',
    defaultRoles: ALL,
    category: 'hr',
    href: '/academy',
    features: [
      feat('academy_moderator', 'Moderador da Academy', 'Moderar comentários e avaliações', STAFF),
      feat('academy_editor', 'Editor da Academy', 'Criar, editar e publicar cursos', ADMIN_ONLY),
    ],
    acl: [
      acl('academy.read', 'read', 'Visualizar cursos', 0, ALL),
      acl('academy.enroll', 'enroll', 'Inscrever-se em cursos', 0, ALL),
      acl('academy.rate', 'rate', 'Avaliar cursos', 0, ALL),
      acl('academy.comment', 'comment', 'Comentar em cursos', 0, ALL),
      acl('academy.create', 'create', 'Criar cursos', 2, STAFF),
      acl('academy.update', 'update', 'Editar cursos', 2, STAFF),
      acl('academy.publish', 'publish', 'Publicar cursos', 2, STAFF),
      acl('academy.moderate', 'moderate', 'Moderar Academy', 2, STAFF),
      acl('academy.delete', 'delete', 'Excluir cursos', 3, ADMIN_ONLY),
    ],
  },
  {
    key: 'biblioteca',
    name: 'Biblioteca',
    description: 'Repositório de arquivos e documentos',
    defaultRoles: ALL,
    category: 'content',
    href: '/biblioteca',
    visible: true,
    acl: [
      acl('biblioteca.view', 'view', 'Visualizar biblioteca', 0, ALL),
      acl('biblioteca.manage', 'manage', 'Gerenciar biblioteca', 3, ADMIN_ONLY),
    ],
  },
  {
    key: 'ajuda',
    name: 'Ajuda',
    description: 'Central de suporte e dúvidas',
    defaultRoles: ALL,
    category: 'content',
    href: '/ajuda',
  },
  {
    key: 'manual',
    name: 'Manual do Colaborador',
    description: 'Guia de normas e conduta',
    defaultRoles: ALL,
    category: 'department',
    href: '/manual',
    visible: false,
  },
  {
    key: 'procedimentos',
    name: 'Procedimentos',
    description: 'Procedimentos Operacionais Padrão (POPs)',
    defaultRoles: ALL,
    category: 'department',
    href: '/procedimentos',
    visible: false,
  },
  {
    key: 'politicas',
    name: 'Políticas',
    description: 'Políticas internas da empresa',
    defaultRoles: ALL,
    category: 'department',
    href: '/politicas',
    visible: false,
  },
  {
    key: 'compras',
    name: 'Ordens de Compra',
    description: 'Gestão de compras e aprovações',
    defaultRoles: STAFF,
    category: 'department',
    href: '/department/purchase-orders',
    visible: true,
    acl: crudAcl('compras', 'ordens de compra', { read: STAFF, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'poliweb',
    name: 'Poliweb',
    description: 'Clínica ocupacional e gestão de ASO',
    defaultRoles: ALL,
    category: 'department',
    href: '/poliweb',
    visible: true,
    acl: crudAcl('poliweb', 'PoliWeb', { read: ALL, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'man-schedule',
    name: 'Man Schedule',
    description: 'Gestão de tripulantes e escalas offshore',
    defaultRoles: STAFF,
    category: 'department',
    href: '/department/man-schedule',
    visible: true,
    acl: crudAcl('man-schedule', 'Man Schedule', { read: STAFF, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'chat',
    name: 'Chat',
    description: 'Comunicação interna',
    defaultRoles: ALL,
    category: 'department',
    href: '/chat',
    features: [
      feat('chat.view', 'Ver Chat', 'Acessar canais de chat', ALL),
      feat('chat.send', 'Enviar Mensagens', 'Enviar mensagens no chat', ALL),
      feat('chat.manage_channels', 'Gerenciar Canais', 'Criar e gerenciar canais', STAFF, false),
    ],
    acl: crudAcl('chat', 'chat interno', { read: ALL, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'wkradar',
    name: 'WK Radar',
    description: 'Sistema Radar',
    defaultRoles: STAFF,
    category: 'department',
    href: '/wkradar',
    acl: crudAcl('wkradar', 'WK Radar', { read: STAFF, write: STAFF, admin: ADMIN_ONLY }),
  },
  {
    key: 'contatos',
    name: 'Lista de Ramais',
    description: 'Contatos e telefones úteis',
    defaultRoles: ALL,
    category: 'department',
    href: '/contatos',
    visible: false,
  },
  {
    key: 'emergencia',
    name: 'Emergência',
    description: 'Procedimentos de emergência',
    defaultRoles: ALL,
    category: 'department',
    href: '/emergencia',
    visible: false,
  },
  {
    key: 'guia_offshore',
    name: 'Guia Offshore',
    description: 'Guia para trabalho embarcado',
    defaultRoles: ALL,
    category: 'department',
    href: '/guia_offshore',
    visible: false,
  },
  {
    key: 'notifications',
    name: 'Notificações',
    description: 'Gerenciar notificações do sistema',
    defaultRoles: ADMIN_ONLY,
    category: 'department',
    href: '/admin/notifications',
    visible: false,
    acl: [
      acl('notifications.send', 'send', 'Enviar notificações', 2, STAFF),
      acl('notifications.broadcast', 'broadcast', 'Broadcast de notificações', 3, ADMIN_ONLY),
      acl('notifications.schedule', 'schedule', 'Agendar notificações', 2, STAFF),
      acl('notifications.manage', 'manage', 'Gerenciar notificações', 3, ADMIN_ONLY),
    ],
  },
  {
    key: 'feedback',
    name: 'Feedbacks',
    description: 'Visualizar feedbacks dos usuários',
    defaultRoles: ADMIN_ONLY,
    category: 'department',
    href: '/admin/feedback',
    visible: false,
  },
  {
    key: 'metrics',
    name: 'Métricas Gerais',
    description: 'Métricas gerais de uso',
    defaultRoles: ADMIN_ONLY,
    category: 'department',
    href: '/admin/metrics',
    visible: false,
  },
  {
    key: 'engagement',
    name: 'Engajamento (Notícias)',
    description: 'Métricas de engajamento de notícias',
    defaultRoles: ADMIN_ONLY,
    category: 'department',
    href: '/admin/metrics/engagement',
    visible: false,
  },
  {
    key: 'admin',
    name: 'Administração',
    description: 'Configurações do sistema',
    defaultRoles: ADMIN_ONLY,
    category: 'system',
    href: '/admin',
    acl: [
      acl('admin.users', 'users', 'Gerenciar usuários', 3, ADMIN_ONLY),
      acl('admin.settings', 'settings', 'Gerenciar configurações', 3, ADMIN_ONLY),
      acl('admin.acl', 'acl', 'Gerenciar permissões ACL', 3, ADMIN_ONLY),
    ],
  },
  {
    key: 'integracao-erp',
    name: 'Integração ERP',
    description: 'Gestão de integração MIO',
    defaultRoles: ADMIN_ONLY,
    category: 'department',
    href: '/admin/integracao-erp',
    acl: crudAcl('integracao-erp', 'integração ERP', { read: ADMIN_ONLY, write: ADMIN_ONLY, admin: ADMIN_ONLY }),
  },
  {
    key: 'gestao-tripulantes',
    name: 'Gestão de Tripulantes',
    description: 'Gestão inteligente de tripulantes, documentos e escala offshore',
    defaultRoles: STAFF,
    category: 'department',
    href: '/department/gestao-tripulantes',
    visible: true,
    features: [
      feat('gestao-tripulantes.documents.edit', 'Editar itens do cadastro', 'Treinamentos, ASO, documentos e passaportes', STAFF),
      feat('gestao-tripulantes.documents.delete', 'Excluir itens do cadastro', 'Soft-delete em gt_documentos', STAFF),
      feat('gestao-tripulantes.matrizes.manage', 'Gerenciar matrizes', 'Matriz de treinamentos por cargo', STAFF),
      feat('gestao-tripulantes.matrizes.view', 'Visualizar matrizes', 'Ver matrizes de treinamento', STAFF, false),
      feat('gestao-tripulantes.view', 'Visualizar Gestão de Tripulantes', 'Dashboard e tripulantes', STAFF, false),
    ],
    acl: [
      acl('gestao-tripulantes.view', 'view', 'Visualizar dashboard', 0, STAFF),
      acl('gestao-tripulantes.manage', 'manage', 'Gerenciar tripulantes', 2, STAFF),
      acl('gestao-tripulantes.admin', 'admin', 'Admin total', 3, ADMIN_ONLY),
      acl('gestao-tripulantes.matrizes.view', 'matrizes.view', 'Visualizar matrizes de treinamento', 0, STAFF),
      acl('gestao-tripulantes.matrizes.manage', 'matrizes.manage', 'Gerenciar matrizes de treinamento por cargo', 2, STAFF),
      acl('gestao-tripulantes.documents.upload', 'documents.upload', 'Upload documentos', 1, STAFF),
      acl('gestao-tripulantes.documents.edit', 'documents.edit', 'Editar documentos do cadastro', 1, STAFF),
      acl('gestao-tripulantes.documents.delete', 'documents.delete', 'Excluir documentos do cadastro', 2, STAFF),
      acl('gestao-tripulantes.documents.ocr', 'documents.ocr', 'Executar OCR', 2, STAFF),
      acl('gestao-tripulantes.back.suggest', 'back.suggest', 'Sugerir back', 2, STAFF),
      acl('gestao-tripulantes.poliweb.scrape', 'poliweb.scrape', 'Scraping PoliWeb', 3, ADMIN_ONLY),
      acl('gestao-tripulantes.notifications.send', 'notifications.send', 'Enviar notificações', 2, STAFF),
    ],
  },
  {
    key: 'e-social',
    name: 'E-Social',
    description: 'Envio de eventos trabalhistas ao sistema E-Social do governo',
    defaultRoles: ALL,
    category: 'department',
    href: '/department/e-social',
    visible: true,
    features: [
      feat('esocial.view', 'Visualizar Eventos', 'Visualizar eventos do e-Social', STAFF),
      feat('esocial.prepare', 'Preparar Eventos', 'Preparar eventos para envio', STAFF),
      feat('esocial.review', 'Revisar Eventos', 'Revisar eventos', STAFF),
      feat('esocial.send', 'Enviar Eventos', 'Enviar ao e-Social', ADMIN_ONLY),
    ],
    acl: [
      acl('e-social.view', 'view', 'Visualizar eventos', 1, STAFF),
      acl('e-social.prepare', 'prepare', 'Preparar eventos', 2, STAFF),
      acl('e-social.review', 'review', 'Revisar eventos', 2, STAFF),
      acl('e-social.send', 'send', 'Enviar para E-Social', 3, ADMIN_ONLY),
      acl('e-social.admin', 'admin', 'Admin total', 3, ADMIN_ONLY),
    ],
  },
  {
    key: 'dp',
    name: 'Departamento Pessoal',
    description: 'Gestão completa de colaboradores, escalas, fechamento de folha e DP',
    defaultRoles: STAFF,
    category: 'department',
    href: '/department/dp',
    visible: true,
    acl: crudAcl('dp', 'Departamento Pessoal', { read: STAFF, write: STAFF, admin: ADMIN_ONLY }),
  },
];

/** ACL resources that are not a sidebar module. */
export const EXTRA_ACL_RESOURCES: ExtraAclResource[] = [
  {
    resource: 'comments',
    label: 'Comentários',
    permissions: [
      acl('comments.create', 'create', 'Criar comentários', 0, ALL),
      acl('comments.read', 'read', 'Ler comentários', 0, ALL),
      acl('comments.update', 'update', 'Editar comentários', 1, STAFF),
      acl('comments.delete', 'delete', 'Excluir comentários', 2, STAFF),
      acl('comments.moderate', 'moderate', 'Moderar comentários', 2, STAFF),
    ],
  },
  {
    resource: 'reminders',
    label: 'Lembretes',
    permissions: [
      acl('reminders.create', 'create', 'Criar lembretes', 1, ALL),
      acl('reminders.manage', 'manage', 'Gerenciar lembretes', 2, STAFF),
    ],
  },
  {
    resource: 'social',
    label: 'Rede Social',
    permissions: [
      acl('social.read', 'read', 'Ler feed social', 0, ALL),
      acl('social.create', 'create', 'Criar posts', 0, ALL),
      acl('social.create.official', 'create.official', 'Criar posts oficiais', 2, STAFF),
      acl('social.update', 'update', 'Editar posts', 1, ALL),
      acl('social.delete', 'delete', 'Excluir posts', 2, STAFF),
      acl('social.comment', 'comment', 'Comentar', 0, ALL),
      acl('social.like', 'like', 'Curtir', 0, ALL),
      acl('social.follow', 'follow', 'Seguir', 0, ALL),
      acl('social.story', 'story', 'Stories', 0, ALL),
      acl('social.moderate', 'moderate', 'Moderar social', 2, STAFF),
      acl('social.analytics', 'analytics', 'Analytics social', 2, STAFF),
    ],
  },
];

export interface AclSeedPermission {
  name: string;
  description: string;
  resource: string;
  action: string;
  level: number;
}

export interface PermissionCatalogModule {
  id: string;
  key: string;
  label: string;
  description: string;
  category: ModuleCategory | undefined;
  href: string | undefined;
  visible: boolean;
  defaultRoles: UserRole[];
  features: ModuleFeatureDefinition[];
  acl: ModuleAclDefinition[];
  aclResource: string;
}

function moduleAclResource(mod: ModuleDefinition): string {
  return mod.aclResource || mod.key;
}

export function getPermissionCatalogModules(): PermissionCatalogModule[] {
  return SYSTEM_MODULES.map((mod) => ({
    id: mod.key,
    key: mod.key,
    label: mod.name,
    description: mod.description || '',
    category: mod.category,
    href: mod.href,
    visible: mod.visible !== false,
    defaultRoles: mod.defaultRoles,
    features: mod.features || [],
    acl: mod.acl || [],
    aclResource: moduleAclResource(mod),
  }));
}

export function getAclSeedPermissions(): AclSeedPermission[] {
  const out: AclSeedPermission[] = [];
  const seen = new Set<string>();
  const push = (resource: string, perm: ModuleAclDefinition) => {
    if (seen.has(perm.name)) return;
    seen.add(perm.name);
    out.push({
      name: perm.name,
      description: perm.description,
      resource,
      action: perm.action,
      level: perm.level,
    });
  };
  for (const mod of SYSTEM_MODULES) {
    const resource = moduleAclResource(mod);
    for (const perm of mod.acl || []) push(resource, perm);
  }
  for (const extra of EXTRA_ACL_RESOURCES) {
    for (const perm of extra.permissions) push(extra.resource, perm);
  }
  return out;
}

export function getAclRoleGrants(): Record<UserRole, string[]> {
  const grants: Record<UserRole, Set<string>> = {
    ADMIN: new Set(),
    MANAGER: new Set(),
    USER: new Set(),
  };
  const add = (perm: ModuleAclDefinition) => {
    for (const role of perm.defaultRoles) {
      grants[role].add(perm.name);
    }
    grants.ADMIN.add(perm.name);
  };
  for (const mod of SYSTEM_MODULES) {
    for (const perm of mod.acl || []) add(perm);
  }
  for (const extra of EXTRA_ACL_RESOURCES) {
    for (const perm of extra.permissions) add(perm);
  }
  return {
    ADMIN: Array.from(grants.ADMIN),
    MANAGER: Array.from(grants.MANAGER),
    USER: Array.from(grants.USER),
  };
}

const ACL_RESOURCE_LABELS: Record<string, string> = {
  news: 'Notícias',
  comments: 'Comentários',
  notifications: 'Notificações',
  reminders: 'Lembretes',
  admin: 'Administração',
  users: 'Usuários',
  reports: 'Relatórios',
  ferias: 'Férias',
  contratos: 'Contratos',
  'lista-presenca': 'Lista de Presença',
  reimbursement: 'Reembolso',
  'gestao-tripulantes': 'Gestão de Tripulantes',
  'e-social': 'e-Social',
  social: 'Rede Social',
  academy: 'Academy',
  epi: 'EPI / QHSE',
  kpi: 'KPIs',
  avaliacao: 'Avaliação de Desempenho',
  dp: 'Departamento Pessoal',
  calendario: 'Calendário',
  ponto: 'Ponto',
  chat: 'Chat',
  'man-schedule': 'Man Schedule',
  poliweb: 'PoliWeb',
  compras: 'Ordens de Compra',
  'ia-assistant': 'ABZ Assistant',
};

export function getAclResourceLabel(resource: string): string {
  if (ACL_RESOURCE_LABELS[resource]) return ACL_RESOURCE_LABELS[resource];
  const fromModule = SYSTEM_MODULES.find((mod) => moduleAclResource(mod) === resource);
  if (fromModule) return fromModule.name;
  const extra = EXTRA_ACL_RESOURCES.find((item) => item.resource === resource);
  if (extra) return extra.label;
  return resource.charAt(0).toUpperCase() + resource.slice(1);
}

export function getModuleKeyForCatalogFeature(featureKey: string): string | null {
  for (const mod of SYSTEM_MODULES) {
    if (mod.features?.some((feature) => feature.key === featureKey)) {
      return mod.key;
    }
  }
  return null;
}

export function getCatalogFeaturesForUi(): Array<ModuleFeatureDefinition & { moduleKey: string; moduleLabel: string }> {
  const out: Array<ModuleFeatureDefinition & { moduleKey: string; moduleLabel: string }> = [];
  for (const mod of SYSTEM_MODULES) {
    for (const feature of mod.features || []) {
      if (feature.userEditor === false) continue;
      out.push({ ...feature, moduleKey: mod.key, moduleLabel: mod.name });
    }
  }
  return out;
}

export function getCatalogFeatureDefaultsForRole(role: string): Record<string, boolean> {
  const normalizedRole = role.toUpperCase() as UserRole;
  const features: Record<string, boolean> = {};
  for (const mod of SYSTEM_MODULES) {
    for (const feature of mod.features || []) {
      features[feature.key] = feature.defaultRoles.includes(normalizedRole);
    }
  }
  return features;
}

/**
 * Returns the default permissions object for a given role based on the SYSTEM_MODULES config.
 */
export function getDefaultPermissionsForRole(role: string): Record<string, boolean> {
  const normalizedRole = role.toUpperCase() as UserRole;
  const permissions: Record<string, boolean> = {};

  SYSTEM_MODULES.forEach((module) => {
    if (module.defaultRoles.includes(normalizedRole)) {
      permissions[module.key] = true;
    }
  });

  return permissions;
}

/**
 * Returns a complete map of { [moduleKey]: boolean } for all modules for a given role.
 */
export function getFullPermissionsForRole(role: string): Record<string, boolean> {
  const normalizedRole = role.toUpperCase() as UserRole;
  const permissions: Record<string, boolean> = {};

  SYSTEM_MODULES.forEach((module) => {
    permissions[module.key] = module.defaultRoles.includes(normalizedRole);
  });

  return permissions;
}

export function getPermissionCatalogPayload() {
  return {
    modules: getPermissionCatalogModules(),
    extraAclResources: EXTRA_ACL_RESOURCES.map((item) => ({
      resource: item.resource,
      label: item.label,
      acl: item.permissions,
    })),
    features: getCatalogFeaturesForUi(),
    resourceLabels: Object.fromEntries(
      [
        ...getPermissionCatalogModules().map((mod) => [mod.aclResource, mod.label] as const),
        ...EXTRA_ACL_RESOURCES.map((item) => [item.resource, item.label] as const),
      ]
    ),
  };
}
