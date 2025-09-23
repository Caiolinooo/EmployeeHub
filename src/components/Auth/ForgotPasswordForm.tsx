'use client';

import { useState, FormEvent } from 'react';
import { FiMail, FiPhone, FiArrowRight, FiCheck, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

interface ForgotPasswordFormProps {
  onCancel: () => void;
  initialEmail?: string;
}

export default function ForgotPasswordForm({ onCancel, initialEmail = '' }: ForgotPasswordFormProps) {
  const [identifier, setIdentifier] = useState(initialEmail);
  const [useEmail, setUseEmail] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { t } = useI18n();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validar o identificador
    if (!identifier) {
      setError(useEmail ? t('auth.invalidEmail') : t('auth.invalidPhoneNumber'));
      setIsLoading(false);
      return;
    }

    if (useEmail) {
      // Importar a função de validação de email
      const { validateEmail } = await import('@/lib/schema');

      // Validar o email com a função melhorada
      if (!validateEmail(identifier)) {
        setError(t('auth.invalidEmail'));
        setIsLoading(false);
        return;
      }
    }

    try {
        // Usar nossa nova API de reset de senha
        if (useEmail) {
          console.log('Enviando email de recuperação para:', identifier);

          const response = await fetch('/api/auth/request-password-reset', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: identifier,
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            console.error('Erro ao solicitar recuperação de senha:', data);
            setError(data.message || t('auth.requestError'));
            return;
          }

          console.log('Email de recuperação enviado com sucesso');
        } else {
          // Para telefone, precisamos usar a API personalizada
          const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phoneNumber: identifier,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            setError(data.error || t('auth.requestError'));
            return;
          }
        }

        // Se chegou aqui, foi bem-sucedido
        setSuccess(true);
    } catch (error) {
      console.error('Erro ao solicitar recuperação de senha:', error);
      setError(t('auth.requestError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4">
      {success ? (
        <div className="bg-green-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiCheck className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                {t('auth.resetLinkSent')}
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  {useEmail
                    ? t('auth.resetLinkSentEmailDescription')
                    : t('auth.resetLinkSentPhoneDescription')}
                </p>
              </div>
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={onCancel}
                  variant="outline"
                  size="sm"
                  className="text-green-700 bg-green-50 border-green-200 hover:bg-green-100 hover:text-green-800"
                >
                  <FiArrowLeft className="mr-2 h-4 w-4" />
                  {t('common.backToLogin')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
                {useEmail ? t('auth.email') : t('auth.phoneNumber')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setUseEmail(!useEmail);
                  setIdentifier('');
                  setError('');
                }}
                className="text-xs text-abz-blue hover:text-abz-blue-dark"
              >
                {useEmail ? t('auth.usePhone') : t('auth.useEmail')}
              </button>
            </div>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {useEmail ? (
                  <FiMail className="h-5 w-5 text-gray-400" />
                ) : (
                  <FiPhone className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <input
                id="identifier"
                name="identifier"
                type={useEmail ? 'email' : 'tel'}
                autoComplete={useEmail ? 'email' : 'tel'}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm"
                placeholder={useEmail ? 'email@exemplo.com' : '+55 (99) 99999-9999'}
              />
            </div>
            {error && (
              <div className="mt-2 flex items-center text-sm text-red-600">
                <FiAlertCircle className="mr-1 h-4 w-4" />
                {error}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              {useEmail
                ? t('auth.resetPasswordEmailDescription')
                : t('auth.resetPasswordPhoneDescription')}
            </p>
          </div>

          <div className="flex items-center justify-between space-x-4">
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-abz-blue hover:bg-abz-blue-dark"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  {t('common.loading')}
                </>
              ) : (
                <>
                  {t('auth.sendResetLink')} <FiArrowRight className="ml-2" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
