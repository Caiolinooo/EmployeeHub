'use client';

import React, { useState, useEffect } from 'react';
import { useAllUsers } from '@/hooks/useAllUsers';
import { useI18n } from '@/contexts/I18nContext';
import { FiShield, FiUsers, FiKey, FiPlus, FiEdit, FiTrash2, FiCheck, FiX, FiInfo } from 'react-icons/fi';

interface ACLPermission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  level: number;
  enabled: boolean;
}

interface UserPermission {
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
  individual_permissions: Array<{
    permission: ACLPermission;
    granted_at: string;
    expires_at?: string;
  }>;
  role_permissions: Array<{
    permission: ACLPermission;
  }>;
}

const ACLManagementPanel: React.FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'permissions' | 'roles' | 'users'>('permissions');
  const [permissions, setPermissions] = useState<ACLPermission[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { users: hookUsers, loading: usersLoading } = useAllUsers();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPermission, setEditingPermission] = useState<ACLPermission | null>(null);

  // Form state para nova permissão
  const [newPermission, setNewPermission] = useState({
    name: '',
    description: '',
    resource: '',
    action: '',
    level: 0
  });

  // Carregar permissões
  const loadPermissions = async () => {
    try {
      const response = await fetch('/api/acl/permissions');
      const data = await response.json();
      if (response.ok) {
        setPermissions(data);
      }
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  // Unificar lista de usuários a partir do hook
  useEffect(() => {
    if (Array.isArray(hookUsers)) {
      setUsers(hookUsers as any);
    }
  }, [hookUsers]);

  // Criar nova permissão
  const createPermission = async () => {
    try {
      const response = await fetch('/api/acl/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPermission)
      });

      if (response.ok) {
        await loadPermissions();
        setShowCreateModal(false);
        setNewPermission({
          name: '',
          description: '',
          resource: '',
          action: '',
          level: 0
        });
      }
    } catch (error) {
      console.error('Erro ao criar permissão:', error);
    }
  };

  useEffect(() => {
    loadPermissions();
    setLoading(false);
  }, []);

  const tabs = [
    {
      id: 'permissions',
      label: t('acl.permissions', 'Permissões'),
      icon: FiKey,
      description: t('acl.managePermissions', 'Gerenciar permissões ACL')
    },
    {
      id: 'roles',
      label: t('acl.roles', 'Roles'),
      icon: FiUsers,
      description: t('acl.configureRoles', 'Configurar permissões por role')
    },
    {
      id: 'users',
      label: t('acl.users', 'Usuários'),
      icon: FiShield,
      description: t('acl.individualPermissions', 'Permissões individuais')
    }
  ];

  const resources = ['news', 'comments', 'notifications', 'reminders', 'admin'];
  const actions = ['read', 'create', 'update', 'delete', 'publish', 'moderate', 'send', 'manage'];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">{t('common.loading', 'Carregando...')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento ACL</h1>
          <p className="text-gray-600">Controle de acesso hierárquico avançado</p>
        </div>
        {activeTab === 'permissions' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            <span>Nova Permissão</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {activeTab === 'permissions' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Permissões ACL ({permissions.length})</h3>
            
            {/* Estatísticas */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {resources.map(resource => {
                const count = permissions.filter(p => p.resource === resource).length;
                return (
                  <div key={resource} className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{count}</div>
                    <div className="text-sm text-gray-500 capitalize">{resource}</div>
                  </div>
                );
              })}
            </div>

            {/* Lista de Permissões */}
            <div className="space-y-2">
              {permissions.map(permission => (
                <div key={permission.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium text-gray-900">{permission.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        permission.level === 0 ? 'bg-green-100 text-green-800' :
                        permission.level === 1 ? 'bg-yellow-100 text-yellow-800' :
                        permission.level === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Nível {permission.level}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        {permission.resource}.{permission.action}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{permission.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingPermission(permission)}
                      className="p-2 text-gray-400 hover:text-blue-600 rounded"
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-600 rounded">
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Permissões por Role</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['ADMIN', 'MANAGER', 'USER'].map(role => {
                const rolePermissions = permissions.filter(p => {
                  // Lógica para determinar quais permissões cada role tem
                  if (role === 'ADMIN') return true;
                  if (role === 'MANAGER') return p.level <= 2;
                  if (role === 'USER') return p.level === 0;
                  return false;
                });

                return (
                  <div key={role} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">{role}</h4>
                      <span className="text-sm text-gray-500">
                        {rolePermissions.length} permissões
                      </span>
                    </div>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {rolePermissions.map(permission => (
                        <div key={permission.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{permission.name}</span>
                          <FiCheck className="w-4 h-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Permissões de Usuários</h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <FiInfo className="w-5 h-5 text-blue-500 mr-2" />
                <span className="text-blue-700">
                  Use o editor de usuários no painel administrativo para gerenciar permissões individuais.
                </span>
              </div>
            </div>

            <div className="text-center py-8">
              <FiUsers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Gerenciamento de Usuários</h3>
              <p className="text-gray-500 mb-4">
                Para gerenciar permissões individuais de usuários, acesse o painel de gerenciamento de usuários.
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Ir para Gerenciamento de Usuários
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Criar Permissão */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Nova Permissão ACL</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Permissão
                </label>
                <input
                  type="text"
                  value={newPermission.name}
                  onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ex: news.create"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={newPermission.description}
                  onChange={(e) => setNewPermission({ ...newPermission, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Descrição da permissão"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recurso
                  </label>
                  <select
                    value={newPermission.resource}
                    onChange={(e) => setNewPermission({ ...newPermission, resource: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione</option>
                    {resources.map(resource => (
                      <option key={resource} value={resource}>{resource}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ação
                  </label>
                  <select
                    value={newPermission.action}
                    onChange={(e) => setNewPermission({ ...newPermission, action: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione</option>
                    {actions.map(action => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nível Hierárquico
                </label>
                <select
                  value={newPermission.level}
                  onChange={(e) => setNewPermission({ ...newPermission, level: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Nível 0 - Básico (USER)</option>
                  <option value={1}>Nível 1 - Intermediário</option>
                  <option value={2}>Nível 2 - Avançado (MANAGER)</option>
                  <option value={3}>Nível 3 - Administrativo (ADMIN)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={createPermission}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Criar Permissão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ACLManagementPanel;
