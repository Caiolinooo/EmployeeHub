import { getFullPermissionsForRole } from '@/config/modules';
import { hasEffectiveFeature } from '@/lib/effective-feature';

// Utilities for Academy and Social permissions

export interface PermissionFeatures {
  academy_editor?: boolean;
  academy_moderator?: boolean;
  social_editor?: boolean;
  social_moderator?: boolean;
  'avaliacoes.metricas.read'?: boolean;
  'avaliacoes.metricas.admin'?: boolean;
  'avaliacoes.relatorios.read'?: boolean;
  'avaliacoes.relatorios.export'?: boolean;
  'avaliacoes.dashboard.config'?: boolean;
  'avaliacoes.alertas.manage'?: boolean;
  'avaliacoes.analytics.advanced'?: boolean;
  'relatorios.pdf.read'?: boolean;
  'relatorios.pdf.generate'?: boolean;
  'relatorios.pdf.admin'?: boolean;
  'relatorios.templates.read'?: boolean;
  'relatorios.templates.create'?: boolean;
  'relatorios.templates.edit'?: boolean;
  'relatorios.historico.read'?: boolean;
  'relatorios.historico.manage'?: boolean;
  'api.mobile.admin'?: boolean;
  'api.mobile.view'?: boolean;
  'api.mobile.devices'?: boolean;
  'api.mobile.notifications'?: boolean;
  'api.mobile.settings'?: boolean;
  'erp.view'?: boolean;
  'erp.manage'?: boolean;
  'erp.sync'?: boolean;
  'erp.connections'?: boolean;
  'erp.jobs'?: boolean;
  'bi.view'?: boolean;
  'bi.create'?: boolean;
  'bi.edit'?: boolean;
  'bi.delete'?: boolean;
  'bi.export'?: boolean;
  'bi.admin'?: boolean;
  'workflows.view'?: boolean;
  'workflows.create'?: boolean;
  'workflows.edit'?: boolean;
  'workflows.delete'?: boolean;
  'workflows.execute'?: boolean;
  'workflows.admin'?: boolean;
  'chat.view'?: boolean;
  'chat.send'?: boolean;
  'chat.create_channels'?: boolean;
  'chat.manage_channels'?: boolean;
  'chat.delete_messages'?: boolean;
  'chat.admin'?: boolean;
  'news_editor'?: boolean;
  'news_manager'?: boolean;
  'contracts.manage'?: boolean;
  'contracts.sign'?: boolean;
  'ferias.read'?: boolean;
  'ferias.create'?: boolean;
  'ferias.approve'?: boolean;
  'ferias.manage'?: boolean;
  'ferias.admin'?: boolean;
  'lista-presenca.read'?: boolean;
  'lista-presenca.create'?: boolean;
  'lista-presenca.manage'?: boolean;
  'lista-presenca.admin'?: boolean;
  // Gestão de Tripulantes
  'gestao-tripulantes.view'?: boolean;
  'gestao-tripulantes.manage'?: boolean;
  'gestao-tripulantes.admin'?: boolean;
  'gestao-tripulantes.matrizes.manage'?: boolean;
  'gestao-tripulantes.matrizes.view'?: boolean;
  'gestao-tripulantes.documents.edit'?: boolean;
  'gestao-tripulantes.documents.delete'?: boolean;
  'gestao-tripulantes.documents.ocr'?: boolean;
  'gestao-tripulantes.back.suggest'?: boolean;
  'gestao-tripulantes.poliweb.scrape'?: boolean;
  'gestao-tripulantes.notifications.manage'?: boolean;
  // E-Social
  'esocial.view'?: boolean;
  'esocial.prepare'?: boolean;
  'esocial.review'?: boolean;
  'esocial.send'?: boolean;
  'esocial.admin'?: boolean;
  [key: string]: boolean | undefined;
}

export interface AccessPermissions {
  modules?: {
    [key: string]: boolean;
  };
  features?: PermissionFeatures;
}

export interface AppUserLike {
  role?: string;
  access_permissions?: AccessPermissions;
  accessPermissions?: AccessPermissions;
  acl_permission_names?: string[];
}

/**
 * Check if user has a specific feature permission
 */
