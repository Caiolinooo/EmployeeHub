import { supabaseAdmin } from '@/lib/supabase';

interface InhireCredenciais {
  email: string;
  password: string;
  tenant: string;
  apiBase: string;
  authBase: string;
}

const KEYS = {
  email: 'inhire_email',
  password: 'inhire_password',
  tenant: 'inhire_tenant',
  apiBase: 'inhire_api_url',
  authBase: 'inhire_auth_url',
} as const;

async function lerSecret(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('app_secrets')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  const v = (data as { value?: string } | null)?.value;
  return v && String(v).trim() ? String(v).trim() : null;
}

export async function carregarCredenciaisInhire(): Promise<InhireCredenciais | null> {
  const [email, password, tenant, apiBase, authBase] = await Promise.all([
    lerSecret(KEYS.email),
    lerSecret(KEYS.password),
    lerSecret(KEYS.tenant),
    lerSecret(KEYS.apiBase),
    lerSecret(KEYS.authBase),
  ]);
  if (!email || !password) return null;
  return {
    email,
    password,
    tenant: tenant || 'portal',
    apiBase: apiBase || 'https://api.inhire.app',
    authBase: authBase || 'https://auth.inhire.app',
  };
}

let tokenCache: { token: string; em: number } | null = null;

export async function loginInhire(): Promise<string> {
  const cred = await carregarCredenciaisInhire();
  if (!cred) throw new Error('Credenciais Inhire não configuradas (app_secrets inhire_*)');

  if (tokenCache && Date.now() < tokenCache.em - 30_000) return tokenCache.token;

  const res = await fetch(`${cred.authBase}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': cred.tenant,
    },
    body: JSON.stringify({ email: cred.email, password: cred.password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Inhire auth ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token?: string; token?: string; expires_in?: number };
  const token = json.access_token || json.token;
  if (!token) throw new Error('Resposta de login Inhire sem token');
  tokenCache = { token, em: Date.now() + (json.expires_in || 3600) * 1000 };
  return token;
}

export async function inhireFetch(path: string, init?: RequestInit): Promise<unknown> {
  const cred = await carregarCredenciaisInhire();
  if (!cred) throw new Error('Credenciais Inhire não configuradas');
  const token = await loginInhire();
  const res = await fetch(`${cred.apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': cred.tenant,
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Inhire ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}
