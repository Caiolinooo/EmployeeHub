/**
 * Provas Fase 2: AFTER desktop, mobile, pixel-diff, UA/cookie.
 * Sem login real. Sem commitar bypass.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BASE = process.env.PROOF_BASE || 'http://127.0.0.1:3000';
const ROOT = path.resolve('docs/mobile-audit/fase2');
const AFTER = path.join(ROOT, 'after');
const BEFORE = path.join(ROOT, 'before');
const DIFF = path.join(ROOT, 'diff');
const MOBILE = path.join(ROOT, 'mobile');
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

for (const dir of [AFTER, DIFF, MOBILE]) fs.mkdirSync(dir, { recursive: true });

async function pixelDiff(aPath, bPath, outPath) {
  const a = sharp(aPath);
  const b = sharp(bPath);
  const aMeta = await a.metadata();
  const bMeta = await b.metadata();
  if (aMeta.width !== bMeta.width || aMeta.height !== bMeta.height) {
    return {
      ok: false,
      reason: `size ${aMeta.width}x${aMeta.height} vs ${bMeta.width}x${bMeta.height}`,
      changed: -1,
    };
  }
  const { data: aBuf, info } = await a.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: bBuf } = await b.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(aBuf.length);
  let changed = 0;
  for (let i = 0; i < aBuf.length; i += 4) {
    const dr = Math.abs(aBuf[i] - bBuf[i]);
    const dg = Math.abs(aBuf[i + 1] - bBuf[i + 1]);
    const db = Math.abs(aBuf[i + 2] - bBuf[i + 2]);
    const da = Math.abs(aBuf[i + 3] - bBuf[i + 3]);
    if (dr + dg + db + da > 8) {
      changed += 1;
      out[i] = 255;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
    } else {
      out[i] = aBuf[i];
      out[i + 1] = aBuf[i + 1];
      out[i + 2] = aBuf[i + 2];
      out[i + 3] = 80;
    }
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(outPath);
  return { ok: changed === 0, changed, total: info.width * info.height };
}

async function shot(page, url, file, wait = 2500) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(wait);
  await page.locator('nextjs-portal').evaluateAll((nodes) => nodes.forEach((n) => n.remove())).catch(() => {});
  await page.screenshot({ path: file, fullPage: false });
}

async function headers(url, ua, cookie) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    redirect: 'manual',
  });
  return {
    status: res.status,
    location: res.headers.get('location'),
    vary: res.headers.get('vary'),
    ui: res.headers.get('x-abz-ui'),
  };
}

async function bodyHas(url, ua, cookie, needle) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const text = await res.text();
  return { status: res.status, has: text.includes(needle), ui: res.headers.get('x-abz-ui') };
}

const browser = await chromium.launch({ headless: true });

async function newCtx(opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => {
    localStorage.setItem('languageDialogShown', 'true');
  });
  return ctx;
}

const desktopCtx = await newCtx({
  viewport: { width: 1440, height: 900 },
  userAgent: DESKTOP,
});
const desktop = await desktopCtx.newPage();
desktop.setDefaultTimeout(45000);

const publicRoutes = [
  ['/login', 'login-1440x900.png'],
  ['/register', 'register-1440x900.png'],
  ['/unauthorized', 'unauthorized-1440x900.png'],
  ['/reset-password', 'reset-password-1440x900.png'],
];

for (const [route, file] of publicRoutes) {
  await shot(desktop, `${BASE}${route}`, path.join(AFTER, file));
}

const diffs = {};
for (const [, file] of publicRoutes) {
  const before = path.join(BEFORE, file);
  const after = path.join(AFTER, file);
  if (!fs.existsSync(before) || !fs.existsSync(after)) {
    diffs[file] = { ok: false, reason: 'missing file' };
    continue;
  }
  diffs[file] = await pixelDiff(before, after, path.join(DIFF, file));
}

const mobileViewports = [
  { w: 375, h: 812, name: '375x812' },
  { w: 390, h: 844, name: '390x844' },
];

for (const vp of mobileViewports) {
  const ctx = await newCtx({
    viewport: { width: vp.w, height: vp.h },
    userAgent: IPHONE,
    locale: 'pt-BR',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  await shot(page, `${BASE}/login`, path.join(MOBILE, `login-${vp.name}.png`));
  await shot(page, `${BASE}/login?sheet=companion`, path.join(MOBILE, `login-companion-${vp.name}.png`));
  await shot(page, `${BASE}/m/preview`, path.join(MOBILE, `shell-${vp.name}.png`));
  await shot(page, `${BASE}/m/preview?sheet=mais`, path.join(MOBILE, `mais-${vp.name}.png`));
  await shot(page, `${BASE}/m/preview?sheet=companion`, path.join(MOBILE, `companion-${vp.name}.png`));
  await ctx.close();
}

await browser.close();

const uaDesktop = await headers(`${BASE}/login`, DESKTOP);
const uaMobile = await headers(`${BASE}/login`, IPHONE);
const cookieForce = await headers(`${BASE}/login`, IPHONE, 'ui=desktop');
const bodyDesktop = await bodyHas(`${BASE}/login`, DESKTOP, null, '(mobile)/m/login');
const bodyMobile = await bodyHas(`${BASE}/login`, IPHONE, null, '(mobile)/m/login');
const bodyForced = await bodyHas(`${BASE}/login`, IPHONE, 'ui=desktop', '(mobile)/m/login');
const bodyDesktopPage = await bodyHas(`${BASE}/login`, DESKTOP, null, 'app/login/page');
const bodyForcedDesktop = await bodyHas(`${BASE}/login`, IPHONE, 'ui=desktop', 'app/login/page');

const report = {
  base: BASE,
  createdAt: new Date().toISOString(),
  desktopDiffs: diffs,
  rewrite: {
    desktopUa: uaDesktop,
    mobileUa: uaMobile,
    cookieDesktopOnIphone: cookieForce,
    bodyHasMobileTree: {
      desktopUa: bodyDesktop,
      mobileUa: bodyMobile,
      cookieDesktopOnIphone: bodyForced,
    },
    bodyHasDesktopTree: {
      desktopUa: bodyDesktopPage,
      cookieDesktopOnIphone: bodyForcedDesktop,
    },
  },
};

fs.writeFileSync(path.join(ROOT, 'proofs.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
