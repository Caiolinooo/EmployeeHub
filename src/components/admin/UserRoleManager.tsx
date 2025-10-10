'use client';

import React, { useState, useEffect } from 'react';
import { FiShield, FiUser, FiUsers, FiAlertTriangle, FiCheck, FiX, FiInfo } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface UserRoleManagerProps {
  userId: string;
  userName: string;
  currentRole: 'ADMIN' | 'MANAGER' | 'USER';
  onClose: () => void;
  onRoleUpdated: () => void;
}

const UserRoleManager: React.FC<UserRoleManagerProps> = ({
  userId,
  userName,
  currentRole,
  onClose,
  onRoleUpdated
}) => {
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MANAGER' | 'USER'>(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Descrições dos papéis
  const roleDescriptions = {
    ADMIN: t('components.acessoTotalAoSistemaIncluindoTodasAsFuncionalidade'),
    MANAGER: t('components.acessoAFuncionalidadesDeGerenciamentoMasSemPermiss'),
    USER: t('components.acessoBasicoAoSistemaPodeVisualizarConteudoEUsarFu')
  };

  // Permissões padrão para cada papel
  const defaultPermissions = {
    ADMIN: {
      modules: {
        dashboard: true,
        manual: true,
        procedimentos: true,
        politicas: true,
        calendario: true,
        noticias: true,
        reembolso: true,
        contracheque: true,
        ponto: true,
        admin: true
      },
      features: {
        reimbursement_approval: true
      }
    },
    MANAGER: {
      modules: {
        dashboard: true,
        manual: true,
        procedimentos: true,
        politicas: true,
        calendario: true,
        noticias: true,
        reembolso: true,
        contracheque: true,
        ponto: true,
        admin: false
      },
      features: {
        reimbursement_approval: true
      }
    },
    USER: {
      modules: {
        dashboard: true,
        manual: true,
        procedimentos: true,
        politicas: true,
        calendario: true,
        noticias: true,
        reembolso: true,
        contracheque: true,
        ponto: true,
        admin: false
      },
      features: {
        reimbursement_approval: false
      }
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRole === currentRole) {
      setError(t('components.oPapelSelecionadoEOMesmoQueOAtual'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.naoAutorizado'));
      }

      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role: selectedRole,
          accessPermissions: defaultPermissions[selectedRole]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('components.erroAoAtualizarPapelDoUsuario'));
      }

      setSuccess(true);
      setTimeout(() => {
        onRoleUpdated();
        onClose();
      }, 1500);
    } catch (error) {
      console.error(t('components.erroAoAtualizarPapelDoUsuario'), error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Ícones para cada papel
  const roleIcons = {
    ADMIN: <FiShield className="h-6 w-6 text-red-600" />,
    MANAGER: <FiUsers className="h-6 w-6 text-blue-600" />,
    USER: <FiUser className="h-6 w-6 text-green-600" />
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-abz-blue">
            Gerenciar Papel - {userName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-100"
            disabled={loading}
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleUpdateRole} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start">
              <FiAlertTriangle className="mr-2 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success ? (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-center">
              <FiCheck className="mr-2 flex-shrink-0" />
              <p>Papel atualizado com sucesso!</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Você está prestes a alterar o papel do usuário <strong>{userName}</strong>.
                  Isso afetará as permissões e o acesso deste usuário ao sistema.
                </p>

                <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-md mb-4 flex items-start">
                  <FiInfo className="mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">
                    Papel atual: <strong>{currentRole}</strong>
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selecione o novo papel:
                </label>

                <div className="space-y-3">
                  {(['ADMIN', 'MANAGER', 'USER'] as const).map((role) => (
                    <div
                      key={role}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedRole === role
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => setSelectedRole(role)}
                    >
                      <div className="flex items-center">
                        <div className="mr-3">
                          {roleIcons[role]}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{role}</h3>
                          <p className="text-sm text-gray-500 mt-1">{roleDescriptions[role]}</p>
                        </div>
                        <div className="ml-3">
                          <div className={`w-5 h-5 rounded-full border ${
                            selectedRole === role
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          } flex items-center justify-center`}>
                            {selectedRole === role && (
                              <FiCheck className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 border-t pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                  disabled={loading || selectedRole === currentRole}
                >
                  {loading ? 'Atualizando...' : 'Atualizar Papel'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default UserRoleManager;
