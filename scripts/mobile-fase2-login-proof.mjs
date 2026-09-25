/**
 * Prova do fluxo /m/login com mock de rede. Sem bypass no app.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AFTER_BASE || process.env.PROOF_BASE || 'http://127.0.0.1:3002';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const OUT = path.resolve('docs/mobile-audit/fase2/login-proof.json');

const report = {
  createdAt: new Date().toISOString(),
  base: BASE,
  steps: [],
};

function note(name, data) {
  report.steps.push({ name, ...data });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  userAgent: IPHONE,
  locale: 'pt-BR',
  isMobile: true,
  hasTouch: true,
  extraHTTPHeaders: { 'Sec-CH-UA-Mobile': '?1' },
});
await ctx.addInitScript(() => {
  localStorage.setItem('languageDialogShown', 'true');
  localStorage.setItem('locale', 'pt-BR');
});

const page = await ctx.newPage();
const apiHits = [];
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/auth/') || url.includes('users_unified')) {
    apiHits.push({ method: req.method(), url, post: req.postData() });
  }
});

await page.route('**/*users_unified*', async (route) => {
  const url = route.request().url();
  const existing = url.includes('exists@example.com') || url.includes('exists%40example.com');
  if (existing) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-profile': 'public', 'content-range': '0-0/1' },
      body: JSON.stringify({
        id: 'user-1',
        email: 'exists@example.com',
        active: true,
        password: 'hashed',
      }),
    });
    return;
  }
  await route.fulfill({
    status: 406,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'Results contain 0 rows' }),
  });
});

await page.route('**/api/auth/login', async (route) => {
  const body = route.request().postData() || '';
  if (body.includes('wrong-pass')) {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid password' }),
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      token: 'mock-token-not-a-bypass',
      user: { id: 'user-1', email: 'exists@example.com', first_name: 'Ana' },
    }),
  });
});

await page.route('**/api/auth/resend-code', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true }),
  });
});

await page.route('**/api/auth/webauthn/login/options', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ challenge: 'AAAA', rpId: 'localhost', allowCredentials: [] }),
  });
});

await page.route('**/api/auth/ensure-admin', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true }),
  });
});

await page.goto(`${BASE}/m/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForSelector('[data-abz-mobile-login]');
const emailUi = {
  invite: await page.getByText(/convite/i).count(),
  biometric: await page.locator('[data-abz-login-biometric]').count(),
  create: await page.getByRole('link', { name: /criar conta/i }).count(),
  lang: await page.getByText(/^EN$|^PT$/).count(),
};
note('email-step-ui', { ok: emailUi.invite > 0 && emailUi.biometric > 0 && emailUi.create > 0 && emailUi.lang > 0, emailUi });

await page.locator('#mobile-login-email').fill('');
await page.locator('[data-abz-login-form="email"] button[type="submit"]').click();
const invalidEmail = await page.getByRole('alert').innerText().catch(() => '');
note('invalid-email', { ok: Boolean(invalidEmail), invalidEmail });

await page.locator('#mobile-login-email').fill('new@example.com');
await page.getByRole('button', { name: /continuar/i }).click();
await page.waitForTimeout(800);
const quick = await page.locator('[data-abz-login-form="quick-register"]').count();
note('unknown-email-quick-register', { ok: quick > 0, step: await page.getAttribute('[data-abz-mobile-login]', 'data-abz-login-step') });

await page.getByRole('button', { name: /voltar/i }).first().click();
await page.locator('#mobile-login-email').fill('exists@example.com');
await page.getByRole('button', { name: /continuar/i }).click();
await page.waitForTimeout(1200);
const passwordForm = await page.locator('[data-abz-login-form="password"]').count();
note('existing-email-password', { ok: passwordForm > 0, step: await page.getAttribute('[data-abz-mobile-login]', 'data-abz-login-step') });

if (passwordForm) {
  await page.locator('#mobile-login-password').fill('wrong-pass');
  await page.locator('[data-abz-login-form="password"] button[type="submit"]').click();
  await page.waitForTimeout(800);
  const badPass = await page.getByRole('alert').innerText().catch(() => '');
  note('invalid-password', { ok: Boolean(badPass), badPass });

  await page.locator('#mobile-login-password').fill('correct-pass');
  await page.locator('[data-abz-login-form="password"] button[type="submit"]').click();
  await page.waitForTimeout(1200);
  const loginPost = apiHits.some((h) => h.url.includes('/api/auth/login') && h.method === 'POST');
  note('login-success-destination', {
    ok: loginPost,
    loginPost,
    dest: page.url(),
    expectedPost: '/api/auth/login',
    expectedPath: '/dashboard',
  });
}

await page.goto(`${BASE}/m/login`, { waitUntil: 'domcontentloaded' });
await page.locator('[data-abz-login-biometric]').click();
await page.waitForTimeout(600);
const webauthn = apiHits.some((h) => h.url.includes('/api/auth/webauthn/login/options'));
note('webauthn-options', { ok: webauthn, webauthn });

const desk = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'pt-BR',
});
await desk.addInitScript(() => {
  localStorage.setItem('languageDialogShown', 'true');
  localStorage.setItem('locale', 'pt-BR');
});
const deskPage = await desk.newPage();
await deskPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
const desktopEmail = await deskPage.locator('#email').count();
const desktopIsMobileTree = await deskPage.locator('[data-abz-mobile-login]').count();
note('desktop-login-untouched', {
  ok: desktopEmail > 0 && desktopIsMobileTree === 0,
  desktopEmail,
  desktopIsMobileTree,
});
await desk.close();

await browser.close();
report.ok = report.steps.every((s) => s.ok);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
