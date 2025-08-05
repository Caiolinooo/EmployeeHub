'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  // FiUser, // Removido - não utilizado
  FiUsers,
  FiShield,
  FiSearch,
  FiKey,
  FiClock,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiUserCheck,
  // FiSettings // Removido - não utilizado
} from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import UserEditor, { UserEditorData } from '@/components/admin/UserEditor';
import UserAccessHistory from '@/components/admin/UserAccessHistory';
import UserPasswordReset from '@/components/admin/UserPasswordReset';
import UserRoleManager from '@/components/admin/UserRoleManager';

// Interface para o usuário na lista
interface User {
  _id: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: 'ADMIN' | 'USER' | 'MANAGER';
  position?: string;
  department?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UsersPage() {
  const { isAdmin, isAuthenticated } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para modais
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccessHistory, setShowAccessHistory] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  // Verificar se o usuário é administrador
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isAdmin, router]);

  // Carregar usuários
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error('Não autorizado');
      }

      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao obter usuários');
      }

      const data = await response.json();
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) {
      console.error('Erro ao obter usuários:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Carregar usuários ao montar o componente
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchUsers();
    }
  }, [isAuthenticated, isAdmin]);

  // Filtrar usuários quando o termo de busca mudar
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(user =>
      user.firstName.toLowerCase().includes(term) ||
      user.lastName.toLowerCase().includes(term) ||
      user.phoneNumber.includes(term) ||
      (user.email && user.email.toLowerCase().includes(term)) ||
      (user.department && user.department.toLowerCase().includes(term)) ||
      (user.position && user.position.toLowerCase().includes(term))
    );

    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  // Função para abrir o editor de usuário
  const handleAddUser = () => {
    setSelectedUser(null);
    setIsNewUser(true);
    setShowEditor(true);
  };

  // Função para editar um usuário
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsNewUser(false);
    setShowEditor(true);
  };

  // Função para confirmar exclusão de usuário
  const handleDeleteConfirm = (user: User) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  // Função para visualizar histórico de acesso
  const handleViewHistory = (user: User) => {
    setSelectedUser(user);
    setShowAccessHistory(true);
  };

  // Função para redefinir senha
  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setShowPasswordReset(true);
  };

  // Função para gerenciar papel do usuário
  const handleManageRole = (user: User) => {
    setSelectedUser(user);
    setShowRoleManager(true);
  };

  // Função para salvar usuário (novo ou editado)
  const handleSaveUser = async (userData: UserEditorData, password?: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error('Não autorizado');
      }

      if (isNewUser) {
        // Criar novo usuário
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...userData,
            password
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao criar usuário');
        }
      } else if (selectedUser) {
        // Atualizar usuário existente
        const response = await fetch(`/api/users/${selectedUser._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...userData,
            ...(password ? { password } : {})
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar usuário');
        }
      }

      // Fechar o editor e recarregar a lista
      setShowEditor(false);
      fetchUsers();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      alert(error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  // Função para excluir usuário
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error('Não autorizado');
      }

      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir usuário');
      }

      // Fechar o modal e recarregar a lista
      setShowDeleteConfirm(false);
      fetchUsers();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      alert(error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  // Função para obter o rótulo do papel do usuário
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'MANAGER':
        return 'Gerente';
      case 'USER':
        return 'Usuário';
      default:
        return role;
    }
  };

  // Função para obter a cor do papel do usuário
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800';
      case 'USER':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-abz-blue flex items-center">
          <FiUsers className="mr-2" /> {t('userEditor.usersSection', 'Gerenciamento de Usuários')}
        </h1>
        <div className="flex space-x-3">
          <button
            onClick={() => router.push('/admin/authorized-users')}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <FiUserCheck className="mr-2" />
            {t('userEditor.authorizedUsers', 'Usuários Autorizados')}
          </button>
          <button
            onClick={handleAddUser}
            className="flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors"
          >
            <FiPlus className="mr-2" />
            {t('userEditor.newUser', 'Novo Usuário')}
          </button>
        </div>
      </div>

      {/* Barra de pesquisa */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar usuários por nome, telefone, email, departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm"
          />
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-abz-blue"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md inline-flex items-start">
              <FiAlertTriangle className="mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Erro ao carregar usuários</p>
                <p className="mt-1">{error}</p>
                <button
                  onClick={fetchUsers}
                  className="mt-2 flex items-center text-abz-blue hover:text-abz-blue-dark"
                >
                  <FiRefreshCw className="mr-1" /> Tentar novamente
                </button>
              </div>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm ? (
              <p>Nenhum usuário encontrado para "{searchTerm}"</p>
            ) : (
              <p>Nenhum usuário cadastrado</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Função
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Criado em
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-abz-blue-dark text-white rounded-full flex items-center justify-center">
                          <span className="text-lg font-medium">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.department && `${user.department}`}
                            {user.position && user.department && ' - '}
                            {user.position && `${user.position}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.phoneNumber}</div>
                      {user.email && (
                        <div className="text-sm text-gray-500">{user.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`flex items-center text-sm ${user.active ? 'text-green-600' : 'text-red-600'}`}>
                        {user.active ? (
                          <>
                            <FiCheck className="mr-1.5" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <FiX className="mr-1.5" />
                            Inativo
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewHistory(user)}
                          className="text-gray-600 hover:text-abz-blue"
                          title="Ver histórico de acesso"
                        >
                          <FiClock />
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="text-gray-600 hover:text-abz-blue"
                          title="Redefinir senha"
                        >
                          <FiKey />
                        </button>
                        <button
                          onClick={() => handleManageRole(user)}
                          className="text-gray-600 hover:text-abz-blue"
                          title="Gerenciar papel/função"
                        >
                          <FiShield />
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-gray-600 hover:text-abz-blue"
                          title="Editar usuário"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDeleteConfirm(user)}
                          className="text-gray-600 hover:text-red-600"
                          title="Excluir usuário"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edição de usuário */}
      {showEditor && (
        <UserEditor
          user={selectedUser ? {
            _id: selectedUser._id,
            phoneNumber: selectedUser.phoneNumber,
            firstName: selectedUser.firstName,
            lastName: selectedUser.lastName,
            email: selectedUser.email,
            role: selectedUser.role,
            position: selectedUser.position,
            department: selectedUser.department
          } : {
            phoneNumber: '',
            firstName: '',
            lastName: '',
            email: '',
            role: 'USER',
            position: '',
            department: ''
          }}
          onSave={handleSaveUser}
          onCancel={() => setShowEditor(false)}
          isNew={isNewUser}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('common.confirmDelete', 'Confirmar Exclusão')}</h2>
            <p className="text-gray-700 mb-6">
              {t('admin.users.confirmDeleteMessage', 'Tem certeza que deseja excluir o usuário')} <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>?
              {t('admin.users.actionCannotBeUndone', 'Esta ação não pode ser desfeita.')}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de histórico de acesso */}
      {showAccessHistory && selectedUser && (
        <UserAccessHistory
          userId={selectedUser._id}
          userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          onClose={() => setShowAccessHistory(false)}
        />
      )}

      {/* Modal de redefinição de senha */}
      {showPasswordReset && selectedUser && (
        <UserPasswordReset
          userId={selectedUser._id}
          userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          onClose={() => setShowPasswordReset(false)}
          onSuccess={fetchUsers}
        />
      )}

      {/* Modal de gerenciamento de papel */}
      {showRoleManager && selectedUser && (
        <UserRoleManager
          userId={selectedUser._id}
          userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          currentRole={selectedUser.role}
          onClose={() => setShowRoleManager(false)}
          onRoleUpdated={fetchUsers}
        />
      )}
    </div>
  );
}
