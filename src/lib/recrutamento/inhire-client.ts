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

interface TokenSessao {
  accessToken: string;
  refreshToken: string;
  accessExpiraEm: number;
  refreshExpiraEm: number;
}

const ACCESS_TTL_MS = 60 * 60 * 1000; // 1h conforme manual
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias conforme manual

let sessao: TokenSessao | null = null;

interface RespostaLogin {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
  token?: string;
  expires_in?: number;
}

function extrairTokens(json: RespostaLogin): { accessToken: string; refreshToken: string | null } {
  const accessToken = json.accessToken || json.access_token || json.token || '';
  const refreshToken = json.refreshToken || json.refresh_token || null;
  if (!accessToken) throw new Error('Resposta de auth InHire sem accessToken');
  return { accessToken, refreshToken };
}

async function postAuth(cred: InhireCredenciais, path: string, body: Record<string, unknown>): Promise<RespostaLogin> {
  const res = await fetch(`${cred.authBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant': cred.tenant },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`InHire auth ${path} ${res.status}: ${texto.slice(0, 200)}`);
  }
  return (await res.json()) as RespostaLogin;
}

export async function loginInhire(): Promise<string> {
  const cred = await carregarCredenciaisInhire();
  if (!cred) throw new Error('Credenciais InHire não configuradas (app_secrets inhire_*)');

  const agora = Date.now();

  if (sessao && agora < sessao.accessExpiraEm - 30_000) return sessao.accessToken;

  // Refresh: somente refreshToken (servidor rejeita campos extras, ex accessToken)
  if (sessao && sessao.refreshToken && agora < sessao.refreshExpiraEm - 60_000) {
    try {
      const json = await postAuth(cred, '/refresh', { refreshToken: sessao.refreshToken });
      const { accessToken, refreshToken } = extrairTokens(json);
      const refreshFinal = refreshToken || sessao.refreshToken;
      if (!refreshFinal) throw new Error('Refresh InHire sem refreshToken');
      sessao = {
        accessToken,
        refreshToken: refreshFinal,
        accessExpiraEm: agora + ACCESS_TTL_MS,
        refreshExpiraEm: agora + REFRESH_TTL_MS,
      };
      return accessToken;
    } catch {
      sessao = null; // refresh inválido: cai para login completo
    }
  }

  const json = await postAuth(cred, '/login', { email: cred.email, password: cred.password });
  const { accessToken, refreshToken } = extrairTokens(json);
  if (!refreshToken) throw new Error('Login InHire sem refreshToken');
  sessao = {
    accessToken,
    refreshToken,
    accessExpiraEm: agora + ACCESS_TTL_MS,
    refreshExpiraEm: agora + REFRESH_TTL_MS,
  };
  return accessToken;
}

export function limparSessaoInhire(): void {
  sessao = null;
}

async function requestInhire(cred: InhireCredenciais, token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${cred.apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': cred.tenant,
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

export async function inhireFetch(path: string, init?: RequestInit): Promise<unknown> {
  const cred = await carregarCredenciaisInhire();
  if (!cred) throw new Error('Credenciais InHire não configuradas');

  let token = await loginInhire();
  let res = await requestInhire(cred, token, path, init);

  // 401: token rejeitado antes do TTL estimado; força novo login e tenta 1x
  if (res.status === 401) {
    limparSessaoInhire();
    token = await loginInhire();
    res = await requestInhire(cred, token, path, init);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`InHire ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}
