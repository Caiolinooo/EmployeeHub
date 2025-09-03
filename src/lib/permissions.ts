// Utilities for Academy and Social permissions

export interface PermissionFeatures {
  academy_editor?: boolean;
  academy_moderator?: boolean;
  social_editor?: boolean;
  social_moderator?: boolean;
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
}

/**
 * Check if user has a specific feature permission
 */
export function hasFeaturePermission(
  user: AppUserLike | null,
  feature: keyof PermissionFeatures
): boolean {
  if (!user) return false;

  // Admins have all permissions
  if (user.role === 'ADMIN') return true;

  // Check in access_permissions.features (support both camelCase and snake_case)
  const permissions = user.access_permissions || user.accessPermissions;
  return !!permissions?.features?.[feature];
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
  }
} as const;

/**
 * Default permissions by role
 */
export const DEFAULT_PERMISSIONS_BY_ROLE = {
  ADMIN: {
    academy_editor: true,
    academy_moderator: true,
    social_editor: true,
    social_moderator: true
  },
  MANAGER: {
    academy_editor: false,
    academy_moderator: true,
    social_editor: false,
    social_moderator: true
  },
  USER: {
    academy_editor: false,
    academy_moderator: false,
    social_editor: false,
    social_moderator: false
  }
} as const;