export function hasFeaturePermission(
  user: AppUserLike | null,
  feature: keyof PermissionFeatures
): boolean {
  if (!user) return false;

  const permissions = user.access_permissions || user.accessPermissions;
  return hasEffectiveFeature(
    {
      role: user.role,
      features: permissions?.features,
      aclNames: user.acl_permission_names,
    },
    String(feature),
  );
}

/**
 * Check if user can edit Academy content
 */
export function canEditAcademy(user: AppUserLike | null): boolean {
  return hasFeaturePermission(user, 'academy_editor');
}

/**
 * Check if user can moderate Academy content
 */
export function canModerateAcademy(user: AppUserLike | null): boolean {
  return hasFeaturePermission(user, 'academy_moderator') || canEditAcademy(user);
}

/**
 * Check if user can edit Social content
 */
export function canEditSocial(user: AppUserLike | null): boolean {
  return hasFeaturePermission(user, 'social_editor');
}

/**
 * Check if user can moderate Social content
 */
export function canModerateSocial(user: AppUserLike | null): boolean {
  return hasFeaturePermission(user, 'social_moderator') || canEditSocial(user);
}

/**
 * Check if user has any Academy permissions
 */
export function hasAcademyAccess(user: AppUserLike | null): boolean {
  return canEditAcademy(user) || canModerateAcademy(user);
}

/**
 * Check if user has any Social permissions
 */
export function hasSocialAccess(user: AppUserLike | null): boolean {
  return canEditSocial(user) || canModerateSocial(user);
}

/**
 * Check if user can manage contracts (upload, assign signatures)
 */
export function canManageContracts(user: AppUserLike | null): boolean {
  return hasFeaturePermission(user, 'contracts.manage');
}

/**
 * Check if user can sign contracts
 */
export function canSignContracts(user: AppUserLike | null): boolean {
  if (!user) return false;
  // All authenticated users can sign documents assigned to them
  return true;
}

/**
 * Get user's Academy permission level
 */
export function getAcademyPermissionLevel(user: AppUserLike | null): 'none' | 'moderator' | 'editor' {
  if (!user) return 'none';
  if (canEditAcademy(user)) return 'editor';
  if (canModerateAcademy(user)) return 'moderator';
  return 'none';
}

/**
 * Get user's Social permission level
 */
export function getSocialPermissionLevel(user: AppUserLike | null): 'none' | 'moderator' | 'editor' {
  if (!user) return 'none';
  if (canEditSocial(user)) return 'editor';
  if (canModerateSocial(user)) return 'moderator';
  return 'none';
}

/**
 * Generic content moderation checker mapped by resource type
 */
export function canModerateContent(
  user: AppUserLike | null,
  resource: string
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const academyTypes = ['comment', 'rating', 'course', 'lesson', 'announcement'];
  const socialTypes = ['post', 'feed', 'social_comment'];

  if (academyTypes.includes(resource)) {
    return canModerateAcademy(user);
  }
  if (socialTypes.includes(resource)) {
    return canModerateSocial(user);
  }

  // Fallback: any moderation permission
  return canModerateAcademy(user) || canModerateSocial(user);
}


/**
 * Update user permissions (for admin use)
 */
export async function updateUserPermissions(
  userId: string,
  features: Partial<PermissionFeatures>,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/users/permissions/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId,
        features
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro ao atualizar permissões' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating permissions:', error);
    return { success: false, error: 'Erro de conexão' };
  }
}

/**
 * Get all users with their permission levels (for admin use)
 */
export async function getUsersWithPermissions(token: string): Promise<{
  success: boolean;
  users?: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    academyLevel: 'none' | 'moderator' | 'editor';
    socialLevel: 'none' | 'moderator' | 'editor';
    permissions: PermissionFeatures;
  }>;
  error?: string;
}> {
  try {
    const response = await fetch('/api/users/permissions/list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro ao buscar usuários' };
    }

    // Transform users data to include permission levels
    const users = result.users.map((user: any) => ({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role,
      academyLevel: getAcademyPermissionLevel(user),
      socialLevel: getSocialPermissionLevel(user),
      permissions: user.access_permissions?.features || {}
    }));

    return { success: true, users };
  } catch (error) {
    console.error('Error fetching users with permissions:', error);
    return { success: false, error: 'Erro de conexão' };
  }
}

/**
 * Permission constants for easy reference
 */
