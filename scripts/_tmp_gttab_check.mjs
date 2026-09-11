// TEMP: GT tab only, headed — scrollbar thickness + real mouse drag on the top synced bar.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const shotsDir = path.resolve(process.cwd(), 'scripts/_tmp_shots');
const { session, profile, customToken } = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_session.json'), 'utf8')
);
const CHROME_EXE = 'C:\\Users\\caio.correia\\AppData\\Local\\ms-playwright\\chromium-1181\\chrome-win\\chrome.exe';

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}: ${detail}`);
};

const browser = await chromium.launch({ executablePath: CHROME_EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(([s, p, t]) => {
  localStorage.setItem('token', t);
  localStorage.setItem('abzToken', t);
  localStorage.setItem('supabase_auth_token', JSON.stringify(s));
  localStorage.setItem('auth', 'true');
  localStorage.setItem('user', JSON.stringify(p));
  localStorage.setItem('languageDialogShown', 'true');
  localStorage.setItem('gt-man-schedule-viewport-day', '1');
}, [session, profile, customToken]);
const page = await ctx.newPage();

let ok = false;
for (let attempt = 0; attempt < 3 && !ok; attempt++) {
  await page.goto(`${BASE}/department/gestao-tripulantes`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);
  // dismiss what's-new overlay
  for (let i = 0; i < 3; i++) {
    const has = await page.evaluate(() => !!document.querySelector('.fixed.inset-0.z-50'));
    if (!has) break;
    await page.keyboard.press('Escape').catch(() => null);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const overlay = document.querySelector('.fixed.inset-0.z-50');
      const cta = overlay && Array.from(overlay.querySelectorAll('button')).find((b) => /got it|vamos|continuar|fechar|ok/i.test(b.textContent || ''));
      if (cta) cta.click();
    });
    await page.waitForTimeout(800);
  }
  // tabs render late (permission fetches) — wait for real DOM presence, then DOM-click
  await page
    .waitForFunction(
      () => !!Array.from(document.querySelectorAll('button')).find((b) => /Man Schedule \(Escala MIO\)/i.test(b.textContent || '')),
      { timeout: 120000 }
    )
    .catch(() => null);
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /Man Schedule \(Escala MIO\)/i.test(b.textContent || ''));
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!clicked) continue;
  await page
    .waitForFunction(
      () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length > 3,
      { timeout: 90000 }
    )
    .catch(() => null);
  ok = (await page.evaluate(() => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length)) > 3;
}
check('gt-tab: data loaded', ok, '');
await page.waitForTimeout(2500);

const m = await page.evaluate(() => {
  const sp = document.querySelector('[data-testid="man-schedule-scroll"]');
  const topBar = sp.previousElementSibling;
  return {
    clientW: sp.clientWidth,
    scrollW: sp.scrollWidth,
    hasHScroll: sp.scrollWidth > sp.clientWidth,
    hThickness: sp.offsetHeight - sp.clientHeight,
    topH: topBar ? topBar.scrollWidth > topBar.clientWidth : null,
    topBox: (() => { const r = topBar.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })(),
  };
});
console.log('gt-tab headed:', JSON.stringify(m));
check('gt-tab headed: grid overflows', m.hasHScroll, `scrollW=${m.scrollW} > clientW=${m.clientW}`);
check('gt-tab headed: bottom scrollbar occupies >=14px', m.hThickness >= 14, `h=${m.hThickness}px`);
check('gt-tab headed: top bar overflows', m.topH === true, `top=${m.topH}`);

// real mouse drag on the TOP synced bar thumb
const read = () => page.evaluate(() => Math.round(document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft));
const t0 = await read();
await page.mouse.move(m.topBox.x + 40, m.topBox.y + m.topBox.h / 2);
await page.mouse.down();
await page.mouse.move(m.topBox.x + 240, m.topBox.y + m.topBox.h / 2, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(700);
const t1 = await read();
check('gt-tab headed: dragging TOP scrollbar scrolls grid', t1 > t0, `scrollLeft ${t0} -> ${t1}`);

// sticky name column pinned during scroll
const sticky = await page.evaluate(() => {
  const sp = document.querySelector('[data-testid="man-schedule-scroll"]');
  const nm = sp.querySelector('.man-schedule-sticky-name');
  return Math.round(nm.getBoundingClientRect().left - sp.getBoundingClientRect().left);
});
check('gt-tab headed: NOME pinned while scrolled', sticky === 0, `delta=${sticky}px`);

await page.screenshot({ path: path.join(shotsDir, 'final-gt-tab-headed.png') });
await browser.close();
fs.writeFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_report_gttab.json'), JSON.stringify({ results, m }, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`);
if (failed.length) process.exit(2);
