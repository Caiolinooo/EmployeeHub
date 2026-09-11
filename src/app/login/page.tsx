'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FiLock, FiEye, FiEyeOff, FiUser, FiPhone, FiArrowRight, FiGlobe, FiAlertTriangle, FiKey, FiArrowLeft } from 'react-icons/fi';
import { FaLinkedin, FaGithub, FaInstagram } from 'react-icons/fa';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteConfig } from '@/contexts/SiteConfigContext';
import LanguageSelector from '@/components/LanguageSelector';
import InviteCodeInput from '@/components/Auth/InviteCodeInput';
import ForgotPasswordForm from '@/components/Auth/ForgotPasswordForm';
import { SetPasswordModal } from '@/components/Auth/SetPasswordModal';
import EmailVerificationPrompt from '@/components/Auth/EmailVerificationPrompt';
import PostLoginBiometricPrompt from '@/components/Auth/PostLoginBiometricPrompt';

import { fetchWrapper } from '@/lib/fetch-wrapper';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from '@/components/ui/button';
import { saveToken } from '@/lib/tokenStorage';

export default function Login() {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInviteField, setShowInviteField] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailToVerify, setEmailToVerify] = useState('');
  const [isWebAuthnLoading, setIsWebAuthnLoading] = useState(false);
  const [isWebAuthnAvailable, setIsWebAuthnAvailable] = useState(false);
  const [hasRegisteredPasskey, setHasRegisteredPasskey] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  // Campos para registro rápido
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [quickRegisterPhone, setQuickRegisterPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cargo, setCargo] = useState('');

  const {
    initiateLogin,
    loginWithPassword,
    verifyCode,
    isAuthenticated,
    isLoading,
    loginStep,
    hasPassword,
    passwordExpired,
    authStatus,
    setLoginStep
  } = useSupabaseAuth();

  // WebAuthn feature detection
  useEffect(() => {
    const checkWebAuthn = async () => {
      try {
        if (typeof window !== 'undefined' && window.PublicKeyCredential) {
          setIsWebAuthnAvailable(true);
          // Check if user has previously used passkey login
          const hadPasskey = localStorage.getItem('hasPasskey') === 'true';
          setHasRegisteredPasskey(hadPasskey);
        }
      } catch {
        setIsWebAuthnAvailable(false);
      }
    };
    checkWebAuthn();
  }, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { config } = useSiteConfig();

  // Verificar se há um código de convite na URL
  useEffect(() => {
    const inviteParam = searchParams?.get('invite');
    if (inviteParam) {
      setInviteCode(inviteParam);
      setShowInviteField(true);
      setInviteCode(inviteParam);
      setShowInviteField(true);
    }
  }, [searchParams]);

  // Verificar se o usuário já está autenticado
  useEffect(() => {
    // Verificar se temos parâmetros 't' ou 'logout' na URL (vindo de logout)
    const hasTimestamp = searchParams?.get('t');
    const isFromLogout = searchParams?.get('logout') === 'true';

    // Também verificar flag de logout no storage
    const isLoggingOut = localStorage.getItem('logout_in_progress') === 'true' ||
      sessionStorage.getItem('logout_in_progress') === 'true';

    // Se estamos vindo de um logout, limpar os parâmetros da URL para permitir login novamente
    if (isFromLogout || hasTimestamp || isLoggingOut) {
      console.log('🚫 Login page - Detectado logout em progresso, limpando parâmetros da URL');

      // Limpar as flags de logout
      localStorage.removeItem('logout_in_progress');
      sessionStorage.removeItem('logout_in_progress');

      // Limpar os parâmetros da URL usando replace para não adicionar ao histórico
      if (typeof window !== 'undefined') {
        const cleanUrl = window.location.pathname; // Sem query params
        window.history.replaceState({}, '', cleanUrl);
      }

      // Não redirecionar automaticamente
      return;
    }

    if (isAuthenticated) {
      if (passwordExpired) {
        // Se a senha estiver expirada, redirecionar para definir senha
        router.replace('/set-password');
      } else {
        // Se suporta biometria, o usuário não registrou neste app e não recuou neste dispositivo, mostrar modal
        const promptSkipped = localStorage.getItem('passkey_prompt_skipped') === 'true';
        if (isWebAuthnAvailable && !hasRegisteredPasskey && !promptSkipped) {
          setShowBiometricPrompt(true);
        } else {
          router.replace('/dashboard');
        }
      }
    }
  }, [isAuthenticated, passwordExpired, router, searchParams, isWebAuthnAvailable, hasRegisteredPasskey]);

  // Garantir que o usuário administrador exista
  useEffect(() => {
    const ensureAdmin = async () => {
      try {
        const data = await fetchWrapper.get('/api/auth/ensure-admin');
        console.log('Verificação de admin:', data);
      } catch (error) {
        console.error('Erro ao verificar admin:', error);
      }
    };

    ensureAdmin();
  }, []);

  // Listener para evento de email não verificado
  useEffect(() => {
    const handleEmailNotVerified = (event: CustomEvent) => {
      const { email } = event.detail;
      setEmailToVerify(email);
      setShowEmailVerification(true);
    };

    window.addEventListener('emailNotVerified', handleEmailNotVerified as EventListener);

    return () => {
      window.removeEventListener('emailNotVerified', handleEmailNotVerified as EventListener);
    };
  }, []);

  // Função para iniciar o login com email
  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Import the validation function with error handling
    let validateEmail;
    try {
      const schema = await import('@/lib/schema');
      validateEmail = schema.validateEmail;
    } catch (error) {
      console.error('Error importing schema:', error);
      // Fallback validation function
      validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      };
    }

    // Validar o email
    if (!email) {
      setError(t('auth.invalidEmail'));
      return;
    }

    // Verificar se é o email do administrador
    if (email === (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '') || email === (process.env.ADMIN_EMAIL || '')) {
      console.log('Email do administrador detectado, iniciando login normal');

      // Iniciar o processo de login normal, que redirecionará para a tela de senha
      const initSuccess = await initiateLogin(
        '',  // phoneNumber vazio
        email,
        inviteCode || undefined
      );

      if (initSuccess) {
        console.log('Login iniciado com sucesso para o administrador');
      }
      return;
    }

    try {
      // Iniciar o processo de login
      const success = await initiateLogin(
        '', // phoneNumber vazio
        email,
        inviteCode || undefined
      );

      if (success) {
        // Não mostrar nenhuma mensagem de código enviado, apenas redirecionar para a próxima etapa
        setSuccess('');
      } else if (authStatus === 'pending') {
        setError(t('auth.pendingRequestMessage'));
      } else if (authStatus === 'unauthorized') {
        setError(t('auth.unauthorizedAccessMessage'));
      } else if (authStatus === 'inactive') {
        setError('Sua conta está desativada. Entre em contato com o suporte.');
      } else if (authStatus === 'pending_registration' || authStatus === 'incomplete_registration') {
        // Usuário existe mas registro não foi completado
        console.log(`Email encontrado mas registro incompleto: ${email}. Direcionando para completar registro.`);
        console.log('DEBUG: authStatus detectado:', authStatus);
        console.log('DEBUG: AuthContext já deve ter mudado loginStep para quick_register automaticamente');

        // Mostrar formulário de registro rápido para completar o cadastro
        setError('');
        setSuccess(t('auth.completeRegistration', 'Complete seu cadastro para acessar o sistema.'));

        // Não precisamos chamar setLoginStep aqui, pois o AuthContext já fez isso automaticamente
        console.log('DEBUG: loginStep será alterado pelo AuthContext automaticamente');
      } else if (authStatus === 'new_email' || authStatus === 'new_phone') {
        // Redirecionar para a página de registro com o email preenchido
        console.log(`Email não cadastrado: ${email}. Redirecionando para registro.`);

        // Mostrar formulário de registro rápido em vez de redirecionar
        setError('');
        setSuccess(t('auth.notRegisteredYet', 'Este email ainda não está cadastrado. Por favor, complete seu cadastro abaixo.'));

        // AuthContext deve gerenciar o loginStep automaticamente baseado no authStatus
      } else {
        setError(t('auth.invalidEmail'));
      }
    } catch (error) {
      console.error('Erro ao iniciar login:', error);
      setError(t('auth.requestError'));
    }
  };

  const handleWebAuthnLogin = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!isWebAuthnAvailable) {
      const { toast } = await import('react-hot-toast');
      toast.error(t('auth.biometricNotSupported', 'Biometria indisponível. Verifique se seu navegador suporta e se você está em um ambiente seguro (HTTPS).'));
      return;
    }
    try {
      setIsWebAuthnLoading(true);
      setError('');
      setSuccess('');

      const { startAuthentication } = await import('@simplewebauthn/browser');

      // 1. Get options from server
      const optionsRes = await fetch('/api/auth/webauthn/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || undefined })
      });

      if (!optionsRes.ok) throw new Error('Erro ao obter opções de login biométrico');
      const options = await optionsRes.json();

      // 2. Start authentication
      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON: options });
      } catch (error: any) {
        if (error.name === 'NotAllowedError') return;
        throw new Error('Falha na interação com o dispositivo biométrico.');
      }

      // 3. Verify on server
      const verificationRes = await fetch('/api/auth/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asseResp),
      });

      const verificationResult = await verificationRes.json();

      if (verificationResult.success && verificationResult.token) {
        setSuccess(t('auth.biometricSuccess', 'Login com biometria realizado com sucesso!'));
        // Mark that this device has a passkey for auto-prompt on next visit
        localStorage.setItem('hasPasskey', 'true');
        // Save the token
        saveToken(verificationResult.token);

        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        throw new Error(verificationResult.error || t('auth.biometricError', 'Erro na verificação biométrica'));
      }
    } catch (error: any) {
      console.error(error);
      setError(error.message || t('auth.biometricError', 'Erro ao realizar login biométrico'));
    } finally {
      setIsWebAuthnLoading(false);
    }
  };

  // Função para verificar o código
  const handleVerificationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validar o código de verificação
    if (!verificationCode || verificationCode.length !== 6) {
      setError(t('auth.invalidCode'));
      return;
    }

    try {
      // Verificar o código
      const success = await verifyCode(
        '', // phoneNumber vazio
        verificationCode,
        email,
        inviteCode || undefined
      );

      if (success) {
        // O redirecionamento é feito no useEffect quando isAuthenticated muda
      } else if (authStatus === 'pending') {
        setError(t('auth.pendingRequestMessage'));
      } else if (authStatus === 'unauthorized') {
        setError(t('auth.unauthorizedAccessMessage'));
      } else if (authStatus === 'inactive') {
        setError('Sua conta está desativada. Entre em contato com o suporte.');
      } else {
        setError(t('auth.invalidCode'));
      }
    } catch (error) {
      setError(t('auth.codeError'));
    }
  };

  // Função para login com senha
  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Validar a senha
      if (!password) {
        setError(t('common.required'));
        return;
      }

      // Determinar se estamos usando email
      const identifier = email;

      if (!identifier) {
        setError(t('auth.invalidEmail'));
        return;
      }

      // Verificar se é o administrador
      if (identifier === (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '') ||
        identifier === (process.env.ADMIN_EMAIL || '')) {
        console.log('Usuário administrador detectado');
        // Não definimos mais a senha automaticamente, o usuário precisa digitar
      }

      console.log('Tentando login com senha:', {
        email: identifier,
        password: password.substring(0, 3) + '...',
        rememberMe
      });

      const success = await loginWithPassword(identifier, password, rememberMe);
      console.log('Resultado do login:', success ? 'Sucesso' : 'Falha');

      if (!success) {
        // Informar que a senha está incorreta
        setError(t('auth.invalidPassword'));
      }
    } catch (error) {
      console.error('Erro ao fazer login com senha:', error);
      setError(t('auth.requestError'));
    }
  };

  // Função para lidar com o registro rápido
  const handleQuickRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Validar os campos obrigatórios
      if (!firstName || !lastName) {
        setError(t('register.error.requiredFields', 'Nome e sobrenome são obrigatórios'));
        return;
      }

      if (!quickRegisterPhone) {
        setError(t('register.error.phoneRequired', 'Telefone é obrigatório'));
        return;
      }

      if (!cpf) {
        setError(t('register.error.cpfRequired', 'CPF é obrigatório'));
        return;
      }

      if (!cargo) {
        setError(t('register.error.cargoRequired', 'Cargo é obrigatório'));
        return;
      }

      // Validar formato do CPF (11 dígitos)
      const cpfNumbers = cpf.replace(/\D/g, '');
      if (cpfNumbers.length !== 11) {
        setError(t('register.error.invalidCpf', 'CPF deve ter 11 dígitos'));
        return;
      }

      if (!password) {
        setError(t('auth.passwordRequired', 'A senha é obrigatória'));
        return;
      }

      if (password.length < 8) {
        setError(t('auth.passwordTooShort', 'A senha deve ter pelo menos 8 caracteres'));
        return;
      }

      if (password !== confirmPassword) {
        setError(t('auth.passwordsDoNotMatch', 'As senhas não coincidem'));
        return;
      }

      // Formatar o número de telefone para o formato internacional
      let formattedPhone = quickRegisterPhone;
      if (quickRegisterPhone) {
        formattedPhone = quickRegisterPhone.replace(/\s/g, '').replace(/[\(\)\-]/g, '');

        // Se não começar com +, adicionar +55 (Brasil)
        if (!formattedPhone.startsWith('+')) {
          // Remover o 0 inicial se existir
          formattedPhone = formattedPhone.replace(/^0/, '');

          // Se começar com DDD (2 dígitos), adicionar +55
          if (/^[1-9][0-9]/.test(formattedPhone)) {
            formattedPhone = '+55' + formattedPhone;
          } else {
            // Se não tiver DDD, assumir DDD 22 (Campos dos Goytacazes)
            formattedPhone = '+5522' + formattedPhone;
          }
        }
      }

      // Preparar os dados para envio
      const userData = {
        firstName,
        lastName,
        email: email,
        phoneNumber: formattedPhone,
        cpf: cpfNumbers,
        position: cargo,
        password,
        inviteCode: inviteCode || undefined
      };

      console.log('Enviando dados de registro rápido:', {
        ...userData,
        password: '********'
      });

      // Enviar os dados para a API usando o wrapper de fetch
      const data = await fetchWrapper.post('/api/auth/quick-register', userData);

      if (data.success) {
        setSuccess(t('register.success', 'Registro realizado com sucesso!'));

        // Se a conta estiver ativa, fazer login automaticamente
        if (data.accountActive) {
          // Fazer login com a senha
          const identifier = email;
          const loginSuccess = await loginWithPassword(identifier, password, rememberMe);

          if (loginSuccess) {
            // O redirecionamento é feito no useEffect quando isAuthenticated muda
          } else {
            // Redirecionar para a página de login após 2 segundos
            setTimeout(() => {
              setLoginStep('phone');
              setPassword('');
              setConfirmPassword('');
            }, 2000);
          }
        } else {
          // Redirecionar para a página de login após 2 segundos
          setTimeout(() => {
            setLoginStep('phone');
            setPassword('');
            setConfirmPassword('');
          }, 2000);
        }
      } else {
        setError(data.error || t('register.error.generic', 'Erro ao registrar. Por favor, tente novamente.'));
      }
    } catch (error: any) {
      console.error('Erro ao registrar:', error);
      setError(error.message || t('register.error.generic', 'Erro ao registrar. Por favor, tente novamente.'));
    }
  };

  // Modal de definição de senha
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  // Estado para controlar se a senha foi definida com sucesso
  const [passwordSet, setPasswordSet] = useState(false);

  // Efeito para mostrar o modal de definição de senha quando necessário
  useEffect(() => {
    if (passwordExpired) {
      setShowSetPasswordModal(true);
    } else {
      setShowSetPasswordModal(false);
    }
  }, [passwordExpired]);

  // Função para lidar com o sucesso da definição de senha
  const handlePasswordSetSuccess = async () => {
    // Marcar a senha como definida com sucesso
    setPasswordSet(true);
    // Não fechar o modal automaticamente, deixar o usuário clicar em "Continuar"
    // O redirecionamento para o dashboard será feito quando o usuário fechar o modal
    console.log('Senha definida com sucesso');
  };

  // Função para fechar o modal de definição de senha
  const handleCloseSetPasswordModal = () => {
    // Só permitir fechar o modal se a senha foi definida com sucesso
    if (passwordSet) {
      setShowSetPasswordModal(false);
      router.push('/dashboard');
    } else {
      // Se a senha não foi definida, mostrar um alerta
      setError('É necessário definir uma senha antes de continuar.');
    }
  };



  return (
    <div className="min-h-screen flex flex-col px-4 py-6 sm:px-6 sm:py-12 lg:px-8 bg-abz-background overflow-y-auto">

      {showBiometricPrompt && (
        <PostLoginBiometricPrompt
          onSkip={() => {
            localStorage.setItem('passkey_prompt_skipped', 'true');
            setShowBiometricPrompt(false);
            router.replace('/dashboard');
          }}
          onSuccess={() => {
            setShowBiometricPrompt(false);
            router.replace('/dashboard');
          }}
        />
      )}

      {/* Modal de definição de senha */}
      <SetPasswordModal
        isOpen={showSetPasswordModal}
        onClose={handleCloseSetPasswordModal}
        onSuccess={handlePasswordSetSuccess}
      />



      {/* Wrapper com my-auto: centraliza quando o conteúdo cabe na viewport e
          permite rolagem sem cortar o topo quando a viewport é baixa */}
      <div className="my-auto w-full flex flex-col">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          {(config.login_logo || config.logo) && (
            <Image
              src={config.login_logo || config.logo}
              alt={config.companyName + " Logo"}
              width={200}
              height={60}
              className="h-auto w-auto max-w-[150px] sm:max-w-[200px]"
              priority
              unoptimized
            />
          )}
        </div>
        <h2 className="mt-4 sm:mt-6 text-center text-xl sm:text-2xl font-bold leading-8 sm:leading-9 tracking-tight text-abz-blue-dark">
          {loginStep === 'phone' ? t('auth.accessAccount') :
            loginStep === 'verification' ? t('auth.verifyPhone') :
              loginStep === 'password' ? t('auth.enterPassword') :
                loginStep === 'pending' ? t('auth.pendingRequest') :
                  loginStep === 'unauthorized' ? t('auth.unauthorizedAccess') :
                    loginStep === 'quick_register' ? t('register.title', 'Complete seu cadastro') : t('auth.accessAccount')}
        </h2>
        <div className="mt-3 flex justify-center">
          <LanguageSelector variant="inline" />
        </div>
      </div>

      <div className="mt-4 sm:mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-6 shadow-md rounded-lg sm:px-10 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm mb-4">
              {success}
            </div>
          )}

          {/* Formulário de Telefone */}
          {loginStep === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                  {t('auth.email')}
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiUser className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-md border-0 py-2.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue sm:text-sm sm:leading-6"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {t('auth.enterEmail')}
                </p>
              </div>

              <InviteCodeInput
                inviteCode={inviteCode}
                setInviteCode={setInviteCode}
                showInviteField={showInviteField}
                setShowInviteField={setShowInviteField}
              />

              <div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-abz-blue hover:bg-abz-blue-dark"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      {t('auth.sending')}
                    </>
                  ) : (
                    <>
                      {t('auth.continue')} <FiArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Biometric Login - Primary Option */}
              <>
                <div className="relative mt-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-gray-400">
                      {t('auth.biometricOrDivider', 'ou entre com biometria')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleWebAuthnLogin}
                  disabled={isWebAuthnLoading}
                  className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 group"
                >
                  {isWebAuthnLoading ? (
                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                        <FiKey className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <span className="block text-sm font-semibold text-gray-800">
                          {t('auth.biometricLogin', 'Acessar com Biometria / Passkey')}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {t('auth.biometricLoginDesc', 'Impressão digital, reconhecimento facial ou Windows Hello')}
                        </span>
                      </div>
                      <FiArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </>
                  )}
                </button>
              </>
            </form>
          )}

          {/* Formulário de Verificação */}
          {loginStep === 'verification' && (
            <form onSubmit={handleVerificationSubmit} className="space-y-6">
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium leading-6 text-gray-900">
                  {t('auth.verificationCode')}
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="verificationCode"
                    name="verificationCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="block w-full rounded-md border-0 py-2.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue sm:text-sm sm:leading-6"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {t('auth.verificationCodeHelp')}
                </p>
              </div>

              <div className="flex flex-col space-y-3">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-abz-blue hover:bg-abz-blue-dark"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      {t('auth.verifying')}
                    </>
                  ) : (
                    <>
                      {t('auth.verifyCode')} <FiArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={async () => {
                    setVerificationCode('');
                    setError('');
                    setSuccess('');
                    setLocalLoading(true);

                    try {
                      // Chamar a API de reenvio de código
                      const identifier = email;
                      const method = 'email';

                      // Usar o wrapper de fetch para tratar erros de parsing JSON
                      const data = await fetchWrapper.post('/api/auth/resend-code', { identifier, method });

                      if (data.success) {
                        setSuccess(t('auth.codeSentAgain'));
                      } else {
                        setError(data.error || t('auth.resendCodeError'));
                      }
                    } catch (error: any) {
                      console.error('Erro ao reenviar código:', error);
                      setError(error.message || t('auth.resendCodeError'));
                    } finally {
                      setLocalLoading(false);
                    }
                  }}
                  disabled={isLoading || localLoading}
                  variant="outline"
                  className="w-full"
                >
                  {isLoading || localLoading ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                      {t('auth.sending')}
                    </>
                  ) : (
                    t('auth.resendCode')
                  )}
                </Button>

                {process.env.NODE_ENV !== 'production' && (
                  <div className="mt-2 text-center">
                    <a
                      href="/debug/codes"
                      target="_blank"
                      className="text-xs text-gray-500 hover:text-blue-500 transition-colors"
                    >
                      Ver códigos de verificação (Debug)
                    </a>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={() => {
                    setVerificationCode('');
                    setError('');
                    setSuccess('');
                    // Voltar para a etapa de telefone
                    // Isso é feito no contexto, mas podemos forçar aqui
                    window.location.href = '/login';
                  }}
                  variant="link"
                  className="w-full text-abz-blue hover:text-abz-blue-dark"
                >
                  <FiArrowLeft className="mr-2 h-4 w-4" />
                  {t('auth.backToStart')}
                </Button>
              </div>
            </form>
          )}

          {/* Tela de Solicitação Pendente */}
          {loginStep === 'pending' && (
            <div className="space-y-6 text-center">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-6 py-4 rounded-md">
                <h3 className="text-lg font-medium mb-2">{t('auth.pendingRequestTitle')}</h3>
                <p className="mb-4">
                  {t('auth.pendingRequestMessage')}
                </p>
                <p className="text-sm">
                  {t('auth.pendingRequestNotification')}
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  // Reiniciar o processo de login
                  setError('');
                  setSuccess('');
                  // Forçar um recarregamento da página para reiniciar o processo
                  window.location.href = '/login';
                }}
                variant="outline"
                className="w-full"
              >
                <FiArrowLeft className="mr-2 h-4 w-4" />
                {t('auth.backToStart')}
              </Button>
            </div>
          )}

          {/* Tela de Acesso Não Autorizado */}
          {loginStep === 'unauthorized' && (
            <div className="space-y-6 text-center">
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-md">
                <h3 className="text-lg font-medium mb-2">{t('auth.unauthorizedAccessTitle')}</h3>
                <p className="mb-4">
                  {t('auth.unauthorizedAccessMessage')}
                </p>
                <p className="text-sm">
                  {t('auth.unauthorizedAccessContact')}
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  // Reiniciar o processo de login
                  setError('');
                  setSuccess('');
                  setEmail('');
                  setVerificationCode('');
                  setPassword('');
                  setInviteCode('');
                  // Forçar um recarregamento da página para reiniciar o processo
                  window.location.href = '/login';
                }}
                variant="outline"
                className="w-full"
              >
                <FiArrowLeft className="mr-2 h-4 w-4" />
                {t('auth.backToStart')}
              </Button>
            </div>
          )}

          {/* Formulário de Recuperação de Senha */}
          {showForgotPassword && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-semibold mb-4">{t('auth.resetPassword')}</h2>
                <ForgotPasswordForm
                  onCancel={() => setShowForgotPassword(false)}
                  initialEmail={forgotPasswordEmail}
                />
              </div>
            </div>
          )}

          {/* Formulário de Login com Senha */}
          {loginStep === 'password' && !showForgotPassword && (
            <>
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm mb-4">
                {t('auth.registeredUserMessage')}
              </div>
              <form onSubmit={handlePasswordLogin} className="space-y-6">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                    {t('auth.password')}
                  </label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiLock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-md border-0 py-2.5 pl-10 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue sm:text-sm sm:leading-6"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="flex justify-between mt-1">
                    <div className="flex items-center">
                      <input
                        id="rememberMe"
                        name="rememberMe"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
                      />
                      <label htmlFor="rememberMe" className="ml-2 block text-xs text-gray-500">
                        {t('auth.rememberMe')}
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordEmail(email);
                        setShowForgotPassword(true);
                      }}
                      className="text-xs text-abz-blue hover:text-abz-blue-dark"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col space-y-3">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-abz-blue hover:bg-abz-blue-dark"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        {t('auth.loggingIn')}
                      </>
                    ) : (
                      <>
                        {t('auth.login')} <FiArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    onClick={handleWebAuthnLogin}
                    disabled={isLoading || isWebAuthnLoading}
                    variant="outline"
                    className="w-full border-abz-blue text-abz-blue hover:bg-blue-50"
                  >
                    {isWebAuthnLoading ? (
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-abz-blue border-t-transparent rounded-full"></div>
                    ) : (
                      <FiKey className="mr-2 h-4 w-4" />
                    )}
                    {t('auth.biometricLogin', 'Acessar com Biometria / Passkey')}
                  </Button>

                  {/* Botão de código de verificação removido para usuários já cadastrados */}

                  <Button
                    type="button"
                    onClick={() => {
                      setEmail('');
                      setPassword('');
                      setError('');
                      setSuccess('');
                      // Voltar para a etapa de telefone
                      window.location.reload();
                    }}
                    variant="link"
                    className="w-full text-abz-blue hover:text-abz-blue-dark"
                  >
                    <FiArrowLeft className="mr-2 h-4 w-4" />
                    {t('auth.backToStart')}
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* Formulário de Registro Rápido */}
          {loginStep === 'quick_register' && (
            <form onSubmit={handleQuickRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium leading-6 text-gray-900">
                    {t('register.firstName', 'Nome')}*
                  </label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiUser className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="block w-full rounded-md border-0 py-2 pl-9 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue text-sm"
                      placeholder={t('register.firstNamePlaceholder', 'Seu nome')}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium leading-6 text-gray-900">
                    {t('register.lastName', 'Sobrenome')}*
                  </label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiUser className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="block w-full rounded-md border-0 py-2 pl-9 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue text-sm"
                      placeholder={t('register.lastNamePlaceholder', 'Seu sobrenome')}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="identifier" className="block text-sm font-medium leading-6 text-gray-900">
                  {t('auth.email', 'Email')}
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiUser className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="identifier"
                    name="identifier"
                    type="email"
                    value={email}
                    readOnly
                    className="block w-full rounded-md border-0 py-2 pl-9 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 bg-gray-100 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="quickRegisterPhone" className="block text-sm font-medium leading-6 text-gray-900">
                  {t('register.phoneNumber', 'Telefone')}*
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiPhone className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="quickRegisterPhone"
                    name="quickRegisterPhone"
                    type="tel"
                    required
                    value={quickRegisterPhone}
                    onChange={(e) => setQuickRegisterPhone(e.target.value)}
                    className="block w-full rounded-md border-0 py-2 pl-9 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue text-sm"
                    placeholder={t('register.phoneNumberPlaceholder', '+5522999999999')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cpf" className="block text-sm font-medium leading-6 text-gray-900">
                    {t('register.cpf', 'CPF')}*
                  </label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiUser className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="cpf"
                      name="cpf"
                      type="text"
                      required
                      value={cpf}
                      onChange={(e) => {
                        // Aplicar máscara do CPF
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 11) {
                          value = value.replace(/(\d{3})(\d)/, '$1.$2');
                          value = value.replace(/(\d{3})(\d)/, '$1.$2');
                          value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                          setCpf(value);
                        }
                      }}
                      className="block w-full rounded-md border-0 py-2 pl-9 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue text-sm"
                      placeholder={t('register.cpfPlaceholder', '000.000.000-00')}
                      maxLength={14}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="cargo" className="block text-sm font-medium leading-6 text-gray-900">
                    {t('register.position', 'Cargo')}*
                  </label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiUser className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      id="cargo"
                      name="cargo"
                      type="text"
                      required
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      className="block w-full rounded-md border-0 py-2 pl-9 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue text-sm"
                      placeholder={t('register.positionPlaceholder', 'Ex: Desenvolvedor')}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="register-password" className="block text-sm font-medium leading-6 text-gray-900">
                  {t('auth.password', 'Senha')}*
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="register-password"
                    name="register-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-md border-0 py-2 pl-9 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue text-sm"
                    placeholder={t('auth.passwordPlaceholder', 'Mínimo 8 caracteres')}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium leading-6 text-gray-900">
                  {t('auth.confirmPassword', 'Confirmar Senha')}*
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="login-confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-md border-0 py-2 pl-9 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue text-sm"
                    placeholder={t('auth.confirmPasswordPlaceholder', 'Repita a senha')}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      {showConfirmPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <InviteCodeInput
                inviteCode={inviteCode}
                setInviteCode={setInviteCode}
                showInviteField={showInviteField}
                setShowInviteField={setShowInviteField}
              />

              <div className="mb-2">
                <p className="text-xs text-gray-600">
                  {t('register.requiredFields', 'Campos marcados com * são obrigatórios')}
                </p>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-abz-blue hover:bg-abz-blue-dark py-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      {t('register.loading', 'Registrando...')}
                    </>
                  ) : (
                    <>
                      {t('register.submit', 'Registrar')} <FiArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-center mt-3">
                <Button
                  type="button"
                  onClick={() => setLoginStep('phone')}
                  variant="link"
                  className="text-abz-blue hover:text-abz-blue-dark text-sm"
                >
                  <FiArrowLeft className="mr-2 h-4 w-4" />
                  {t('auth.backToIdentifier', 'Voltar para identificação')}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">
                  ABZ Group
                </span>
              </div>
            </div>

            {/* Link para registro */}
            {loginStep === 'phone' && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  {t('auth.notRegistered')} {' '}
                  <Link
                    href="/register"
                    className="text-abz-blue hover:text-abz-blue-dark font-medium"
                  >
                    {t('auth.createAccount')}
                  </Link>
                </p>
              </div>
            )}

            {/* Link para página de definição de senha com código de convite */}
            {inviteCode && (
              <div className="mt-4 text-center">
                <Link
                  href={`/set-password?invite=${inviteCode}`}
                  className="inline-flex items-center text-sm text-abz-blue hover:text-abz-blue-dark"
                >
                  <FiKey className="mr-1" />
                  {t('auth.setPasswordWithInvite')}
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} ABZ Group. {t('common.all')} {t('common.rights')} {t('common.reserved')}.
          </p>
          <div className="mt-3 flex flex-col items-center">
            <p className="text-xs text-gray-500 mb-2">
              {t('common.developedBy')}: <span className="font-semibold">Caio Valerio Goulart Correia</span>
            </p>
            <div className="flex space-x-4">
              <a href="https://www.linkedin.com/in/caio-goulart/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <FaLinkedin className="h-5 w-5 text-gray-400 hover:text-blue-600 transition-colors" />
              </a>
              <a href="https://github.com/Caiolinooo" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <FaGithub className="h-5 w-5 text-gray-400 hover:text-gray-700 transition-colors" />
              </a>
              <a href="https://www.instagram.com/Tal_do_Goulart" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <FaInstagram className="h-5 w-5 text-gray-400 hover:text-pink-600 transition-colors" />
              </a>
            </div>
          </div>
        </div>

        {/* Modal de verificação de email */}
        {showEmailVerification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <EmailVerificationPrompt
                email={emailToVerify}
                onVerificationSent={() => {
                  setShowEmailVerification(false);
                }}
                onClose={() => setShowEmailVerification(false)}
              />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