export const PERMISSIONS = {
  ACADEMY: {
    EDITOR: 'academy_editor',
    MODERATOR: 'academy_moderator'
  },
  SOCIAL: {
    EDITOR: 'social_editor',
    MODERATOR: 'social_moderator'
  },
  NEWS: {
    EDITOR: 'news_editor',
    MANAGER: 'news_manager'
  },
  CONTRACTS: {
    MANAGE: 'contracts.manage',
    SIGN: 'contracts.sign'
  },
  FERIAS: {
    READ: 'ferias.read',
    CREATE: 'ferias.create',
    APPROVE: 'ferias.approve',
    MANAGE: 'ferias.manage',
    ADMIN: 'ferias.admin'
  },
  LISTA_PRESENCA: {
    READ: 'lista-presenca.read',
    CREATE: 'lista-presenca.create',
    MANAGE: 'lista-presenca.manage',
    ADMIN: 'lista-presenca.admin'
  },
  GESTAO_TRIPULANTES: {
    VIEW: 'gestao-tripulantes.view',
    MANAGE: 'gestao-tripulantes.manage',
    ADMIN: 'gestao-tripulantes.admin',
    MATRIZES_MANAGE: 'gestao-tripulantes.matrizes.manage',
    MATRIZES_VIEW: 'gestao-tripulantes.matrizes.view',
    DOCUMENTS_EDIT: 'gestao-tripulantes.documents.edit',
    DOCUMENTS_DELETE: 'gestao-tripulantes.documents.delete',
    DOCUMENTS_OCR: 'gestao-tripulantes.documents.ocr',
    BACK_SUGGEST: 'gestao-tripulantes.back.suggest',
    POLIWEB_SCRAPE: 'gestao-tripulantes.poliweb.scrape',
    NOTIFICATIONS_MANAGE: 'gestao-tripulantes.notifications.manage'
  },
  ESOCIAL: {
    VIEW: 'esocial.view',
    PREPARE: 'esocial.prepare',
    REVIEW: 'esocial.review',
    SEND: 'esocial.send',
    ADMIN: 'esocial.admin'
  }
} as const;

/**
 * Permission descriptions for UI
 */
