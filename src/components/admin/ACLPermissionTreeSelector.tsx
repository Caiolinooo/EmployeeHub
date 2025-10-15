'use client';

import React, { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronRight, FiCheck, FiMinus, FiPlus, FiInfo } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface ACLPermission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  level: number;
  enabled: boolean;
  children?: ACLPermission[];
}

interface PermissionResource {
  resource: string;
  label: string;
  permissions: ACLPermission[];
}

interface ACLPermissionTreeSelectorProps {
  selectedPermissions: string[]; // IDs das permissões selecionadas
  onPermissionChange: (permissionIds: string[]) => void;
  userRole?: string;
  showRolePermissions?: boolean;
  rolePermissions?: string[]; // IDs das permissões do role
  disabled?: boolean;
}

const ACLPermissionTreeSelector: React.FC<ACLPermissionTreeSelectorProps> = ({
  selectedPermissions,
  onPermissionChange,
  userRole,
  showRolePermissions = true,
  rolePermissions = [],
  disabled = false
}) => {
  const { t } = useI18n();
  const [permissionTree, setPermissionTree] = useState<{ [key: string]: PermissionResource }>({});
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Carregar árvore de permissões
  useEffect(() => {
    loadPermissionTree();
  }, []);

  const loadPermissionTree = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/acl/permissions?format=tree');
      const tree = await response.json();
      setPermissionTree(tree);
      
      // Expandir todos os recursos por padrão
      setExpandedResources(new Set(Object.keys(tree)));
    } catch (error) {
      console.error(t('components.erroAoCarregarArvoreDePermissoes'), error);
    } finally {
      setLoading(false);
    }
  };

  const toggleResource = (resource: string) => {
    const newExpanded = new Set(expandedResources);
    if (newExpanded.has(resource)) {
      newExpanded.delete(resource);
    } else {
      newExpanded.add(resource);
    }
    setExpandedResources(newExpanded);
  };

  const handlePermissionToggle = (permissionId: string) => {
    if (disabled) return;

    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    onPermissionChange(Array.from(newSelected));
  };

  const getPermissionState = (permissionId: string) => {
    const isSelected = selectedPermissions.includes(permissionId);
    const isFromRole = rolePermissions.includes(permissionId);
    
    if (isSelected) return 'selected';
    if (isFromRole && showRolePermissions) return 'role';
    return 'none';
  };

  const renderPermission = (permission: ACLPermission, depth: number = 0) => {
    const state = getPermissionState(permission.id);
    const isSelected = state === 'selected';
    const isFromRole = state === 'role';
    const hasChildren = permission.children && permission.children.length > 0;

    return (
      <div key={permission.id} className="select-none">
        <div 
          className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
          } ${isSelected ? 'bg-blue-50 border border-blue-200' : ''} ${
            isFromRole ? 'bg-green-50 border border-green-200' : ''
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
          onClick={() => handlePermissionToggle(permission.id)}
        >
          {/* Checkbox/Indicator */}
          <div className="flex items-center justify-center w-5 h-5 mr-3">
            {isSelected ? (
              <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                <FiCheck className="w-3 h-3 text-white" />
              </div>
            ) : isFromRole ? (
              <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
                <FiCheck className="w-3 h-3 text-white" />
              </div>
            ) : (
              <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
            )}
          </div>

          {/* Permission Info */}
          <div className="flex-1">
            <div className="flex items-center">
              <span className={`font-medium ${
                isSelected ? 'text-blue-900' : isFromRole ? 'text-green-900' : 'text-gray-900'
              }`}>
                {permission.name}
              </span>
              
              {/* Level Badge */}
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                permission.level === 0 ? 'bg-gray-100 text-gray-600' :
                permission.level === 1 ? 'bg-yellow-100 text-yellow-700' :
                permission.level === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                Nível {permission.level}
              </span>

              {/* Role Badge */}
              {isFromRole && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                  Por Role
                </span>
              )}
            </div>
            
            {permission.description && (
              <p className="text-sm text-gray-500 mt-1">{permission.description}</p>
            )}
          </div>

          {/* Info Icon */}
          <div className="ml-2">
            <FiInfo className="w-4 h-4 text-gray-400" title={`Recurso: ${permission.resource} | Ação: ${permission.action}`} />
          </div>
        </div>

        {/* Children */}
        {hasChildren && (
          <div className="mt-1">
            {permission.children!.map(child => renderPermission(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando permissões...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Permissões ACL</h3>
        {showRolePermissions && userRole && (
          <span className="text-sm text-gray-500">
            Role: <span className="font-medium">{userRole}</span>
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
          <span>Permissão Individual</span>
        </div>
        {showRolePermissions && (
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-600 rounded mr-2"></div>
            <span>Permissão por Role</span>
          </div>
        )}
        <div className="flex items-center">
          <div className="w-4 h-4 border-2 border-gray-300 rounded mr-2"></div>
          <span>Sem Permissão</span>
        </div>
      </div>

      {/* Permission Tree */}
      <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
        {Object.entries(permissionTree).map(([resourceKey, resourceData]) => (
          <div key={resourceKey} className="border-b border-gray-100 last:border-b-0">
            {/* Resource Header */}
            <div 
              className="flex items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleResource(resourceKey)}
            >
              {expandedResources.has(resourceKey) ? (
                <FiChevronDown className="w-4 h-4 text-gray-500 mr-2" />
              ) : (
                <FiChevronRight className="w-4 h-4 text-gray-500 mr-2" />
              )}
              <h4 className="font-medium text-gray-900">{resourceData.label}</h4>
              <span className="ml-2 text-sm text-gray-500">
                ({resourceData.permissions.length} permissões)
              </span>
            </div>

            {/* Resource Permissions */}
            {expandedResources.has(resourceKey) && (
              <div className="p-2">
                {resourceData.permissions.map(permission => renderPermission(permission))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
        <strong>Resumo:</strong> {selectedPermissions.length} permissões individuais selecionadas
        {showRolePermissions && rolePermissions.length > 0 && (
          <span>, {rolePermissions.length} permissões herdadas do role {userRole}</span>
        )}
      </div>
    </div>
  );
};

export default ACLPermissionTreeSelector;
