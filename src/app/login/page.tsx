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

import { fetchWrapper } from '@/lib/fetch-wrapper';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [showInviteField, setShowInviteField] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

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
  
  // Debug: Log do estado loginStep
  console.log('🎯 DEBUG Frontend - loginStep atual:', loginStep);
  console.log('🎯 DEBUG Frontend - authStatus atual:', authStatus);
  console.log('🎯 DEBUG Frontend - loginStep === quick_register?', loginStep === 'quick_register');
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
      // Se temos um código de convite, vamos preferir o login por email
      setUseEmail(true);
    }
  }, [searchParams]);

  // Verificar se o usuário já está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      if (passwordExpired) {
        // Se a senha estiver expirada, redirecionar para definir senha
        router.replace('/set-password');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, passwordExpired, router]);

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

  // Função para iniciar o login com número de telefone ou email
  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (useEmail) {
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

      // Validar o email com a função melhorada - temporariamente comentado para debugging
      if (!email) {
        setError(t('auth.invalidEmail'));
        return;
      }
      
      // TODO: Reativar validação após teste
      // if (!validateEmail(email)) {
      //   setError(t('auth.invalidEmail'));
      //   return;
      // }

      // Verificar se é o email do administrador
      if (email === 'caio.correia@groupabz.com' || email === 'apiabz@groupabz.com') {
        console.log('Email do administrador detectado, iniciando login normal');

        // Iniciar o processo de login normal, que redirecionará para a tela de senha
        const initSuccess = await initiateLogin(
          '',  // phoneNumber vazio para login por email
          email,
          inviteCode || undefined
        );

        if (initSuccess) {
          console.log('Login iniciado com sucesso para o administrador');
          // Não precisamos mais forçar a mudança para a etapa de senha,
          // pois o backend já retorna hasPassword: true para o admin
        }
        return;
      }
    } else {
      // Validar o número de telefone
      if (!phoneNumber || phoneNumber.length < 10 || !phoneNumber.startsWith('+') || !/^\+[0-9]+$/.test(phoneNumber)) {
        setError(t('auth.invalidPhoneNumber'));
        return;
      }

      // Verificar se é o telefone do administrador
      if (phoneNumber === '+5522997847289' || phoneNumber === '22997847289' || phoneNumber === '997847289') {
        console.log('Telefone do administrador detectado, iniciando login normal');
        // Padronizar o formato do telefone
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+55' + (phoneNumber.startsWith('22') ? phoneNumber : '22' + phoneNumber);
        setPhoneNumber(formattedPhone);

        // Iniciar o processo de login normal, que redirecionará para a tela de senha
        const initSuccess = await initiateLogin(
          formattedPhone,
          undefined,  // email vazio para login por telefone
          inviteCode || undefined
        );

        if (initSuccess) {
          console.log('Login iniciado com sucesso para o administrador');
          // Não precisamos mais forçar a mudança para a etapa de senha,
          // pois o backend já retorna hasPassword: true para o admin
        }
        return;
      }
    }

    try {
      // Iniciar o processo de login
      const success = await initiateLogin(
        useEmail ? '' : phoneNumber,
        useEmail ? email : undefined,
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
        const identifier = useEmail ? email : phoneNumber;
        console.log(`Email/telefone encontrado mas registro incompleto: ${identifier}. Direcionando para completar registro.`);
        console.log('DEBUG: authStatus detectado:', authStatus);
        console.log('DEBUG: AuthContext já deve ter mudado loginStep para quick_register automaticamente');

        // Mostrar formulário de registro rápido para completar o cadastro
        setError('');
        setSuccess(t('auth.completeRegistration', 'Complete seu cadastro para acessar o sistema.'));

        // Não precisamos chamar setLoginStep aqui, pois o AuthContext já fez isso automaticamente
        console.log('DEBUG: loginStep será alterado pelo AuthContext automaticamente');
      } else if (authStatus === 'new_email' || authStatus === 'new_phone') {
        // Redirecionar para a página de registro com o email/telefone preenchido
        const identifier = useEmail ? email : phoneNumber;
        console.log(`Email/telefone não cadastrado: ${identifier}. Redirecionando para registro.`);

        // Mostrar formulário de registro rápido em vez de redirecionar
        setError('');
        setSuccess(t('auth.notRegisteredYet', 'Este email/telefone ainda não está cadastrado. Por favor, complete seu cadastro abaixo.'));

        // AuthContext deve gerenciar o loginStep automaticamente baseado no authStatus
      } else {
        setError(useEmail ? t('auth.invalidEmail') : t('auth.invalidPhoneNumber'));
      }
    } catch (error) {
      console.error('Erro ao iniciar login:', error);
      setError(t('auth.requestError'));
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
        useEmail ? '' : phoneNumber,
        verificationCode,
        useEmail ? email : undefined,
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

      // Determinar se estamos usando email ou telefone
      const identifier = useEmail ? email : phoneNumber;

      if (!identifier) {
        setError(useEmail ? t('auth.invalidEmail') : t('auth.invalidPhoneNumber'));
        return;
      }

      // Verificar se é o administrador e padronizar o identificador
      if (identifier === 'caio.correia@groupabz.com' ||
          identifier === 'apiabz@groupabz.com' ||
          identifier === '+5522997847289' ||
          identifier === '22997847289' ||
          identifier === '997847289') {
        console.log('Usuário administrador detectado');
        // Padronizar o formato do telefone se for um número
        if (!identifier.includes('@')) {
          const formattedPhone = identifier.startsWith('+') ? identifier : '+55' + (identifier.startsWith('22') ? identifier : '22' + identifier);
          if (useEmail) {
            setEmail('caio.correia@groupabz.com');
          } else {
            setPhoneNumber(formattedPhone);
          }
        }
        // Não definimos mais a senha automaticamente, o usuário precisa digitar
      }

      console.log('Tentando login com senha:', {
        [useEmail ? 'email' : 'phoneNumber']: identifier,
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
      let formattedPhone = phoneNumber;
      if (!useEmail && phoneNumber) {
        formattedPhone = phoneNumber.replace(/\s/g, '').replace(/[\(\)\-]/g, '');

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
        email: useEmail ? email : '',
        phoneNumber: quickRegisterPhone || (useEmail ? '' : formattedPhone),
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
          const identifier = useEmail ? email : formattedPhone;
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
    <div className="min-h-screen flex flex-col justify-center px-4 py-6 sm:px-6 sm:py-12 lg:px-8 bg-abz-background">


      {/* Modal de definição de senha */}
      <SetPasswordModal
        isOpen={showSetPasswordModal}
        onClose={handleCloseSetPasswordModal}
        onSuccess={handlePasswordSetSuccess}
      />



      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image
            src={config.logo}
            alt={config.companyName + " Logo"}
            width={200}
            height={60}
            className="h-auto w-auto max-w-[150px] sm:max-w-[200px]"
            priority
            unoptimized
          />
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
              <div className="flex items-center justify-center space-x-4 mb-4">
                <button
                  type="button"
                  onClick={() => setUseEmail(false)}
                  className={`flex items-center px-4 py-2 rounded-md ${!useEmail ? 'bg-abz-blue text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  <FiPhone className="mr-2" />
                  {t('auth.phoneLogin')}
                </button>
                <button
                  type="button"
                  onClick={() => setUseEmail(true)}
                  className={`flex items-center px-4 py-2 rounded-md ${useEmail ? 'bg-abz-blue text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  <FiUser className="mr-2" />
                  {t('auth.emailLogin')}
                </button>
              </div>

              {!useEmail ? (
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium leading-6 text-gray-900">
                    {t('auth.phoneNumber')}
                  </label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiPhone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="login-phone-number"
                      name="phoneNumber"
                      type="tel"
                      autoComplete="tel"
                      required={!useEmail}
                      placeholder="+5511999999999"
                      value={phoneNumber}
                      onChange={(e) => {
                        // Formatar o número de telefone para garantir que esteja no formato correto
                        let value = e.target.value;

                        // Remover todos os caracteres não numéricos, exceto o sinal de +
                        value = value.replace(/[^0-9+]/g, '');

                        // Garantir que o número comece com +
                        if (value && !value.startsWith('+')) {
                          value = '+' + value;
                        }

                        setPhoneNumber(value);
                      }}
                      className="block w-full rounded-md border-0 py-2.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-abz-blue sm:text-sm sm:leading-6"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {t('auth.phoneNumberHelp')}
                  </p>
                </div>
              ) : (
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
                      required={useEmail}
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
              )}

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
                      const identifier = useEmail ? email : phoneNumber;
                      const method = useEmail ? 'email' : 'sms';

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
                    setPhoneNumber('');
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
                  setPhoneNumber('');
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

                  {/* Botão de código de verificação removido para usuários já cadastrados */}

                  <Button
                    type="button"
                    onClick={() => {
                      setPhoneNumber('');
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
                  {useEmail ? t('auth.email', 'Email') : t('auth.phoneNumber', 'Telefone')}
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {useEmail ? <FiUser className="h-4 w-4 text-gray-400" /> : <FiPhone className="h-4 w-4 text-gray-400" />}
                  </div>
                  <input
                    id="identifier"
                    name="identifier"
                    type={useEmail ? "email" : "tel"}
                    value={useEmail ? email : phoneNumber}
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
      </div>
    </div>
  );
}