export const PERMISSION_DESCRIPTIONS = {
  academy_editor: {
    title: 'Editor da Academy',
    description: 'Pode criar, editar e publicar cursos na ABZ Academy'
  },
  academy_moderator: {
    title: 'Moderador da Academy',
    description: 'Pode moderar comentários e avaliações dos cursos'
  },
  social_editor: {
    title: 'Editor Social',
    description: 'Pode criar posts oficiais e gerenciar conteúdo social'
  },
  social_moderator: {
    title: 'Moderador Social',
    description: 'Pode moderar posts, comentários e conteúdo social'
  },
  news_editor: {
    title: 'Editor de Notícias',
    description: 'Pode criar e editar notícias'
  },
  news_manager: {
    title: 'Gerente de Notícias',
    description: 'Pode gerenciar, publicar e excluir notícias'
  },
  'contracts.manage': {
    title: 'Gestor de Contratos',
    description: 'Pode fazer upload de documentos e definir posições de assinatura'
  },
  'contracts.sign': {
    title: 'Assinatura de Contratos',
    description: 'Pode assinar documentos atribuídos eletronicamente'
  },
  'ferias.read': {
    title: 'Visualizar Férias',
    description: 'Pode visualizar seus próprios pedidos de férias e saldo'
  },
  'ferias.create': {
    title: 'Solicitar Férias',
    description: 'Pode submeter pedidos de férias para aprovação'
  },
  'ferias.approve': {
    title: 'Aprovar Férias',
    description: 'Pode aprovar ou rejeitar pedidos de férias de subordinados'
  },
  'ferias.manage': {
    title: 'Gerenciar Férias',
    description: 'Pode gerenciar períodos aquisitivos, saldos e regras de férias'
  },
  'ferias.admin': {
    title: 'Administrador de Férias',
    description: 'Acesso total e configurações do módulo de férias'
  },
  'lista-presenca.read': {
    title: 'Visualizar Lista de Presença',
    description: 'Pode visualizar listas de presença e seus registros'
  },
  'lista-presenca.create': {
    title: 'Criar Lista de Presença',
    description: 'Pode criar novas listas de presença'
  },
  'lista-presenca.manage': {
    title: 'Gerenciar Lista de Presença',
    description: 'Pode gerenciar, fechar e assinar listas de presença'
  },
  'lista-presenca.admin': {
    title: 'Administrador de Listas',
    description: 'Acesso total e configurações de listas de presença'
  },
  // Gestão de Tripulantes
  'gestao-tripulantes.view': {
    title: 'Visualizar Gestão de Tripulantes',
    description: 'Pode visualizar o dashboard e tripulantes'
  },
  'gestao-tripulantes.manage': {
    title: 'Gerenciar Tripulantes',
    description: 'Pode gerenciar tripulantes e documentos'
  },
  'gestao-tripulantes.admin': {
    title: 'Admin Gestão de Tripulantes',
    description: 'Acesso total ao módulo de tripulantes'
  },
  'gestao-tripulantes.documents.edit': {
    title: 'Editar Documentos',
    description: 'Pode fazer upload e editar documentos'
  },
  'gestao-tripulantes.documents.delete': {
    title: 'Excluir Documentos',
    description: 'Pode excluir treinamentos, ASOs, documentos e passaportes do cadastro'
  },
  'gestao-tripulantes.documents.ocr': {
    title: 'Executar OCR',
    description: 'Pode executar OCR em documentos'
  },
  'gestao-tripulantes.back.suggest': {
    title: 'Sugerir Back',
    description: 'Pode usar algoritmo de sugestão de back'
  },
  'gestao-tripulantes.poliweb.scrape': {
    title: 'Scraping PoliWeb',
    description: 'Pode executar scraping no PoliWeb'
  },
  'gestao-tripulantes.notifications.manage': {
    title: 'Gerenciar Notificações',
    description: 'Pode enviar notificações para tripulantes'
  },
  // E-Social
  'esocial.view': {
    title: 'Visualizar Eventos',
    description: 'Pode visualizar eventos do E-Social'
  },
  'esocial.prepare': {
    title: 'Preparar Eventos',
    description: 'Pode preparar eventos para envio'
  },
  'esocial.review': {
    title: 'Revisar Eventos',
    description: 'Pode revisar e aprovar/rejeitar eventos'
  },
  'esocial.send': {
    title: 'Enviar Eventos',
    description: 'Pode enviar eventos para o E-Social'
  },
  'esocial.admin': {
    title: 'Admin E-Social',
    description: 'Acesso total ao módulo E-Social'
  }
} as const;

