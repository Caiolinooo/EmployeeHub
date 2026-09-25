/**
 * Mede getBoundingClientRect dos 4 alvos do login mobile.
 * Viewports: 390×844 e 375×812.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AFTER_BASE || process.env.PROOF_BASE || 'http://127.0.0.1:3002';
const OUT = path.resolve('docs/mobile-audit/fase2/touch-targets.json');
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const VIEWS = [
  { w: 390, h: 844, name: '390x844' },
  { w: 375, h: 812, name: '375x812' },
];

async function measure(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        w: Number(r.width.toFixed(1)),
        h: Number(r.height.toFixed(1)),
        ok: r.width >= 44 && r.height >= 44,
      };
    };
    const langEn = document.querySelector('[data-abz-touch="lang-en"]');
    const langPt = document.querySelector('[data-abz-touch="lang-pt"]');
    const invite = document.querySelector('[data-abz-touch="invite-toggle"]');
    const create = document.querySelector('[data-abz-touch="create-account"]');
    return {
      en: box(langEn),
      pt: box(langPt),
      invite: box(invite),
      createAccount: box(create),
    };
  });
}

const browser = await chromium.launch({ headless: true });
const results = { base: BASE, createdAt: new Date().toISOString(), views: {} };

for (const vp of VIEWS) {
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
  const page = await ctx.newPage();
  await page.goto(`${BASE}/m/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('[data-abz-mobile-login], [data-abz-touch="lang-en"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
  results.views[vp.name] = await measure(page);
  await ctx.close();
}

await browser.close();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
