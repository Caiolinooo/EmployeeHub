'use client';

import React, { useState, useEffect } from 'react';
import { FiUsers, FiUserCheck, FiUserX, FiShield, FiLock, FiUnlock } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface User {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  role: string;
  department?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  members: number;
}

interface CardAccessControlProps {
  adminOnly: boolean;
  managerOnly: boolean;
  allowedRoles: string[];
  allowedUserIds: string[];
  onAccessChange: (access: {
    adminOnly: boolean;
    managerOnly: boolean;
    allowedRoles: string[];
    allowedUserIds: string[];
  }) => void;
}

export default function CardAccessControl({
  adminOnly,
  managerOnly,
  allowedRoles = [],
  allowedUserIds = [],
  onAccessChange,
}: CardAccessControlProps) {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'users' | 'groups'>('users');

  // Estado local para as permissões
  const [localAdminOnly, setLocalAdminOnly] = useState(adminOnly);
  const [localManagerOnly, setLocalManagerOnly] = useState(managerOnly);
  const [localAllowedRoles, setLocalAllowedRoles] = useState<string[]>(allowedRoles);
  const [localAllowedUserIds, setLocalAllowedUserIds] = useState<string[]>(allowedUserIds);

  // Carregar usuários e grupos
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error(t('components.erroAoCarregarUsuarios'), error);
      }
    };

    const fetchGroups = async () => {
      try {
        // Grupos predefinidos baseados em roles
        setGroups([
          { id: 'admin', name: 'Administradores', description: 'Acesso total ao sistema', members: 0 },
          { id: 'manager', name: 'Gerentes', description: 'Acesso de gerenciamento', members: 0 },
          { id: 'user', name: t('components.usuarios'), description: t('components.acessoBasico'), members: 0 },
          // Adicione outros grupos conforme necessário
        ]);
      } catch (error) {
        console.error('Erro ao carregar grupos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    fetchGroups();
  }, []);

  // Atualizar permissões quando os valores locais mudarem
  useEffect(() => {
    onAccessChange({
      adminOnly: localAdminOnly,
      managerOnly: localManagerOnly,
      allowedRoles: localAllowedRoles,
      allowedUserIds: localAllowedUserIds,
    });
  }, [localAdminOnly, localManagerOnly, localAllowedRoles, localAllowedUserIds, onAccessChange]);

  // Filtrar usuários com base no termo de pesquisa
  const filteredUsers = users.filter(user => {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || '';
    const searchFields = [
      fullName,
      user.email || '',
      user.phoneNumber || '',
      user.department || '',
    ].map(field => field.toLowerCase());

    return searchTerm === '' || searchFields.some(field => field.includes(searchTerm.toLowerCase()));
  });

  // Alternar seleção de usuário
  const toggleUserSelection = (userId: string) => {
    setLocalAllowedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Alternar seleção de grupo (role)
  const toggleGroupSelection = (roleId: string) => {
    setLocalAllowedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  // Alternar acesso exclusivo para administradores
  const toggleAdminOnly = () => {
    const newValue = !localAdminOnly;
    setLocalAdminOnly(newValue);

    // Se ativar adminOnly, desativa managerOnly
    if (newValue) {
      setLocalManagerOnly(false);
    }
  };

  // Alternar acesso exclusivo para gerentes
  const toggleManagerOnly = () => {
    const newValue = !localManagerOnly;
    setLocalManagerOnly(newValue);

    // Se ativar managerOnly, desativa adminOnly
    if (newValue) {
      setLocalAdminOnly(false);
    }
  };

  // Obter nome de exibição do usuário
  const getUserDisplayName = (user: User) => {
    if (user.name) return user.name;
    if (user.firstName || user.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(' ');
    }
    return user.email || user.phoneNumber || t('components.usuarioSemNome');
  };

  return (
    <div className="mt-4 border border-gray-200 rounded-md p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <FiLock className="mr-2" />
        {t('admin.accessControl')}
      </h3>

      {/* Opções de acesso rápido */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleAdminOnly}
          className={`px-3 py-1.5 rounded-md text-sm flex items-center ${
            localAdminOnly
              ? 'bg-red-100 text-red-800 border border-red-300'
              : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
          }`}
        >
          {localAdminOnly ? <FiLock className="mr-1" /> : <FiUnlock className="mr-1" />}
          {t('admin.adminOnly')}
        </button>

        <button
          type="button"
          onClick={toggleManagerOnly}
          className={`px-3 py-1.5 rounded-md text-sm flex items-center ${
            localManagerOnly
              ? 'bg-orange-100 text-orange-800 border border-orange-300'
              : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
          }`}
        >
          {localManagerOnly ? <FiLock className="mr-1" /> : <FiUnlock className="mr-1" />}
          {t('admin.managerOnly')}
        </button>

        <button
          type="button"
          onClick={() => {
            setLocalAdminOnly(false);
            setLocalManagerOnly(false);
            setLocalAllowedRoles([]);
            setLocalAllowedUserIds([]);
          }}
          className="px-3 py-1.5 rounded-md text-sm flex items-center bg-green-100 text-green-800 border border-green-300"
        >
          <FiUnlock className="mr-1" />
          {t('admin.accessForAll')}
        </button>
      </div>

      {/* Abas para alternar entre usuários e grupos */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-4">
          <button
            onClick={() => setSelectedTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'users'
                ? 'border-abz-blue text-abz-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiUsers className="inline mr-1" />
            {t('admin.users')}
          </button>

          <button
            onClick={() => setSelectedTab('groups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === 'groups'
                ? 'border-abz-blue text-abz-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiShield className="inline mr-1" />
            {t('admin.groups')}
          </button>
        </nav>
      </div>

      {/* Barra de pesquisa */}
      {selectedTab === 'users' && (
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('admin.searchUsers')}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-abz-blue focus:border-abz-blue"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <FiUsers className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {/* Lista de usuários */}
      {selectedTab === 'users' && (
        <div className="overflow-y-auto max-h-60 border border-gray-200 rounded-md">
          {loading ? (
            <div className="p-4 text-center text-gray-500">{t('common.loading')}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">{t('admin.noUsersFound')}</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredUsers.map(user => (
                <li key={user.id} className="p-2 hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => toggleUserSelection(user.id)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded-md"
                  >
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        user.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800'
                          : user.role === 'MANAGER'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}>
                        {getUserDisplayName(user).charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{getUserDisplayName(user)}</div>
                        <div className="text-xs text-gray-500">
                          {user.email || user.phoneNumber}
                          {user.department && ` • ${user.department}`}
                        </div>
                      </div>
                    </div>
                    <div>
                      {localAllowedUserIds.includes(user.id) ? (
                        <FiUserCheck className="h-5 w-5 text-green-600" />
                      ) : (
                        <FiUserX className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Lista de grupos */}
      {selectedTab === 'groups' && (
        <div className="overflow-y-auto max-h-60 border border-gray-200 rounded-md">
          {loading ? (
            <div className="p-4 text-center text-gray-500">{t('common.loading')}</div>
          ) : groups.length === 0 ? (
            <div className="p-4 text-center text-gray-500">{t('admin.noGroupsFound')}</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {groups.map(group => (
                <li key={group.id} className="p-2 hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => toggleGroupSelection(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded-md"
                  >
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        group.id === 'admin'
                          ? 'bg-red-100 text-red-800'
                          : group.id === 'manager'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}>
                        <FiShield className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{group.name}</div>
                        <div className="text-xs text-gray-500">
                          {group.description}
                        </div>
                      </div>
                    </div>
                    <div>
                      {localAllowedRoles.includes(group.id) ? (
                        <FiUserCheck className="h-5 w-5 text-green-600" />
                      ) : (
                        <FiUserX className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Resumo das permissões */}
      <div className="mt-4 bg-gray-50 p-3 rounded-md text-sm">
        <h4 className="font-medium text-gray-700 mb-1">{t('admin.accessSummary')}</h4>
        <ul className="space-y-1 text-gray-600">
          {localAdminOnly && (
            <li className="flex items-center">
              <FiLock className="mr-1 text-red-600" />
              {t('admin.visibleOnlyToAdmins')}
            </li>
          )}
          {localManagerOnly && (
            <li className="flex items-center">
              <FiLock className="mr-1 text-orange-600" />
              {t('admin.visibleToManagersAndAdmins')}
            </li>
          )}
          {!localAdminOnly && !localManagerOnly && localAllowedRoles.length === 0 && localAllowedUserIds.length === 0 && (
            <li className="flex items-center">
              <FiUnlock className="mr-1 text-green-600" />
              {t('admin.visibleToEveryone')}
            </li>
          )}
          {localAllowedRoles.length > 0 && (
            <li className="flex items-center">
              <FiShield className="mr-1 text-blue-600" />
              {t('admin.visibleToGroups')}: {localAllowedRoles.map(role =>
                role === 'admin' ? t('common.administrators') :
                role === 'manager' ? t('common.managers') :
                role === 'user' ? t('common.users') : role
              ).join(', ')}
            </li>
          )}
          {localAllowedUserIds.length > 0 && (
            <li className="flex items-center">
              <FiUsers className="mr-1 text-blue-600" />
              {t('admin.visibleToSpecificUsers')}: {localAllowedUserIds.length} {t('admin.selectedUsers')}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