/**
 * Default permissions by role - mapped to all system modules
 * Modules: dashboard, noticias, calendario, ia-assistant, ponto, contracheque, reembolso, kpi, 
 *          avaliacao, epi, ferias, lista-presenca, contratos, academy, biblioteca, ajuda, 
 *          compras, poliweb, man-schedule, chat, wkradar, admin, integracao-erp,
 *          gestao-tripulantes, e-social
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, {
  modules: Record<string, boolean>;
  features: Partial<PermissionFeatures>;
}> = {
  ADMIN: {
    modules: getFullPermissionsForRole('ADMIN'),
    features: {
      academy_editor: true, academy_moderator: true,
      social_editor: true, social_moderator: true,
      'avaliacoes.metricas.read': true, 'avaliacoes.metricas.admin': true,
      'avaliacoes.relatorios.read': true, 'avaliacoes.relatorios.export': true,
      'avaliacoes.dashboard.config': true, 'avaliacoes.alertas.manage': true,
      'avaliacoes.analytics.advanced': true,
      'relatorios.pdf.read': true, 'relatorios.pdf.generate': true, 'relatorios.pdf.admin': true,
      'relatorios.templates.read': true, 'relatorios.templates.create': true, 'relatorios.templates.edit': true,
      'relatorios.historico.read': true, 'relatorios.historico.manage': true,
      'contracts.manage': true, 'contracts.sign': true,
      'api.mobile.admin': true, 'api.mobile.view': true, 'api.mobile.devices': true,
      'api.mobile.notifications': true, 'api.mobile.settings': true,
      'erp.view': true, 'erp.manage': true, 'erp.sync': true, 'erp.connections': true, 'erp.jobs': true,
      'bi.view': true, 'bi.create': true, 'bi.edit': true, 'bi.delete': true, 'bi.export': true, 'bi.admin': true,
      'workflows.view': true, 'workflows.create': true, 'workflows.edit': true, 'workflows.delete': true,
      'workflows.execute': true, 'workflows.admin': true,
      'chat.view': true, 'chat.send': true, 'chat.create_channels': true, 'chat.manage_channels': true,
      'chat.delete_messages': true, 'chat.admin': true,
      news_editor: true, news_manager: true,
      'ferias.read': true, 'ferias.create': true, 'ferias.approve': true, 'ferias.manage': true, 'ferias.admin': true,
      'lista-presenca.read': true, 'lista-presenca.create': true, 'lista-presenca.manage': true, 'lista-presenca.admin': true,
      'gestao-tripulantes.view': true, 'gestao-tripulantes.manage': true, 'gestao-tripulantes.admin': true,
      'gestao-tripulantes.documents.edit': true, 'gestao-tripulantes.documents.delete': true, 'gestao-tripulantes.documents.ocr': true,
      'gestao-tripulantes.back.suggest': true, 'gestao-tripulantes.poliweb.scrape': true,
      'gestao-tripulantes.notifications.manage': true,
      'esocial.view': true, 'esocial.prepare': true, 'esocial.review': true, 'esocial.send': true, 'esocial.admin': true
    }
  },
  MANAGER: {
    modules: getFullPermissionsForRole('MANAGER'),
    features: {
      academy_editor: false, academy_moderator: true,
      social_editor: false, social_moderator: true,
      'avaliacoes.metricas.read': true, 'avaliacoes.metricas.admin': false,
      'avaliacoes.relatorios.read': true, 'avaliacoes.relatorios.export': true,
      'avaliacoes.dashboard.config': false, 'avaliacoes.alertas.manage': false,
      'avaliacoes.analytics.advanced': true,
      'relatorios.pdf.read': true, 'relatorios.pdf.generate': true, 'relatorios.pdf.admin': false,
      'relatorios.templates.read': true, 'relatorios.templates.create': false, 'relatorios.templates.edit': false,
      'relatorios.historico.read': true, 'relatorios.historico.manage': false,
      'contracts.manage': true, 'contracts.sign': true,
      'api.mobile.view': true,
      'erp.view': true, 'erp.sync': true,
      'bi.view': true,
      'workflows.view': true, 'workflows.execute': true,
      'chat.view': true, 'chat.send': true,
      news_editor: false, news_manager: false,
      'ferias.read': true, 'ferias.create': true, 'ferias.approve': true, 'ferias.manage': false, 'ferias.admin': false,
      'lista-presenca.read': true, 'lista-presenca.create': true, 'lista-presenca.manage': true, 'lista-presenca.admin': false,
      'gestao-tripulantes.view': true, 'gestao-tripulantes.manage': true,
      'gestao-tripulantes.documents.edit': true, 'gestao-tripulantes.documents.delete': true, 'gestao-tripulantes.back.suggest': true,
      'esocial.view': true
    }
  },
  USER: {
    modules: getFullPermissionsForRole('USER'),
    features: {
      academy_editor: false, academy_moderator: false,
      social_editor: false, social_moderator: false,
      'avaliacoes.metricas.read': false, 'avaliacoes.metricas.admin': false,
      'avaliacoes.relatorios.read': false, 'avaliacoes.relatorios.export': false,
      'avaliacoes.dashboard.config': false, 'avaliacoes.alertas.manage': false,
      'avaliacoes.analytics.advanced': false,
      'relatorios.pdf.read': false, 'relatorios.pdf.generate': false, 'relatorios.pdf.admin': false,
      'relatorios.templates.read': false, 'relatorios.templates.create': false, 'relatorios.templates.edit': false,
      'relatorios.historico.read': false, 'relatorios.historico.manage': false,
      'contracts.manage': false, 'contracts.sign': true,
      'api.mobile.view': true,
      'erp.view': false, 'erp.sync': false,
      'bi.view': false,
      'workflows.view': false, 'workflows.execute': false,
      'chat.view': true, 'chat.send': true,
      news_editor: false, news_manager: false,
      'ferias.read': true, 'ferias.create': true, 'ferias.approve': false, 'ferias.manage': false, 'ferias.admin': false,
      'lista-presenca.read': true, 'lista-presenca.create': true, 'lista-presenca.manage': false, 'lista-presenca.admin': false
    }
  }
};
