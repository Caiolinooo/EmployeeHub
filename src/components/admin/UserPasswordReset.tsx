'use client';

import React, { useState } from 'react';
import { FiX, FiKey, FiSave, FiAlertTriangle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface UserPasswordResetProps {
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const UserPasswordReset: React.FC<UserPasswordResetProps> = ({ userId, userName, onClose, onSuccess }) => {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Função para redefinir a senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar senha
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    // Validar confirmação de senha
    if (password !== confirmPassword) {
      setError(t('components.asSenhasNaoCoincidem'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Obter token do localStorage (tenta várias opções)
      const token = localStorage.getItem('token') ||
                   localStorage.getItem('abzToken') ||
                   sessionStorage.getItem('token') ||
                   sessionStorage.getItem('abzToken') ||
                   document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1] ||
                   document.cookie.split('; ').find(row => row.startsWith('abzToken='))?.split('=')[1];

      if (!token) {
        console.error(t('components.tokenNaoEncontradoEmNenhumLocalDeArmazenamento'));
        throw new Error({t('components.naoAutorizadoTokenNaoEncontrado')});
      }

      console.log(t('components.enviandoSolicitacaoDeRedefinicaoDeSenhaParaUsuario'), userId);

      const response = await fetch(`/api/users-unified/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Resposta de erro:', errorData);
        throw new Error(errorData.error || t('common.errorResettingPassword'));
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      setError(error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-abz-blue">
            {t('common.resetPasswordFor')} {userName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-100"
            disabled={loading}
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleResetPassword} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start">
              <FiAlertTriangle className="mr-2 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success ? (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
              Senha redefinida com sucesso!
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Você está prestes a redefinir a senha do usuário <strong>{userName}</strong>.
                  A nova senha será definida imediatamente e o usuário precisará usá-la no próximo login.
                </p>

                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded-md mb-4 flex items-start">
                  <FiAlertTriangle className="mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">
                    Esta ação não pode ser desfeita. Certifique-se de informar a nova senha ao usuário de forma segura.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Nova Senha*
                  </label>
                  <div className="flex items-center">
                    <FiKey className="text-gray-400 mr-2" />
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                      required
                      minLength={8}
                      disabled={loading}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Mínimo de 8 caracteres
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar Nova Senha*
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
              disabled={loading || success}
            >
              {t('common.cancel', 'Cancelar')}
            </button>

            {!success && (
              <button
                type="submit"
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                    {t('common.processing')}
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2" />
                    {t('common.resetPassword')}
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserPasswordReset;
