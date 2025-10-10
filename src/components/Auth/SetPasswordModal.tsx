import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import useToast from '@/hooks/useToast';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isNewUser?: boolean;
}

export function SetPasswordModal({ isOpen, onClose, onSuccess, isNewUser = false }: SetPasswordModalProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user, profile } = useSupabaseAuth();

  // Campos de senha
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Campos de informações pessoais
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Estados de UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordSet, setPasswordSet] = useState(false);

  // Preencher campos com dados existentes, se disponíveis
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setPhoneNumber(profile.phone_number || '');
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validar campos obrigatórios
    if (isNewUser) {
      if (!firstName.trim()) {
        setError(t('auth.firstNameRequired', 'O nome é obrigatório'));
        return;
      }

      if (!lastName.trim()) {
        setError(t('auth.lastNameRequired', 'O sobrenome é obrigatório'));
        return;
      }

      if (!phoneNumber.trim()) {
        setError(t('auth.phoneNumberRequired', 'O telefone é obrigatório'));
        return;
      }
    }

    // Validar senha
    if (password.length < 8) {
      setError(t('auth.passwordTooShort', 'A senha deve ter pelo menos 8 caracteres'));
      return;
    }

    // Verificar se as senhas coincidem
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch', 'As senhas não coincidem'));
      return;
    }

    setIsLoading(true);

    try {
      // Obter o token do localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        setError(t('auth.notAuthorized', 'Não autorizado. Faça login novamente.'));
        return;
      }

      // Preparar os dados para envio
      const requestData = {
        password,
        // Incluir informações adicionais apenas se for um novo usuário
        ...(isNewUser && {
          firstName,
          lastName,
          phoneNumber
        })
      };

      console.log(t('components.enviandoDadosParaDefinicaoDeSenha'), {
        ...requestData,
        password: '********' // Não logar a senha real
      });

      // Enviar requisição diretamente usando fetch
      const response = await fetch('/api/auth/set-password-after-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      // Verificar se a resposta é OK
      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          toast.success(t('auth.passwordSetSuccess', 'Senha definida com sucesso') + ': ' +
                (isNewUser
                  ? t('auth.accountCreatedDescription', 'Sua conta foi criada com sucesso')
                  : t('auth.passwordUpdatedDescription', 'Sua senha foi atualizada com sucesso')));
          setPasswordSet(true);
          onSuccess();
        } else {
          setError(data.error || t('auth.passwordSetError', 'Erro ao definir senha'));
        }
      } else {
        // Tentar obter a mensagem de erro
        try {
          const errorData = await response.json();
          setError(errorData.error || t('auth.passwordSetError', 'Erro ao definir senha'));
        } catch (jsonError) {
          setError(t('auth.passwordSetError', 'Erro ao definir senha'));
        }
      }
    } catch (error) {
      console.error('Erro ao definir senha:', error);
      setError(t('auth.passwordSetError', 'Erro ao definir senha'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {isNewUser
              ? t('auth.createAccount', 'Criar Conta')
              : t('auth.setPassword', 'Definir Senha')}
          </h2>
          {/* Remover botão de fechar para impedir que o usuário feche o modal sem definir a senha */}
          <div className="w-6 h-6"></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Aviso de segurança */}
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md text-sm mb-4">
              <div className="flex items-start">
                <svg className="h-5 w-5 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium mb-1">Atenção: Definição de senha obrigatória</p>
                  <p>Por motivos de segurança, você precisa definir uma senha antes de acessar o sistema.</p>
                </div>
              </div>
            </div>

            {isNewUser && (
              <div className="text-sm text-gray-600 mb-2">
                {t('auth.newAccountMessage', 'Para completar seu cadastro, preencha seus dados pessoais e defina uma senha para sua conta.')}
              </div>
            )}

            {!isNewUser && (
              <div className="text-sm text-gray-600 mb-2">
                {t('auth.setPasswordMessage', 'Defina uma senha para acessar sua conta.')}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 mb-2">
                {error}
              </div>
            )}

            {/* Campos de informações pessoais - apenas para novos usuários */}
            {isNewUser && (
              <div className="space-y-4 mb-4">
                <h3 className="text-md font-medium text-gray-700">Informações Pessoais</h3>

                <div className="space-y-2">
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    {t('auth.firstName', 'Nome')}
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t('auth.firstNamePlaceholder', 'Digite seu nome')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    {t('auth.lastName', 'Sobrenome')}
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t('auth.lastNamePlaceholder', 'Digite seu sobrenome')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                    {t('auth.phoneNumber', 'Telefone')}
                  </label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder={t('auth.phoneNumberPlaceholder', 'Digite seu telefone')}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-xs text-gray-500">
                    {t('auth.phoneNumberFormat', 'Formato: +55 (DDD) XXXXX-XXXX')}
                  </div>
                </div>
              </div>
            )}

            {/* Campos de senha */}
            <h3 className="text-md font-medium text-gray-700 mb-2">Definição de Senha</h3>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('auth.password', 'Senha')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder', 'Digite sua senha')}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-500">
                {t('auth.passwordRequirements', 'A senha deve ter pelo menos 8 caracteres')}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                {t('auth.confirmPassword', 'Confirmar Senha')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.confirmPasswordPlaceholder', 'Confirme sua senha')}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            {passwordSet && (
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t('common.continue', 'Continuar')}
              </button>
            )}
            {!passwordSet && (
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {isLoading
                  ? t('common.loading', 'Carregando...')
                  : isNewUser
                    ? t('auth.createAccount', 'Criar Conta')
                    : t('auth.setPassword', 'Definir Senha')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
