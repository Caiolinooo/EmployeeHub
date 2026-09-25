/**
 * Screenshots 375/390: login passos, home, Mais, Companion.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AFTER_BASE || process.env.PROOF_BASE || 'http://127.0.0.1:3002';
const MOBILE = path.resolve('docs/mobile-audit/fase2/mobile');
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

fs.mkdirSync(MOBILE, { recursive: true });

async function waitStable(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ headless: true });

for (const vp of [
  { w: 375, h: 812, name: '375x812' },
  { w: 390, h: 844, name: '390x844' },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
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
  await ctx.route('**/*users_unified*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify({
        id: 'user-1',
        email: 'exists@example.com',
        active: true,
        password: 'x',
      }),
    });
  });
  await ctx.route('**/api/auth/ensure-admin', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
  });

  const page = await ctx.newPage();
  await page.goto(`${BASE}/m/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitStable(page);
  await page.screenshot({ path: path.join(MOBILE, `login-${vp.name}.png`), fullPage: false });

  const inviteBtn = page.getByRole('button', { name: /convite/i }).first();
  if (await inviteBtn.count()) {
    await inviteBtn.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(MOBILE, `login-invite-${vp.name}.png`), fullPage: false });
  }

  await page.locator('#mobile-login-email').fill('exists@example.com');
  await page.getByRole('button', { name: /continuar/i }).click();
  await page.waitForSelector('[data-abz-login-form="password"]', { timeout: 8000 }).catch(() => {});
  await waitStable(page);
  await page.screenshot({ path: path.join(MOBILE, `login-password-${vp.name}.png`), fullPage: false });

  const forgot = page.getByRole('button', { name: /esqueci|forgot/i }).first();
  if (await forgot.count()) {
    await forgot.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(MOBILE, `login-reset-${vp.name}.png`), fullPage: false });
  }

  await page.goto(`${BASE}/m`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitStable(page);
  await page.screenshot({ path: path.join(MOBILE, `home-${vp.name}.png`), fullPage: false });

  await page.goto(`${BASE}/m?sheet=mais`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitStable(page);
  await page.screenshot({ path: path.join(MOBILE, `mais-${vp.name}.png`), fullPage: false });

  await page.goto(`${BASE}/m?sheet=companion`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitStable(page);
  await page.screenshot({ path: path.join(MOBILE, `companion-${vp.name}.png`), fullPage: false });

  await ctx.close();
}

await browser.close();
console.log(JSON.stringify({ base: BASE, dir: MOBILE }, null, 2));
