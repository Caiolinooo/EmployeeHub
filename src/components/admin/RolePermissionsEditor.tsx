'use client';

import React, { useState, useEffect } from 'react';
import { FiUsers, FiSave, FiRefreshCw, FiCheck, FiX, FiSettings } from 'react-icons/fi';

interface Module {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface RolePermissions {
  modules: Record<string, boolean>;
  features: Record<string, boolean>;
}

interface RolePermissionsData {
  [role: string]: RolePermissions;
}

interface RolePermissionsEditorProps {
  onClose?: () => void;
}

const RolePermissionsEditor: React.FC<RolePermissionsEditorProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableModules, setAvailableModules] = useState<Module[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsData>({});
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MANAGER' | 'USER'>('USER');

  const roles = [
    { id: 'ADMIN', label: 'Administrador', description: 'Acesso total ao sistema' },
    { id: 'MANAGER', label: 'Gerente', description: 'Acesso gerencial com algumas restrições' },
    { id: 'USER', label: 'Usuário', description: 'Acesso básico do funcionário' }
  ];

  // Carregar módulos disponíveis e permissões por role
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar módulos disponíveis
      const modulesResponse = await fetch('/api/admin/available-modules');
      const modules = await modulesResponse.json();
      setAvailableModules(modules);

      // Carregar permissões por role
      const permissionsResponse = await fetch('/api/admin/role-permissions');
      const permissions = await permissionsResponse.json();
      setRolePermissions(permissions);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleChange = (moduleId: string, enabled: boolean) => {
    setRolePermissions(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        modules: {
          ...prev[selectedRole]?.modules,
          [moduleId]: enabled
        }
      }
    }));
  };

  const handleFeatureChange = (featureId: string, enabled: boolean) => {
    setRolePermissions(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        features: {
          ...prev[selectedRole]?.features,
          [featureId]: enabled
        }
      }
    }));
  };

  const saveRolePermissions = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/admin/role-permissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: selectedRole,
          permissions: rolePermissions[selectedRole]
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar permissões');
      }

      alert('Permissões salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      alert('Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  const currentPermissions = rolePermissions[selectedRole] || { modules: {}, features: {} };

  // Garantir que features sempre existe
  const safeFeatures = currentPermissions.features || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <FiRefreshCw className="animate-spin h-6 w-6 text-blue-600 mr-2" />
        <span>Carregando permissões...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FiSettings className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Permissões por Role</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FiX className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Seletor de Role */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione o Role para Editar
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id as any)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedRole === role.id
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{role.label}</div>
              <div className="text-sm text-gray-500">{role.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Módulos do Sistema */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Módulos do Sistema</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure quais módulos os usuários com role <strong>{selectedRole}</strong> podem acessar.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableModules.map((module) => (
            <div key={module.id} className="flex items-center p-3 border rounded-lg">
              <input
                type="checkbox"
                id={`module-${module.id}`}
                checked={currentPermissions.modules[module.id] || false}
                onChange={(e) => handleModuleChange(module.id, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="ml-3">
                <label htmlFor={`module-${module.id}`} className="block text-sm font-medium text-gray-900">
                  {module.label}
                </label>
                <p className="text-xs text-gray-500">{module.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissões Especiais */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Permissões Especiais</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure permissões especiais para funcionalidades específicas.
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Aprovar Reembolsos</div>
              <div className="text-sm text-gray-500">Permite aprovar ou rejeitar solicitações de reembolso</div>
            </div>
            <input
              type="checkbox"
              checked={safeFeatures.reimbursement_approval || false}
              onChange={(e) => handleFeatureChange('reimbursement_approval', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Visualizar Reembolsos</div>
              <div className="text-sm text-gray-500">Permite visualizar solicitações de reembolso</div>
            </div>
            <input
              type="checkbox"
              checked={safeFeatures.reimbursement_view || false}
              onChange={(e) => handleFeatureChange('reimbursement_view', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Editar Configurações de Reembolso</div>
              <div className="text-sm text-gray-500">Permite editar configurações do sistema de reembolso</div>
            </div>
            <input
              type="checkbox"
              checked={safeFeatures.reimbursement_edit || false}
              onChange={(e) => handleFeatureChange('reimbursement_edit', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex justify-between">
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Recarregar
        </button>
        
        <button
          onClick={saveRolePermissions}
          disabled={saving}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? (
            <FiRefreshCw className="animate-spin h-4 w-4 mr-2" />
          ) : (
            <FiSave className="h-4 w-4 mr-2" />
          )}
          {saving ? 'Salvando...' : 'Salvar Permissões'}
        </button>
      </div>
    </div>
  );
};

export default RolePermissionsEditor;
