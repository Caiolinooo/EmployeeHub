'use client';

import { useState, useEffect, useCallback } from 'react';

interface ACLPermission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  level: number;
  enabled: boolean;
}

interface UserPermissions {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  individual_permissions: Array<{
    id: string;
    permission: ACLPermission;
    granted_at: string;
    expires_at?: string;
    is_expired: boolean;
  }>;
  role_permissions: Array<{
    id: string;
    permission: ACLPermission;
  }>;
  effective_permissions: ACLPermission[];
}

interface PermissionCheckResult {
  hasPermission: boolean;
  reason: string;
  user_role: string;
  permission_source: string;
}

export function useACLPermissions(userId?: string) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar permissões do usuário
  const loadUserPermissions = useCallback(async (targetUserId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/acl/users/${targetUserId}/permissions`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar permissões do usuário');
      }

      const data = await response.json();
      
      // Calcular permissões efetivas (individual + role, sem duplicatas)
      const effectivePermissions = new Map<string, ACLPermission>();
      
      // Adicionar permissões por role
      data.role_permissions.forEach((rp: any) => {
        effectivePermissions.set(rp.permission.id, rp.permission);
      });
      
      // Adicionar permissões individuais (sobrescreve role se houver conflito)
      data.individual_permissions.forEach((up: any) => {
        if (!up.is_expired) {
          effectivePermissions.set(up.permission.id, up.permission);
        }
      });
      
      data.effective_permissions = Array.from(effectivePermissions.values());
      
      setPermissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificar permissão específica
  const checkPermission = useCallback(async (
    targetUserId: string,
    permissionName?: string,
    resource?: string,
    action?: string
  ): Promise<PermissionCheckResult | null> => {
    try {
      const params = new URLSearchParams({
        user_id: targetUserId,
        ...(permissionName && { permission: permissionName }),
        ...(resource && { resource }),
        ...(action && { action })
      });

      const response = await fetch(`/api/acl/check?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao verificar permissão');
      }

      return await response.json();
    } catch (err) {
      console.error('Erro ao verificar permissão:', err);
      return null;
    }
  }, []);

  // Atribuir permissão a usuário
  const grantPermission = useCallback(async (
    targetUserId: string,
    permissionId: string,
    expiresAt?: string,
    grantedBy?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/acl/users/${targetUserId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permission_id: permissionId,
          expires_at: expiresAt,
          granted_by: grantedBy
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atribuir permissão');
      }

      // Recarregar permissões do usuário
      if (targetUserId === userId) {
        await loadUserPermissions(targetUserId);
      }

      return true;
    } catch (err) {
      console.error('Erro ao atribuir permissão:', err);
      return false;
    }
  }, [userId, loadUserPermissions]);

  // Remover permissão de usuário
  const revokePermission = useCallback(async (
    targetUserId: string,
    permissionId: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/acl/users/${targetUserId}/permissions?permission_id=${permissionId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao remover permissão');
      }

      // Recarregar permissões do usuário
      if (targetUserId === userId) {
        await loadUserPermissions(targetUserId);
      }

      return true;
    } catch (err) {
      console.error('Erro ao remover permissão:', err);
      return false;
    }
  }, [userId, loadUserPermissions]);

  // Verificar se usuário tem permissão (usando dados carregados)
  const hasPermission = useCallback((permissionName: string): boolean => {
    if (!permissions) return false;
    
    // Administradores têm acesso a tudo
    if (permissions.user.role === 'ADMIN') return true;
    
    // Verificar nas permissões efetivas
    return permissions.effective_permissions.some(p => p.name === permissionName);
  }, [permissions]);

  // Verificar se usuário tem permissão por recurso e ação
  const hasResourcePermission = useCallback((resource: string, action: string): boolean => {
    if (!permissions) return false;
    
    // Administradores têm acesso a tudo
    if (permissions.user.role === 'ADMIN') return true;
    
    // Verificar nas permissões efetivas
    return permissions.effective_permissions.some(p => 
      p.resource === resource && p.action === action
    );
  }, [permissions]);

  // Obter permissões por recurso
  const getPermissionsByResource = useCallback((resource: string): ACLPermission[] => {
    if (!permissions) return [];
    
    return permissions.effective_permissions.filter(p => p.resource === resource);
  }, [permissions]);

  // Carregar permissões automaticamente se userId for fornecido
  useEffect(() => {
    if (userId) {
      loadUserPermissions(userId);
    }
  }, [userId, loadUserPermissions]);

  return {
    permissions,
    loading,
    error,
    loadUserPermissions,
    checkPermission,
    grantPermission,
    revokePermission,
    hasPermission,
    hasResourcePermission,
    getPermissionsByResource,
    // Helpers para verificações comuns
    canCreateNews: hasPermission('news.create'),
    canPublishNews: hasPermission('news.publish'),
    canModerateComments: hasPermission('comments.moderate'),
    canSendNotifications: hasPermission('notifications.send'),
    canManageReminders: hasPermission('reminders.manage'),
    isAdmin: permissions?.user.role === 'ADMIN',
    isManager: permissions?.user.role === 'MANAGER'
  };
}
