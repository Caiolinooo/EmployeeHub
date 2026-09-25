import { fetchWrapper } from '@/lib/fetch-wrapper';
import { validateEmail } from '@/lib/schema';
import { saveToken } from '@/lib/tokenStorage';

export type LoginAuthStatus =
  | 'pending'
  | 'unauthorized'
  | 'inactive'
  | 'pending_registration'
  | 'incomplete_registration'
  | 'new_email'
  | 'new_phone'
  | string
  | null
  | undefined;

export type LoginStep =
  | 'phone'
  | 'verification'
  | 'password'
  | 'complete'
  | 'unauthorized'
  | 'pending'
  | 'quick_register';

export type Translate = (key: string, fallback?: string) => string;

export function postLoginPath(passwordExpired: boolean): '/set-password' | '/dashboard' {
  return passwordExpired ? '/set-password' : '/dashboard';
}

export function mapInitiateFailure(
  authStatus: LoginAuthStatus,
  t: Translate,
): { error?: string; success?: string; step?: LoginStep } {
  switch (authStatus) {
    case 'pending':
      return { error: t('auth.pendingRequestMessage'), step: 'pending' };
    case 'unauthorized':
      return { error: t('auth.unauthorizedAccessMessage'), step: 'unauthorized' };
    case 'inactive':
      return { error: 'Sua conta está desativada. Entre em contato com o suporte.' };
    case 'pending_registration':
    case 'incomplete_registration':
      return {
        success: t('auth.completeRegistration', 'Complete seu cadastro para acessar o sistema.'),
        step: 'quick_register',
      };
    case 'new_email':
    case 'new_phone':
      return {
        success: t(
          'auth.notRegisteredYet',
          'Este email ainda não está cadastrado. Por favor, complete seu cadastro abaixo.',
        ),
        step: 'quick_register',
      };
    default:
      return { error: t('auth.invalidEmail') };
  }
}

export function mapVerifyFailure(authStatus: LoginAuthStatus, t: Translate): string {
  switch (authStatus) {
    case 'pending':
      return t('auth.pendingRequestMessage');
    case 'unauthorized':
      return t('auth.unauthorizedAccessMessage');
    case 'inactive':
      return 'Sua conta está desativada. Entre em contato com o suporte.';
    default:
      return t('auth.invalidCode');
  }
}

export function assertEmail(email: string, t: Translate): string | null {
  if (!email || !validateEmail(email)) return t('auth.invalidEmail', 'Informe um e-mail válido.');
  return null;
}

export function formatQuickRegisterPhone(raw: string): string {
  let formatted = raw.replace(/\s/g, '').replace(/[()\-]/g, '');
  if (!formatted.startsWith('+')) {
    formatted = formatted.replace(/^0/, '');
    if (/^[1-9][0-9]/.test(formatted)) return `+55${formatted}`;
    return `+5522${formatted}`;
  }
  return formatted;
}

export function validateQuickRegister(
  input: {
    firstName: string;
    lastName: string;
    phone: string;
    cpf: string;
    cargo: string;
    password: string;
    confirmPassword: string;
  },
  t: Translate,
): string | null {
  if (!input.firstName || !input.lastName) {
    return t('register.error.requiredFields', 'Nome e sobrenome são obrigatórios');
  }
  if (!input.phone) return t('register.error.phoneRequired', 'Telefone é obrigatório');
  if (!input.cpf) return t('register.error.cpfRequired', 'CPF é obrigatório');
  if (!input.cargo) return t('register.error.cargoRequired', 'Cargo é obrigatório');
  const cpfNumbers = input.cpf.replace(/\D/g, '');
  if (cpfNumbers.length !== 11) return t('register.error.invalidCpf', 'CPF deve ter 11 dígitos');
  if (!input.password) return t('auth.passwordRequired', 'A senha é obrigatória');
  if (input.password.length < 8) {
    return t('auth.passwordTooShort', 'A senha deve ter pelo menos 8 caracteres');
  }
  if (input.password !== input.confirmPassword) {
    return t('auth.passwordsDoNotMatch', 'As senhas não coincidem');
  }
  return null;
}

export async function resendLoginCode(email: string): Promise<{ success: boolean; error?: string }> {
  const data = await fetchWrapper.post('/api/auth/resend-code', {
    identifier: email,
    method: 'email',
  });
  if (data.success) return { success: true };
  return { success: false, error: data.error };
}

export async function submitQuickRegister(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cpf: string;
  cargo: string;
  password: string;
  inviteCode?: string;
}): Promise<{ success: boolean; accountActive?: boolean; error?: string }> {
  const data = await fetchWrapper.post('/api/auth/quick-register', {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phoneNumber: formatQuickRegisterPhone(input.phone),
    cpf: input.cpf.replace(/\D/g, ''),
    position: input.cargo,
    password: input.password,
    inviteCode: input.inviteCode || undefined,
  });
  if (data.success) return { success: true, accountActive: data.accountActive };
  return { success: false, error: data.error };
}

export async function loginWithWebAuthn(email: string | undefined): Promise<{
  success: boolean;
  error?: string;
  cancelled?: boolean;
}> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { success: false, error: 'biometric-unavailable' };
  }
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const optionsRes = await fetch('/api/auth/webauthn/login/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email || undefined }),
  });
  if (!optionsRes.ok) return { success: false, error: 'options' };
  const options = await optionsRes.json();
  let asseResp;
  try {
    asseResp = await startAuthentication({ optionsJSON: options });
  } catch (error: unknown) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
    if (name === 'NotAllowedError') return { success: false, cancelled: true };
    return { success: false, error: 'device' };
  }
  const verificationRes = await fetch('/api/auth/webauthn/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asseResp),
  });
  const verificationResult = await verificationRes.json();
  if (verificationResult.success && verificationResult.token) {
    saveToken(verificationResult.token);
    if (typeof localStorage !== 'undefined') localStorage.setItem('hasPasskey', 'true');
    return { success: true };
  }
  return { success: false, error: verificationResult.error || 'verify' };
}

