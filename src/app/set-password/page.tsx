'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { FiLock, FiEye, FiEyeOff, FiShield, FiAlertCircle, FiCheck } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteConfig } from '@/contexts/SiteConfigContext';

export default function SetPassword() {
  const { t } = useI18n();
  const { config } = useSiteConfig();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { isAuthenticated, isLoading, passwordExpired, updatePassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams?.get('invite');

  // Verificar se o usuário está autenticado ou tem código de convite
  useEffect(() => {
    // Se temos um código de convite, não precisamos verificar autenticação
    if (inviteCode) {
      return;
    }

    // Caso contrário, verificar autenticação
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (!passwordExpired) {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, passwordExpired, isLoading, router, inviteCode]);

  // Função para atualizar a senha
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsProcessing(true);

    // Validar a senha
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      setIsProcessing(false);
      return;
    }

    // Verificar se as senhas coincidem
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      setIsProcessing(false);
      return;
    }

    try {
      // Se temos um código de convite, usar a API de definição de senha
      if (inviteCode) {
        const response = await fetch('/api/auth/set-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inviteCode,
            password,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess(t('auth.passwordSetSuccessfully'));

          // Redirecionar para o login após 2 segundos
          setTimeout(() => {
            router.push('/login');
          }, 2000);
        } else {
          setError(data.error || t('auth.errorSettingPassword'));
        }
      } else {
        // Caso contrário, usar a função de atualização de senha do contexto de autenticação
        const success = await updatePassword(password);

        if (success) {
          setSuccess(t('auth.passwordUpdatedSuccessfully'));

          // Redirecionar para o dashboard após 2 segundos
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          setError(t('auth.errorUpdatingPassword'));
        }
      }
    } catch (error: any) {
      setError(error.message || t('auth.errorProcessingRequest'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 lg:px-8 bg-abz-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image
            src={config.logo}
            alt={config.companyName + " Logo"}
            width={200}
            height={60}
            className="h-auto"
            priority
          />
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-abz-blue-dark">
          {inviteCode ? t('auth.setYourPassword') : t('auth.updateYourPassword')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {inviteCode
            ? t('auth.createPasswordForAccount')
            : passwordExpired
              ? t('auth.passwordExpiredMessage')
              : t('auth.definePasswordForAccount')}
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-6 py-8 shadow-md rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                {success}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                Nova Senha
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border-0 py-2.5 pl-10 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue sm:text-sm sm:leading-6"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    {showPassword ? (
                      <FiEyeOff className="h-5 w-5" />
                    ) : (
                      <FiEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                A senha deve ter pelo menos 8 caracteres.
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6 text-gray-900">
                Confirmar Senha
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiShield className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-md border-0 py-2.5 pl-10 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue sm:text-sm sm:leading-6"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    {showConfirmPassword ? (
                      <FiEyeOff className="h-5 w-5" />
                    ) : (
                      <FiEye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || isProcessing || success !== ''}
                className="flex w-full justify-center rounded-md bg-abz-blue px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-abz-blue-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-abz-blue transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading || isProcessing ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    {inviteCode ? t('auth.settingPassword') : t('auth.updatingPassword')}
                  </>
                ) : (
                  inviteCode ? t('auth.setPassword') : t('auth.updatePassword')
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">
                  {config.companyName}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          {config.footerText || `© ${new Date().getFullYear()} ${config.companyName}. Todos os direitos reservados.`}
        </p>
      </div>
    </div>
  );
}
