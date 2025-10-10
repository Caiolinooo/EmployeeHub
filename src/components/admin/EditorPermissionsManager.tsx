'use client';

import React, { useState, useEffect } from 'react';
import { FiUsers, FiEdit3, FiShield, FiSave, FiRefreshCw, FiCheck, FiX, FiBookOpen, FiMessageSquare } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { PERMISSION_DESCRIPTIONS } from '@/lib/permissions';
import { useI18n } from '@/contexts/I18nContext';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  active: boolean;
  permissions_summary: {
    academy_editor: boolean;
    academy_moderator: boolean;
    social_editor: boolean;
    social_moderator: boolean;
  };
}

interface UserStats {
  total_users: number;
  by_role: {
    ADMIN: number;
    MANAGER: number;
    USER: number;
  };
  permissions: {
    academy_editors: number;
    academy_moderators: number;
    social_editors: number;
    social_moderators: number;
  };
}

export default function EditorPermissionsManager() {
  const { t } = useI18n();

  const { user, getToken } = useSupabaseAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Carregar usuários e permissões
  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error(t('components.tokenNaoEncontrado'));
      }

      const response = await fetch('/api/users/permissions/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('components.erroAoCarregarUsuarios'));
      }

      const data = await response.json();
      setUsers(data.users);
      setStats(data.stats);
    } catch (error) {
      console.error(t('components.erroAoCarregarUsuarios'), error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar permissões de um usuário
  const updateUserPermissions = async (userId: string, permissions: Partial<User['permissions_summary']>) => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error(t('components.tokenNaoEncontrado'));
      }

      const response = await fetch('/api/users/permissions/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          features: permissions
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('components.erroAoAtualizarPermissoes'));
      }

      const data = await response.json();
      setSuccess(t('components.permissoesAtualizadasParaDatausername'));
      
      // Recarregar lista de usuários
      await fetchUsers();
    } catch (error) {
      console.error(t('components.erroAoAtualizarPermissoes'), error);
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrar usuários
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto-hide success/error messages
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Acesso negado. Apenas administradores podem gerenciar editores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FiUsers className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Gerenciar Editores</h2>
            <p className="text-sm text-gray-600">Selecione usuários para serem editores do Academy e Social</p>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <FiRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiBookOpen className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-blue-900">Editores Academy</p>
                <p className="text-2xl font-bold text-blue-600">{stats.permissions.academy_editors}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiShield className="h-5 w-5 text-green-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-green-900">Moderadores Academy</p>
                <p className="text-2xl font-bold text-green-600">{stats.permissions.academy_moderators}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiMessageSquare className="h-5 w-5 text-purple-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-purple-900">Editores Social</p>
                <p className="text-2xl font-bold text-purple-600">{stats.permissions.social_editors}</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center">
              <FiShield className="h-5 w-5 text-orange-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-orange-900">Moderadores Social</p>
                <p className="text-2xl font-bold text-orange-600">{stats.permissions.social_moderators}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Todos os Roles</option>
            <option value="ADMIN">Administradores</option>
            <option value="MANAGER">Gerentes</option>
            <option value="USER">Usuários</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <FiRefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Carregando usuários...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <FiUsers className="h-8 w-8 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Academy Editor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Academy Moderador
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Social Editor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Social Moderador
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                        user.role === 'MANAGER' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => updateUserPermissions(user.id, {
                          academy_editor: !user.permissions_summary.academy_editor
                        })}
                        disabled={isSaving}
                        className={`p-2 rounded-full ${
                          user.permissions_summary.academy_editor
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {user.permissions_summary.academy_editor ? <FiCheck /> : <FiX />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => updateUserPermissions(user.id, {
                          academy_moderator: !user.permissions_summary.academy_moderator
                        })}
                        disabled={isSaving}
                        className={`p-2 rounded-full ${
                          user.permissions_summary.academy_moderator
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {user.permissions_summary.academy_moderator ? <FiCheck /> : <FiX />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => updateUserPermissions(user.id, {
                          social_editor: !user.permissions_summary.social_editor
                        })}
                        disabled={isSaving}
                        className={`p-2 rounded-full ${
                          user.permissions_summary.social_editor
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {user.permissions_summary.social_editor ? <FiCheck /> : <FiX />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => updateUserPermissions(user.id, {
                          social_moderator: !user.permissions_summary.social_moderator
                        })}
                        disabled={isSaving}
                        className={`p-2 rounded-full ${
                          user.permissions_summary.social_moderator
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {user.permissions_summary.social_moderator ? <FiCheck /> : <FiX />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Descrição das Permissões:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <strong className="text-blue-600">Academy Editor:</strong>
            <p className="text-gray-600">{PERMISSION_DESCRIPTIONS.academy_editor.description}</p>
          </div>
          <div>
            <strong className="text-green-600">Academy Moderador:</strong>
            <p className="text-gray-600">{PERMISSION_DESCRIPTIONS.academy_moderator.description}</p>
          </div>
          <div>
            <strong className="text-purple-600">Social Editor:</strong>
            <p className="text-gray-600">{PERMISSION_DESCRIPTIONS.social_editor.description}</p>
          </div>
          <div>
            <strong className="text-orange-600">Social Moderador:</strong>
            <p className="text-gray-600">{PERMISSION_DESCRIPTIONS.social_moderator.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
