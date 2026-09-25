/**
 * Before/after desktop 1440×900 em next start (produção).
 * Mesmo locale, cookies, localStorage. Sem animações. Espera fontes/imagens.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BEFORE_BASE = process.env.BEFORE_BASE || 'http://127.0.0.1:3001';
const AFTER_BASE = process.env.AFTER_BASE || 'http://127.0.0.1:3002';
const ROOT = path.resolve('docs/mobile-audit/fase2');
const BEFORE = path.join(ROOT, 'before');
const AFTER = path.join(ROOT, 'after');
const DIFF = path.join(ROOT, 'diff');
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ROUTES = [
  ['/login', 'login-1440x900.png'],
  ['/register', 'register-1440x900.png'],
  ['/reset-password', 'reset-password-1440x900.png'],
  ['/unauthorized', 'unauthorized-1440x900.png'],
  ['/dashboard', 'dashboard-1440x900.png'],
];

for (const dir of [BEFORE, AFTER, DIFF]) fs.mkdirSync(dir, { recursive: true });

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
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < aBuf.length; i += 4) {
    const px = i / 4;
    const x = px % info.width;
    const y = Math.floor(px / info.width);
    const dr = Math.abs(aBuf[i] - bBuf[i]);
    const dg = Math.abs(aBuf[i + 1] - bBuf[i + 1]);
    const db = Math.abs(aBuf[i + 2] - bBuf[i + 2]);
    const da = Math.abs(aBuf[i + 3] - bBuf[i + 3]);
    if (dr + dg + db + da > 0) {
      changed += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
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
  const bbox = changed ? { minX, minY, maxX, maxY } : null;
  if (bbox) {
    const w = bbox.maxX - bbox.minX + 1;
    const h = bbox.maxY - bbox.minY + 1;
    await sharp(bPath)
      .extract({
        left: bbox.minX,
        top: bbox.minY,
        width: w,
        height: h,
      })
      .png()
      .toFile(outPath.replace(/\.png$/, '-crop-after.png'));
    await sharp(aPath)
      .extract({
        left: bbox.minX,
        top: bbox.minY,
        width: w,
        height: h,
      })
      .png()
      .toFile(outPath.replace(/\.png$/, '-crop-before.png'));
  }
  return { ok: changed === 0, changed, total: info.width * info.height, bbox };
}

async function preparePage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('languageDialogShown', 'true');
    localStorage.setItem('locale', 'pt-BR');
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`,
  });
}

async function waitStable(page) {
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; }),
      ),
    );
  });
  await page.waitForTimeout(800);
}

async function shotSide(base, outDir) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: DESKTOP,
    locale: 'pt-BR',
    deviceScaleFactor: 1,
  });
  await ctx.addCookies([
    { name: 'NEXT_LOCALE', value: 'pt-BR', url: base },
    { name: 'locale', value: 'pt-BR', url: base },
  ]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  await preparePage(page);
  const finals = {};
  for (const [route, file] of ROUTES) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitStable(page);
    finals[file] = page.url();
    await page.screenshot({ path: path.join(outDir, file), fullPage: false, animations: 'disabled' });
  }
  await browser.close();
  return finals;
}

const beforeUrls = await shotSide(BEFORE_BASE, BEFORE);
const afterUrls = await shotSide(AFTER_BASE, AFTER);

const diffs = {};
for (const [, file] of ROUTES) {
  const a = path.join(BEFORE, file);
  const b = path.join(AFTER, file);
  if (!fs.existsSync(a) || !fs.existsSync(b)) {
    diffs[file] = { ok: false, reason: 'missing file' };
    continue;
  }
  diffs[file] = await pixelDiff(a, b, path.join(DIFF, file));
  const t = diffs[file].total || 1296000;
  diffs[file].percent = diffs[file].changed < 0 ? null : Number(((diffs[file].changed / t) * 100).toFixed(4));
}

const report = {
  createdAt: new Date().toISOString(),
  beforeBase: BEFORE_BASE,
  afterBase: AFTER_BASE,
  beforeUrls,
  afterUrls,
  diffs,
};
fs.writeFileSync(path.join(ROOT, 'proofs-prod.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
