'use client';

import React, { useState, useEffect } from 'react';
import { FiUsers, FiUserCheck, FiUserX, FiPlus, FiX, FiSearch } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useAllUsers } from '@/hooks/useAllUsers';

interface User {
  _id: string;
  id?: string; // Suporte para ambos os formatos
  name: string;
  email?: string;
  phoneNumber?: string;
  role: string;
}

interface PermissionsSelectorProps {
  adminOnly: boolean;
  managerOnly: boolean;
  allowedRoles: string[];
  allowedUserIds: string[];
  onAdminOnlyChange: (value: boolean) => void;
  onManagerOnlyChange: (value: boolean) => void;
  onAllowedRolesChange: (roles: string[]) => void;
  onAllowedUserIdsChange: (userIds: string[]) => void;
}

export default function PermissionsSelector({
  adminOnly,
  managerOnly,
  allowedRoles,
  allowedUserIds,
  onAdminOnlyChange,
  onManagerOnlyChange,
  onAllowedRolesChange,
  onAllowedUserIdsChange
}: PermissionsSelectorProps) {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [showUserSelector, setShowUserSelector] = useState(false);

  // Lista unificada de usuários
  const { users: hookUsers, loading: hookLoading } = useAllUsers();

  useEffect(() => {
    setIsLoadingUsers(hookLoading);
    const mapped = (hookUsers || []).map((u: any) => ({
      _id: u._id,
      id: u._id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.phoneNumber || u._id,
      email: u.email,
      phoneNumber: u.phoneNumber,
      role: u.role,
    }));
    setUsers(mapped as any);
    setFilteredUsers(mapped as any);
  }, [hookUsers, hookLoading]);

  // Filtrar usuários com base no termo de pesquisa
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = users.filter(
      user =>
        user.name?.toLowerCase().includes(lowerSearchTerm) ||
        user.email?.toLowerCase().includes(lowerSearchTerm) ||
        user.phoneNumber?.toLowerCase().includes(lowerSearchTerm)
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  // Carregar usuários selecionados com base nos IDs
  useEffect(() => {
    const loadSelectedUsers = () => {
      const selected = users.filter(user => 
        allowedUserIds.includes(user._id || '') || 
        (user.id && allowedUserIds.includes(user.id))
      );
      setSelectedUsers(selected);
    };

    if (users.length > 0 && allowedUserIds.length > 0) {
      loadSelectedUsers();
    }
  }, [users, allowedUserIds]);

  // Adicionar usuário à lista de permitidos
  const addUser = (user: User) => {
    const userId = user._id || user.id || '';
    if (!allowedUserIds.includes(userId)) {
      const newAllowedUserIds = [...allowedUserIds, userId];
      onAllowedUserIdsChange(newAllowedUserIds);
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchTerm('');
  };

  // Remover usuário da lista de permitidos
  const removeUser = (user: User) => {
    const userId = user._id || user.id || '';
    const newAllowedUserIds = allowedUserIds.filter(id => id !== userId);
    onAllowedUserIdsChange(newAllowedUserIds);
    setSelectedUsers(selectedUsers.filter(u => (u._id || u.id) !== userId));
  };

  // Adicionar ou remover papel
  const toggleRole = (role: string) => {
    if (allowedRoles.includes(role)) {
      onAllowedRolesChange(allowedRoles.filter(r => r !== role));
    } else {
      onAllowedRolesChange([...allowedRoles, role]);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-md font-medium text-gray-900 mb-2">{t('admin.permissions')}</h3>
      
      {/* Opções de acesso rápido */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="adminOnly"
            checked={adminOnly}
            onChange={(e) => onAdminOnlyChange(e.target.checked)}
            className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
          />
          <label htmlFor="adminOnly" className="ml-2 block text-sm text-gray-700">
            {t('admin.adminOnly')}
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="managerOnly"
            checked={managerOnly}
            onChange={(e) => onManagerOnlyChange(e.target.checked)}
            className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
          />
          <label htmlFor="managerOnly" className="ml-2 block text-sm text-gray-700">
            {t('admin.managerOnly')}
          </label>
        </div>
      </div>
      
      {/* Seleção de papéis */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('admin.allowedRoles')}
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggleRole('USER')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center ${
              allowedRoles.includes('USER')
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-800 border border-gray-300'
            }`}
          >
            <FiUsers className="mr-1" />
            {t('admin.roleUser')}
            {allowedRoles.includes('USER') ? (
              <FiUserCheck className="ml-1 text-green-600" />
            ) : (
              <FiUserX className="ml-1 text-gray-400" />
            )}
          </button>
          
          <button
            type="button"
            onClick={() => toggleRole('MANAGER')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center ${
              allowedRoles.includes('MANAGER')
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-gray-100 text-gray-800 border border-gray-300'
            }`}
          >
            <FiUsers className="mr-1" />
            {t('admin.roleManager')}
            {allowedRoles.includes('MANAGER') ? (
              <FiUserCheck className="ml-1 text-blue-600" />
            ) : (
              <FiUserX className="ml-1 text-gray-400" />
            )}
          </button>
          
          <button
            type="button"
            onClick={() => toggleRole('ADMIN')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center ${
              allowedRoles.includes('ADMIN')
                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                : 'bg-gray-100 text-gray-800 border border-gray-300'
            }`}
          >
            <FiUsers className="mr-1" />
            {t('admin.roleAdmin')}
            {allowedRoles.includes('ADMIN') ? (
              <FiUserCheck className="ml-1 text-purple-600" />
            ) : (
              <FiUserX className="ml-1 text-gray-400" />
            )}
          </button>
        </div>
      </div>
      
      {/* Seleção de usuários específicos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('admin.allowedUsers')}
        </label>
        
        {/* Lista de usuários selecionados */}
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedUsers.map(user => (
            <div 
              key={user._id || user.id} 
              className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs flex items-center"
            >
              <span>{user.name}</span>
              <button 
                type="button" 
                onClick={() => removeUser(user)}
                className="ml-1 text-blue-500 hover:text-blue-700"
              >
                <FiX />
              </button>
            </div>
          ))}
          
          <button
            type="button"
            onClick={() => setShowUserSelector(!showUserSelector)}
            className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs flex items-center hover:bg-gray-200"
          >
            <FiPlus className="mr-1" />
            {t('admin.addUser')}
          </button>
        </div>
        
        {/* Seletor de usuários */}
        {showUserSelector && (
          <div className="border border-gray-300 rounded-md p-3 bg-white shadow-sm">
            <div className="relative mb-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('admin.searchUsers')}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue text-sm"
              />
              <FiSearch className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            
            <div className="max-h-40 overflow-y-auto">
              {isLoadingUsers ? (
                <div className="text-center py-2 text-sm text-gray-500">
                  {t('common.loading')}...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-2 text-sm text-gray-500">
                  {t('admin.noUsersFound')}
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredUsers.map(user => {
                    const userId = user._id || user.id || '';
                    const isSelected = allowedUserIds.includes(userId);
                    
                    return (
                      <li 
                        key={userId} 
                        className={`py-2 px-2 text-sm hover:bg-gray-50 cursor-pointer ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => isSelected ? removeUser(user) : addUser(user)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-gray-500">
                              {user.email || user.phoneNumber}
                              {user.role && ` • ${t(`admin.role${user.role}`)}`}
                            </p>
                          </div>
                          {isSelected && <FiUserCheck className="text-blue-500" />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
