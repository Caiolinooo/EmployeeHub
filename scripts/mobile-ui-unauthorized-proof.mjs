/**
 * /unauthorized: prova ruído (mesmo servidor, duas capturas) vs mudança real.
 *
 * Uso:
 *   URL_A=http://127.0.0.1:3001 URL_B=http://127.0.0.1:3001 \
 *     LABEL=before-vs-before node scripts/mobile-ui-unauthorized-proof.mjs
 *   URL_A=http://127.0.0.1:3001 URL_B=http://127.0.0.1:3002 \
 *     LABEL=before-vs-after node scripts/mobile-ui-unauthorized-proof.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const URL_A = process.env.URL_A;
const URL_B = process.env.URL_B;
const LABEL = process.env.LABEL || 'unauth';
const OUT = process.env.OUT || `/tmp/mui-unauth-${LABEL}`;
const VIEWPORT = { width: 1440, height: 900 };

if (!URL_A || !URL_B) {
  console.error('URL_A e URL_B obrigatórios');
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });

async function capture(url, file) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const resp = await page.goto(new URL('/unauthorized', url).toString(), {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important}',
  });
  await page.waitForTimeout(500);
  const html = await page.content();
  const cssHrefs = await page.$$eval('link[rel="stylesheet"]', (els) => els.map((e) => e.href));
  await page.screenshot({ path: file, fullPage: false });
  const info = {
    status: resp?.status() ?? 0,
    title: await page.title(),
    href: page.url(),
    cssHrefs,
    htmlLen: html.length,
    text: await page.locator('body').innerText(),
  };
  await browser.close();
  return { html, info };
}

const aFile = join(OUT, 'a.png');
const bFile = join(OUT, 'b.png');
const a = await capture(URL_A, aFile);
const b = await capture(URL_B, bFile);

writeFileSync(join(OUT, 'a.html'), a.html);
writeFileSync(join(OUT, 'b.html'), b.html);

const sa = sharp(readFileSync(aFile)).ensureAlpha();
const sb = sharp(readFileSync(bFile)).ensureAlpha();
const [am, bm] = await Promise.all([sa.metadata(), sb.metadata()]);
const [ar, br] = await Promise.all([sa.raw().toBuffer(), sb.raw().toBuffer()]);
let px = 0;
if (am.width !== bm.width || am.height !== bm.height) {
  px = (am.width || 0) * (am.height || 0);
} else {
  for (let i = 0; i < ar.length; i += 4) {
    if (ar[i] !== br[i] || ar[i + 1] !== br[i + 1] || ar[i + 2] !== br[i + 2] || ar[i + 3] !== br[i + 3]) px += 1;
  }
}

const report = {
  label: LABEL,
  px,
  htmlEqual: a.html === b.html,
  htmlLenA: a.html.length,
  htmlLenB: b.html.length,
  infoA: a.info,
  infoB: b.info,
};
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
