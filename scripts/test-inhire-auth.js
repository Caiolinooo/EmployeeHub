#!/usr/bin/env node
/**
 * Teste do auth InHire conforme manual (https://docs.inhire.com.br/guides/auth).
 *
 * Uso:
 *   INHIRE_EMAIL=... INHIRE_PASSWORD=... INHIRE_TENANT=... node scripts/test-inhire-auth.js
 *
 * Opcional:
 *   INHIRE_AUTH_URL (default https://auth.inhire.app)
 *   INHIRE_API_URL  (default https://api.inhire.app)
 *
 * Nunca imprime tokens nem senha. Exit 0 = tudo ok; 1 = falha (com etapa e status).
 */

const email = process.env.INHIRE_EMAIL;
const password = process.env.INHIRE_PASSWORD;
const tenant = process.env.INHIRE_TENANT;
const authBase = (process.env.INHIRE_AUTH_URL || 'https://auth.inhire.app').replace(/\/$/, '');
const apiBase = (process.env.INHIRE_API_URL || 'https://api.inhire.app').replace(/\/$/, '');

if (!email || !password) {
  console.error('Faltam INHIRE_EMAIL / INHIRE_PASSWORD no ambiente.');
  process.exit(1);
}
if (!tenant) {
  console.error('Falta INHIRE_TENANT no ambiente (subdomínio do cliente, ex: "grupoabz").');
  process.exit(1);
}

function fail(etapa, err) {
  console.error(`FALHA [${etapa}]: ${err}`);
  process.exit(1);
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

(async () => {
  console.log(`authBase=${authBase} apiBase=${apiBase} tenant=${tenant} email=${email.replace(/^(.{2}).+(@.+)$/, '$1***$2')}`);

  // 1) Login
  const login = await post(`${authBase}/login`, { email, password });
  if (login.status !== 200) fail('login', `HTTP ${login.status} ${JSON.stringify(login.json).slice(0, 300)}`);
  const accessToken = login.json.accessToken || login.json.access_token || login.json.token;
  const refreshToken = login.json.refreshToken || login.json.refresh_token;
  if (!accessToken) fail('login', `resposta sem accessToken: ${JSON.stringify(Object.keys(login.json))}`);
  if (!refreshToken) fail('login', `resposta sem refreshToken: ${JSON.stringify(Object.keys(login.json))}`);
  console.log('login: OK (accessToken + refreshToken recebidos)');

  // 2) Refresh (somente refreshToken — servidor rejeita campos extras)
  const refresh = await post(`${authBase}/refresh`, { refreshToken });
  if (refresh.status !== 200) {
    console.warn(`refresh: HTTP ${refresh.status} ${JSON.stringify(refresh.json).slice(0, 200)} (login continua válido)`);
  } else {
    const novoAccess = refresh.json.accessToken || refresh.json.access_token;
    console.log(`refresh: OK (novo accessToken ${novoAccess ? 'recebido' : 'AUSENTE'})`);
  }

  // 3) Chamada autenticada com X-Tenant
  const res = await fetch(`${apiBase}/jobs/paginated/lean`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': tenant,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ limit: 5 }),
  });
  const bodyText = await res.text();
  if (!res.ok) fail('api /jobs/paginated/lean', `HTTP ${res.status} ${bodyText.slice(0, 300)}`);
  let vagas;
  try {
    vagas = JSON.parse(bodyText);
  } catch {
    vagas = null;
  }
  const total = Array.isArray(vagas) ? vagas.length : (vagas?.results?.length ?? '?');
  console.log(`api /jobs/paginated/lean: OK (HTTP ${res.status}, vagas=${total})`);
  console.log('AUTH INHIRE FUNCIONANDO');
})().catch((e) => fail('exceção', e.message));
