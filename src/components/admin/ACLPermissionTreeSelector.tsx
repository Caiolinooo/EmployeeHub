'use client';

import React, { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronRight, FiCheck, FiX, FiShield, FiKey } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { getAclResourceLabel } from '@/config/modules';

interface ACLPermission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  level: number;
  enabled: boolean;
}

interface ACLPermissionTreeSelectorProps {
  selectedPermissions: string[];
  onPermissionChange: (permissionIds: string[]) => void;
  userRole: string;
  showRolePermissions?: boolean;
  rolePermissions?: string[];
  disabled?: boolean;
}

interface PermissionTreeNode {
  key: string;
  name: string;
  children: PermissionTreeNode[];
  permissions: ACLPermission[];
}

const ACLPermissionTreeSelector: React.FC<ACLPermissionTreeSelectorProps> = ({
  selectedPermissions,
  onPermissionChange,
  userRole,
  showRolePermissions = false,
  rolePermissions = [],
  disabled = false
}) => {
  const { t } = useI18n();
  const [permissions, setPermissions] = useState<ACLPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  // Carregar permissões ACL
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/acl/permissions');
        if (response.ok) {
          const data = await response.json();
          setPermissions(data);
        }
      } catch (error) {
        console.error('[ACLPermissionTreeSelector] Erro ao carregar permissões:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPermissions();
  }, []);

  // Construir árvore de permissões por recurso
  const buildTree = (perms: ACLPermission[]): PermissionTreeNode[] => {
    const resourceMap = new Map<string, PermissionTreeNode>();
    perms.forEach(perm => {
      if (!resourceMap.has(perm.resource)) {
        resourceMap.set(perm.resource, {
          key: perm.resource,
          name: getAclResourceLabel(perm.resource),
          children: [],
          permissions: []
        });
      }
      const node = resourceMap.get(perm.resource)!;
      node.permissions.push(perm);
    });

    return Array.from(resourceMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const tree = buildTree(permissions);

  // Toggle resource expansion
  const toggleResource = (resourceKey: string) => {
    setExpandedResources(prev => {
      const next = new Set(prev);
      if (next.has(resourceKey)) {
        next.delete(resourceKey);
      } else {
        next.add(resourceKey);
      }
      return next;
    });
  };

  // Check if permission is selected
  const isSelected = (permId: string) => selectedPermissions.includes(permId);

  // Check if permission is granted by role
  const isGrantedByRole = (permId: string) => {
    if (userRole === 'ADMIN') return true;
    return rolePermissions.includes(permId);
  };

  // Toggle permission selection
  const togglePermission = (permId: string) => {
    if (disabled) return;
    
    const current = selectedPermissions;
    const updated = current.includes(permId)
      ? current.filter(id => id !== permId)
      : [...current, permId];
    
    onPermissionChange(updated);
  };

  // Check if all permissions in a resource are selected
  const isResourceFullySelected = (resourcePerms: ACLPermission[]) => {
    return resourcePerms.length > 0 && resourcePerms.every(p => selectedPermissions.includes(p.id));
  };

  // Check if any permission in a resource is selected
  const isResourcePartiallySelected = (resourcePerms: ACLPermission[]) => {
    return resourcePerms.some(p => selectedPermissions.includes(p.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
        <span className="ml-2 text-green-700 text-sm">Carregando permissões ACL...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center text-green-800">
          <FiKey className="mr-2" />
          <span className="text-sm font-medium">
            {selectedPermissions.length} permissão(ões) selecionada(s)
          </span>
        </div>
        {selectedPermissions.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onPermissionChange([]);
            }}
            className="text-xs text-green-700 hover:text-green-900 underline"
          >
            Limpar seleção
          </button>
        )}
      </div>

      {/* Permission Tree */}
      <div className="border border-green-200 rounded-lg bg-white max-h-80 overflow-y-auto">
        {tree.map((resource) => (
          <div key={resource.key} className="border-b border-green-100 last:border-b-0">
            {/* Resource Header */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                toggleResource(resource.key);
              }}
              className={`w-full flex items-center justify-between p-3 text-left hover:bg-green-50 transition-colors ${
                isResourcePartiallySelected(resource.permissions) ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex items-center">
                {expandedResources.has(resource.key) ? (
                  <FiChevronDown className="w-4 h-4 text-green-600 mr-2" />
                ) : (
                  <FiChevronRight className="w-4 h-4 text-green-600 mr-2" />
                )}
                <FiShield className="w-4 h-4 text-green-600 mr-2" />
                <span className="font-medium text-green-900">{resource.name}</span>
                <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  {resource.permissions.length}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {isResourceFullySelected(resource.permissions) && (
                  <FiCheck className="w-4 h-4 text-green-600" />
                )}
                {!isResourceFullySelected(resource.permissions) && isResourcePartiallySelected(resource.permissions) && (
                  <div className="w-4 h-4 border-2 border-green-600 rounded-sm bg-green-600" />
                )}
              </div>
            </button>

            {/* Permissions List */}
            {expandedResources.has(resource.key) && (
              <div className="pl-10 pr-3 pb-2 space-y-1">
                {resource.permissions.map((perm) => (
                  <label
                    key={perm.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                      isSelected(perm.id)
                        ? 'bg-green-100 text-green-900'
                        : isGrantedByRole(perm.id)
                        ? 'hover:bg-gray-50 text-gray-700'
                        : 'hover:bg-gray-50 text-gray-500'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center flex-1">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePermission(perm.id);
                        }}
                        className={`w-4 h-4 border-2 rounded flex items-center justify-center mr-2 flex-shrink-0 cursor-pointer transition-colors ${
                          isSelected(perm.id)
                            ? 'bg-green-600 border-green-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected(perm.id) && <FiCheck className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium">{perm.name}</span>
                        {perm.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{perm.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        perm.level === 0 ? 'bg-blue-100 text-blue-800' :
                        perm.level === 1 ? 'bg-yellow-100 text-yellow-800' :
                        perm.level === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Nível {perm.level}
                      </span>
                      {isGrantedByRole(perm.id) && !isSelected(perm.id) && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          Por Role
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Empty state */}
        {tree.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Nenhuma permissão ACL configurada.
          </div>
        )}
      </div>

      {/* Role permissions info */}
      {showRolePermissions && isGrantedByRole(permissions[0]?.id || '') && (
        <div className="text-xs text-green-600 bg-green-50 p-3 rounded border border-green-200">
          <strong>Nota:</strong> Você está visualizando permissões baseadas no role "{userRole}".
          As permissões individuais são adicionais às permissões do role.
        </div>
      )}
    </div>
  );
};

export default ACLPermissionTreeSelector;
