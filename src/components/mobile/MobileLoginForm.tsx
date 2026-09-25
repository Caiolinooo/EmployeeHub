'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MobileCompanion from './MobileCompanion';
import TouchButton from './TouchButton';

export default function MobileLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    initiateLogin,
    loginWithPassword,
    verifyCode,
    isAuthenticated,
    isLoading,
    loginStep,
    setLoginStep,
  } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const companionDefault = searchParams?.get('sheet') === 'companion';

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const onEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    setBusy(true);
    try {
      const ok = await initiateLogin('', email);
      if (!ok) setError('Não foi possível iniciar o login com este e-mail.');
    } catch {
      setError('Falha ao iniciar o login.');
    } finally {
      setBusy(false);
    }
  };

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Informe a senha.');
      return;
    }
    setBusy(true);
    try {
      const ok = await loginWithPassword(email, password, rememberMe);
      if (!ok) setError('Senha inválida.');
    } catch {
      setError('Falha ao entrar.');
    } finally {
      setBusy(false);
    }
  };

  const onCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!code) {
      setError('Informe o código.');
      return;
    }
    setBusy(true);
    try {
      const ok = await verifyCode('', code, email);
      if (!ok) setError('Código inválido.');
    } catch {
      setError('Falha ao verificar o código.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--mobile-bg,#f3f6fb)] px-4 py-6" data-abz-mobile-login="">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 flex flex-col items-center gap-3 pt-6">
          <Image src="/images/LC1_Azul.png" alt="ABZ Group" width={64} height={64} priority />
          <h1 className="text-2xl font-extrabold text-[#005B96]">Entrar</h1>
          <p className="text-sm text-gray-500 text-center">Portal ABZ no celular. Mesma conta do desktop.</p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          {error ? (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {loginStep === 'phone' || loginStep === 'quick_register' ? (
            <form onSubmit={onEmail} className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-login-email">
                E-mail
              </label>
              <input
                id="mobile-login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="karen.d@example.net"
                className="touch-target min-h-11 rounded-xl border border-gray-200 px-3 text-base"
              />
              <TouchButton type="submit" disabled={busy || isLoading} className="w-full">
                Continuar
              </TouchButton>
            </form>
          ) : null}

          {loginStep === 'password' ? (
            <form onSubmit={onPassword} className="flex flex-col gap-3">
              <p className="text-sm text-gray-600">{email}</p>
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-login-password">
                Senha
              </label>
              <input
                id="mobile-login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="touch-target min-h-11 rounded-xl border border-gray-200 px-3 text-base"
              />
              <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5"
                />
                Lembrar neste aparelho
              </label>
              <TouchButton type="submit" disabled={busy || isLoading} className="w-full">
                Entrar
              </TouchButton>
              <TouchButton
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setLoginStep('phone');
                  setPassword('');
                  setError('');
                }}
              >
                Trocar e-mail
              </TouchButton>
            </form>
          ) : null}

          {loginStep === 'verification' ? (
            <form onSubmit={onCode} className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-gray-700" htmlFor="mobile-login-code">
                Código
              </label>
              <input
                id="mobile-login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="touch-target min-h-11 rounded-xl border border-gray-200 px-3 text-base tracking-widest"
              />
              <TouchButton type="submit" disabled={busy || isLoading} className="w-full">
                Verificar
              </TouchButton>
            </form>
          ) : null}

          {loginStep === 'unauthorized' || loginStep === 'pending' ? (
            <p className="text-sm text-gray-700">
              Seu acesso ainda não está liberado. Fale com o administrador.
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
      <MobileCompanion defaultOpen={companionDefault} />
    </div>
  );
}
