'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import InviteCodeInput from '@/components/Auth/InviteCodeInput';
import ForgotPasswordForm from '@/components/Auth/ForgotPasswordForm';
import { SetPasswordModal } from '@/components/Auth/SetPasswordModal';
import EmailVerificationPrompt from '@/components/Auth/EmailVerificationPrompt';
import PostLoginBiometricPrompt from '@/components/Auth/PostLoginBiometricPrompt';
import LanguageSelector from '@/components/LanguageSelector';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteConfig } from '@/contexts/SiteConfigContext';
import {
  assertEmail,
  ensureAdminExists,
  loginWithWebAuthn,
  mapInitiateFailure,
  mapVerifyFailure,
  postLoginPath,
  resendLoginCode,
  submitQuickRegister,
  validateQuickRegister,
} from './mobile-login-flow';
import TouchButton from './TouchButton';

export default function MobileLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { config } = useSiteConfig();
  const {
    initiateLogin,
    loginWithPassword,
    verifyCode,
    isAuthenticated,
    isLoading,
    loginStep,
    setLoginStep,
    authStatus,
    passwordExpired,
  } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteField, setShowInviteField] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailToVerify, setEmailToVerify] = useState('');
  const [isWebAuthnAvailable, setIsWebAuthnAvailable] = useState(false);
  const [hasRegisteredPasskey, setHasRegisteredPasskey] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [quickRegisterPhone, setQuickRegisterPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cargo, setCargo] = useState('');
  const [mapStatusAfterInit, setMapStatusAfterInit] = useState(false);

  const logo = config.login_logo || config.logo || '/images/LC1_Azul.png';

  useEffect(() => {
    const inviteParam = searchParams?.get('invite');
    if (inviteParam) {
      setInviteCode(inviteParam);
      setShowInviteField(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setIsWebAuthnAvailable(true);
      setHasRegisteredPasskey(localStorage.getItem('hasPasskey') === 'true');
    }
  }, []);

  useEffect(() => {
    ensureAdminExists().catch(() => {});
  }, []);

  useEffect(() => {
    const handleEmailNotVerified = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setEmailToVerify(detail?.email || '');
      setShowEmailVerification(true);
    };
    window.addEventListener('emailNotVerified', handleEmailNotVerified);
    return () => window.removeEventListener('emailNotVerified', handleEmailNotVerified);
  }, []);

  useEffect(() => {
    const hasTimestamp = searchParams?.get('t');
    const isFromLogout = searchParams?.get('logout') === 'true';
    const isLoggingOut =
      localStorage.getItem('logout_in_progress') === 'true' ||
      sessionStorage.getItem('logout_in_progress') === 'true';
    if (isFromLogout || hasTimestamp || isLoggingOut) {
      localStorage.removeItem('logout_in_progress');
      sessionStorage.removeItem('logout_in_progress');
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
      return;
    }
    if (!isAuthenticated) return;
    if (passwordExpired) {
      setShowSetPasswordModal(true);
      return;
    }
    const promptSkipped = localStorage.getItem('passkey_prompt_skipped') === 'true';
    if (isWebAuthnAvailable && !hasRegisteredPasskey && !promptSkipped) {
      setShowBiometricPrompt(true);
      return;
    }
    router.replace(postLoginPath(false));
  }, [
    isAuthenticated,
    passwordExpired,
    router,
    searchParams,
    isWebAuthnAvailable,
    hasRegisteredPasskey,
  ]);

  useEffect(() => {
    setShowSetPasswordModal(Boolean(passwordExpired));
  }, [passwordExpired]);

  useEffect(() => {
    if (!mapStatusAfterInit) return;
    const mapped = mapInitiateFailure(authStatus, t);
    if (mapped.step) setLoginStep(mapped.step);
    setError(mapped.error || '');
    setSuccess(mapped.success || '');
    setMapStatusAfterInit(false);
  }, [mapStatusAfterInit, authStatus, setLoginStep, t]);

  const onEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const invalid = assertEmail(email, t);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const ok = await initiateLogin('', email, inviteCode || undefined);
      if (ok) {
        setSuccess('');
        return;
      }
      setMapStatusAfterInit(true);
    } catch {
      setError(t('auth.requestError'));
    } finally {
      setBusy(false);
    }
  };

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!password) {
      setError(t('common.required'));
      return;
    }
    setBusy(true);
    try {
      const ok = await loginWithPassword(email, password, rememberMe);
      if (!ok) setError(t('auth.invalidPassword'));
    } catch {
      setError(t('auth.requestError'));
    } finally {
      setBusy(false);
    }
  };

  const onCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!verificationCode || verificationCode.length !== 6) {
      setError(t('auth.invalidCode'));
      return;
    }
    setBusy(true);
    try {
      const ok = await verifyCode('', verificationCode, email, inviteCode || undefined);
      if (!ok) setError(mapVerifyFailure(authStatus, t));
    } catch {
      setError(t('auth.codeError'));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const result = await resendLoginCode(email);
      if (result.success) setSuccess(t('auth.codeSentAgain'));
      else setError(result.error || t('auth.resendCodeError'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.resendCodeError');
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const onWebAuthn = async () => {
    setError('');
    setSuccess('');
    if (!isWebAuthnAvailable) {
      setError(
        t(
          'auth.biometricNotSupported',
          'Biometria indisponível. Verifique se seu navegador suporta e se você está em um ambiente seguro (HTTPS).',
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const result = await loginWithWebAuthn(email || undefined);
      if (result.cancelled) return;
      if (result.success) {
        setSuccess(t('auth.biometricSuccess', 'Login com biometria realizado com sucesso!'));
        window.setTimeout(() => {
          window.location.href = postLoginPath(false);
        }, 1000);
        return;
      }
      const fallback =
        result.error === 'biometric-unavailable'
          ? t(
              'auth.biometricNotSupported',
              'Biometria indisponível. Verifique se seu navegador suporta e se você está em um ambiente seguro (HTTPS).',
            )
          : t('auth.biometricError', 'Erro ao realizar login biométrico');
      setError(result.error && result.error !== 'options' && result.error !== 'device' && result.error !== 'verify'
        ? result.error
        : fallback);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.biometricError', 'Erro ao realizar login biométrico');
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const onQuickRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const invalid = validateQuickRegister(
      {
        firstName,
        lastName,
        phone: quickRegisterPhone,
        cpf,
        cargo,
        password,
        confirmPassword,
      },
      t,
    );
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const result = await submitQuickRegister({
        firstName,
        lastName,
        email,
        phone: quickRegisterPhone,
        cpf,
        cargo,
        password,
        inviteCode,
      });
      if (!result.success) {
        setError(result.error || t('register.error.generic', 'Erro ao registrar. Por favor, tente novamente.'));
        return;
      }
      setSuccess(t('register.success', 'Registro realizado com sucesso!'));
      if (result.accountActive) {
        const ok = await loginWithPassword(email, password, rememberMe);
        if (!ok) {
          window.setTimeout(() => {
            setLoginStep('phone');
            setPassword('');
            setConfirmPassword('');
          }, 2000);
        }
        return;
      }
      window.setTimeout(() => {
        setLoginStep('phone');
        setPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('register.error.generic', 'Erro ao registrar. Por favor, tente novamente.');
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const title =
    loginStep === 'verification'
      ? t('auth.verifyPhone')
      : loginStep === 'password'
        ? t('auth.enterPassword')
        : loginStep === 'pending'
          ? t('auth.pendingRequest')
          : loginStep === 'unauthorized'
            ? t('auth.unauthorizedAccess')
            : loginStep === 'quick_register'
              ? t('register.title', 'Complete seu cadastro')
              : t('auth.accessAccount');

  const disabled = busy || isLoading;

  return (
    <div className="flex min-h-dvh flex-col abz-m-bg px-4 py-6" data-abz-mobile-login="" data-abz-login-step={loginStep}>
      {showBiometricPrompt ? (
        <PostLoginBiometricPrompt
          onSkip={() => {
            localStorage.setItem('passkey_prompt_skipped', 'true');
            setShowBiometricPrompt(false);
            router.replace(postLoginPath(false));
          }}
          onSuccess={() => {
            setShowBiometricPrompt(false);
            router.replace(postLoginPath(false));
          }}
        />
      ) : null}

      <SetPasswordModal
        isOpen={showSetPasswordModal}
        onClose={() => {
          if (passwordSet) {
            setShowSetPasswordModal(false);
            router.push(postLoginPath(false));
          } else {
            setError('É necessário definir uma senha antes de continuar.');
          }
        }}
        onSuccess={() => {
          setPasswordSet(true);
        }}
      />

      {showForgotPassword ? (
        <div className="abz-m-dialog" role="dialog" aria-modal="true" aria-label={t('auth.resetPassword')}>
          <button type="button" className="abz-m-scrim" aria-label="Fechar" onClick={() => setShowForgotPassword(false)} />
          <div className="abz-m-sheet absolute inset-x-0 bottom-0 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">{t('auth.resetPassword')}</h2>
            <ForgotPasswordForm
              onCancel={() => setShowForgotPassword(false)}
              initialEmail={forgotPasswordEmail || email}
            />
          </div>
        </div>
      ) : null}

      {showEmailVerification ? (
        <div className="abz-m-dialog" role="dialog" aria-modal="true">
          <button type="button" className="abz-m-scrim" aria-label="Fechar" onClick={() => setShowEmailVerification(false)} />
          <div className="abz-m-sheet absolute inset-x-0 bottom-0 bg-white p-4">
            <EmailVerificationPrompt
              email={emailToVerify}
              onVerificationSent={() => setShowEmailVerification(false)}
              onClose={() => setShowEmailVerification(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 flex flex-col items-center gap-3 pt-4">
          <Image src={logo} alt="ABZ Group" width={64} height={64} priority unoptimized />
          <h1 className="text-2xl font-extrabold text-[#005B96]">{title}</h1>
          <LanguageSelector variant="inline" />
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          {error ? (
            <p className="abz-m-alert-error mb-3 rounded-xl px-3 py-2 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="abz-m-alert-ok mb-3 rounded-xl px-3 py-2 text-sm" role="status">
              {success}
            </p>
          ) : null}

          {loginStep === 'phone' ? (
            <form onSubmit={onEmail} noValidate className="flex flex-col gap-3" data-abz-login-form="email">
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-login-email">
                {t('auth.email')}
              </label>
              <input
                id="mobile-login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base"
              />
              <InviteCodeInput
                inviteCode={inviteCode}
                setInviteCode={setInviteCode}
                showInviteField={showInviteField}
                setShowInviteField={setShowInviteField}
              />
              <TouchButton type="submit" disabled={disabled} className="w-full">
                {t('auth.continue')}
              </TouchButton>
              <div className="relative my-1 text-center text-xs text-gray-400">
                <span>{t('auth.biometricOrDivider', 'ou entre com biometria')}</span>
              </div>
              <TouchButton
                type="button"
                variant="ghost"
                className="w-full"
                disabled={disabled}
                onClick={onWebAuthn}
                data-abz-login-biometric=""
              >
                {t('auth.biometricLogin', 'Entrar com Biometria')}
              </TouchButton>
              <p className="text-center text-xs text-gray-500">
                {t('auth.biometricLoginDesc', 'Impressão digital, reconhecimento facial ou Windows Hello')}
              </p>
            </form>
          ) : null}

          {loginStep === 'password' && !showForgotPassword ? (
            <form onSubmit={onPassword} className="flex flex-col gap-3" data-abz-login-form="password">
              <p className="text-sm text-gray-600">{email}</p>
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-login-password">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="mobile-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="touch-target w-full rounded-xl border border-gray-200 px-3 pr-12 text-base"
                />
                <button
                  type="button"
                  className="touch-target absolute inset-y-0 right-0 px-3 text-gray-500"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="flex touch-target items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-5 w-5"
                  />
                  {t('auth.rememberMe')}
                </label>
                <button
                  type="button"
                  className="touch-target text-sm font-semibold text-[#005B96]"
                  onClick={() => {
                    setForgotPasswordEmail(email);
                    setShowForgotPassword(true);
                  }}
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <TouchButton type="submit" disabled={disabled} className="w-full">
                {t('auth.login')}
              </TouchButton>
              <TouchButton type="button" variant="ghost" className="w-full" disabled={disabled} onClick={onWebAuthn}>
                {t('auth.biometricLogin', 'Acessar com Biometria / Passkey')}
              </TouchButton>
              <TouchButton
                type="button"
                variant="link"
                className="w-full"
                onClick={() => {
                  setPassword('');
                  setError('');
                  setSuccess('');
                  setLoginStep('phone');
                }}
              >
                {t('auth.backToStart')}
              </TouchButton>
            </form>
          ) : null}

          {loginStep === 'verification' ? (
            <form onSubmit={onCode} className="flex flex-col gap-3" data-abz-login-form="otp">
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-login-code">
                {t('auth.verificationCode')}
              </label>
              <input
                id="mobile-login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base tracking-widest"
              />
              <TouchButton type="submit" disabled={disabled} className="w-full">
                {t('auth.verifyCode')}
              </TouchButton>
              <TouchButton type="button" variant="ghost" className="w-full" disabled={disabled} onClick={onResend}>
                {t('auth.resendCode')}
              </TouchButton>
              <TouchButton
                type="button"
                variant="link"
                className="w-full"
                onClick={() => {
                  setVerificationCode('');
                  setError('');
                  setSuccess('');
                  setLoginStep('phone');
                }}
              >
                {t('auth.backToStart')}
              </TouchButton>
            </form>
          ) : null}

          {loginStep === 'pending' ? (
            <div className="flex flex-col gap-3" data-abz-login-form="pending">
              <p className="text-sm text-gray-700">{t('auth.pendingRequestMessage')}</p>
              <TouchButton type="button" variant="ghost" className="w-full" onClick={() => setLoginStep('phone')}>
                {t('auth.backToStart')}
              </TouchButton>
            </div>
          ) : null}

          {loginStep === 'unauthorized' ? (
            <div className="flex flex-col gap-3" data-abz-login-form="unauthorized">
              <p className="text-sm text-gray-700">{t('auth.unauthorizedAccessMessage')}</p>
              <TouchButton
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setEmail('');
                  setVerificationCode('');
                  setPassword('');
                  setInviteCode('');
                  setError('');
                  setSuccess('');
                  setLoginStep('phone');
                }}
              >
                {t('auth.backToStart')}
              </TouchButton>
            </div>
          ) : null}

          {loginStep === 'quick_register' ? (
            <form onSubmit={onQuickRegister} className="flex flex-col gap-3" data-abz-login-form="quick-register">
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-first-name">
                {t('register.firstName', 'Nome')}*
              </label>
              <input
                id="mobile-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base"
              />
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-last-name">
                {t('register.lastName', 'Sobrenome')}*
              </label>
              <input
                id="mobile-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base"
              />
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-phone">
                {t('register.phone', 'Telefone')}*
              </label>
              <input
                id="mobile-phone"
                value={quickRegisterPhone}
                onChange={(e) => setQuickRegisterPhone(e.target.value)}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base"
              />
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-cpf">
                CPF*
              </label>
              <input
                id="mobile-cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base"
              />
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-cargo">
                {t('register.position', 'Cargo')}*
              </label>
              <input
                id="mobile-cargo"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base"
              />
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-reg-password">
                {t('auth.password')}*
              </label>
              <input
                id="mobile-reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base"
              />
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-reg-confirm">
                {t('auth.confirmPassword', 'Confirmar senha')}*
              </label>
              <input
                id="mobile-reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="touch-target w-full rounded-xl border border-gray-200 px-3 text-base"
              />
              <InviteCodeInput
                inviteCode={inviteCode}
                setInviteCode={setInviteCode}
                showInviteField={showInviteField}
                setShowInviteField={setShowInviteField}
              />
              <TouchButton type="submit" disabled={disabled} className="w-full">
                {t('register.submit', 'Registrar')}
              </TouchButton>
              <TouchButton type="button" variant="link" className="w-full" onClick={() => setLoginStep('phone')}>
                {t('auth.backToIdentifier', 'Voltar para identificação')}
              </TouchButton>
            </form>
          ) : null}

          {loginStep === 'phone' ? (
            <p className="mt-4 text-center text-sm text-gray-600">
              {t('auth.notRegistered')}{' '}
              <Link href="/register" className="font-semibold text-[#005B96]">
                {t('auth.createAccount')}
              </Link>
            </p>
          ) : null}

          {inviteCode ? (
            <p className="mt-3 text-center">
              <Link href={`/set-password?invite=${inviteCode}`} className="text-sm font-semibold text-[#005B96]">
                {t('auth.setPasswordWithInvite')}
              </Link>
            </p>
          ) : null}
        </div>

        <a
          href="/api/ui-surface?to=desktop&next=/login"
          className="touch-target mt-6 inline-flex items-center justify-center text-sm font-semibold text-[#005B96]"
          data-abz-ui-switch="full-desktop"
        >
          Ver versão completa
        </a>
      </div>
    </div>
  );
}
