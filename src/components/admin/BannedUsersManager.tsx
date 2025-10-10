'use client';

import React, { useState, useEffect } from 'react';
import { FiTrash2, FiUser, FiMail, FiPhone, FiCalendar, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';

interface BannedUser {
  id: string;
  email?: string;
  phone_number?: string;
  cpf?: string;
  first_name?: string;
  last_name?: string;
  banned_at: string;
  ban_reason?: string;
  banned_by_user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export default function BannedUsersManager() {
  const { t } = useI18n();
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanningUser, setUnbanningUser] = useState<string | null>(null);

  const fetchBannedUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      
      if (!token) {
        toast.error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
        return;
      }

      const response = await fetch('/api/admin/banned-users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(t('components.erroAoBuscarUsuariosBanidos'));
      }

      const data = await response.json();
      setBannedUsers(data.data || []);
    } catch (error) {
      console.error(t('components.erroAoBuscarUsuariosBanidos'), error);
      toast.error(t('components.erroAoCarregarUsuariosBanidos'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnbanUser = async (user: BannedUser) => {
    if (!confirm(t('components.temCertezaQueDesejaDesbanirUserfirstnameUserlastna'))) {
      return;
    }

    try {
      setUnbanningUser(user.id);
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      
      if (!token) {
        toast.error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
        return;
      }

      const response = await fetch('/api/admin/banned-users', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          phoneNumber: user.phone_number,
          cpf: user.cpf
        })
      });

      if (!response.ok) {
        throw new Error(t('components.erroAoDesbanirUsuario'));
      }

      toast.success(t('components.usuarioDesbandidoComSucesso'));
      fetchBannedUsers(); // Recarregar lista
    } catch (error) {
      console.error(t('components.erroAoDesbanirUsuario'), error);
      toast.error(t('components.erroAoDesbanirUsuario'));
    } finally {
      setUnbanningUser(null);
    }
  };

  useEffect(() => {
    fetchBannedUsers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <FiRefreshCw className="animate-spin h-6 w-6 text-blue-500 mr-2" />
        <span>Carregando usuários banidos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuários Banidos</h2>
          <p className="text-gray-600">
            Gerencie usuários que foram banidos permanentemente do sistema
          </p>
        </div>
        <button
          onClick={fetchBannedUsers}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <FiRefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </button>
      </div>

      {bannedUsers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <FiUser className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum usuário banido
          </h3>
          <p className="text-gray-600">
            Não há usuários banidos no momento.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Banimento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bannedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                            <FiUser className="h-5 w-5 text-red-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {user.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {user.email && (
                          <div className="flex items-center text-sm text-gray-900">
                            <FiMail className="h-4 w-4 mr-2 text-gray-400" />
                            {user.email}
                          </div>
                        )}
                        {user.phone_number && (
                          <div className="flex items-center text-sm text-gray-900">
                            <FiPhone className="h-4 w-4 mr-2 text-gray-400" />
                            {user.phone_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-900">
                          <FiCalendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(user.banned_at).toLocaleDateString('pt-BR')}
                        </div>
                        {user.banned_by_user && (
                          <div className="text-sm text-gray-500">
                            Por: {user.banned_by_user.first_name} {user.banned_by_user.last_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {user.ban_reason || t('components.naoEspecificado')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleUnbanUser(user)}
                        disabled={unbanningUser === user.id}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                      >
                        {unbanningUser === user.id ? (
                          <FiRefreshCw className="animate-spin h-4 w-4 mr-1" />
                        ) : (
                          <FiTrash2 className="h-4 w-4 mr-1" />
                        )}
                        Desbanir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <FiAlertCircle className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Como funciona o sistema de banimento:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Rejeitar usuário:</strong> Bane permanentemente (usuário não pode se cadastrar)</li>
              <li><strong>Deletar usuário:</strong> Remove o banimento (permite novo cadastro)</li>
              <li><strong>Desbanir aqui:</strong> Remove da lista de banidos (permite novo cadastro)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
