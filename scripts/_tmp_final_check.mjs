// TEMP: definitive check — HEADED chromium (real Windows scrollbars), dismiss splash overlay,
// nav buttons via EN labels.
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

const browser = await chromium.launch({
  executablePath: CHROME_EXE,
  headless: false, // real Windows theme -> classic scrollbars like end users see
});

async function dismissOverlays(page) {
  for (let i = 0; i < 4; i++) {
    const open = await page.evaluate(() => !!document.querySelector('.fixed.inset-0.z-50'));
    if (!open) return;
    await page.keyboard.press('Escape').catch(() => null);
    await page.waitForTimeout(700);
    const closed = await page.evaluate(() => {
      const overlay = document.querySelector('.fixed.inset-0.z-50');
      if (!overlay) return true;
      const btn = overlay.querySelector('button[aria-label*="echar" i], button[aria-label*="close" i], button[aria-label*="Fechar" i], button[aria-label*="Skip" i], button[aria-label*="Pular" i]');
      if (btn) { btn.click(); return !document.querySelector('.fixed.inset-0.z-50'); }
      // last resort: click a primary CTA inside the splash (e.g. "Continuar"/"OK")
      const cta = Array.from(overlay.querySelectorAll('button')).find((b) => /continuar|continue|ok|entendi|fechar|skip|começar|got it|vamos/i.test(b.textContent || ''));
      if (cta) { cta.click(); return !document.querySelector('.fixed.inset-0.z-50'); }
      return false;
    });
    if (closed) return;
    await page.waitForTimeout(700);
  }
}

async function bootPage(width, height, goto, waitCols = true) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(([s, p, t]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('abzToken', t);
    localStorage.setItem('supabase_auth_token', JSON.stringify(s));
    localStorage.setItem('auth', 'true');
    localStorage.setItem('user', JSON.stringify(p));
    localStorage.setItem('languageDialogShown', 'true');
  }, [session, profile, customToken]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${goto}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (waitCols) {
    // dev-server cold compiles can reset the first realtime fetch — reload until data lands
    for (let i = 0; i < 3; i++) {
      await page.waitForSelector('[data-man-schedule-col]', { timeout: 90000 }).catch(() => null);
      await page
        .waitForFunction(
          () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length > 3,
          { timeout: 60000 }
        )
        .catch(() => null);
      const rows = await page.evaluate(
        () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length
      );
      if (rows > 3) break;
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
  return { ctx, page };
}

// ── A. Standalone, headed desktop 1100px ──
{
  const { ctx, page } = await bootPage(1100, 900, '/department/man-schedule');
  const m = await page.evaluate(() => {
    const sp = document.querySelector('[data-testid="man-schedule-scroll"]');
    return {
      clientW: sp.clientWidth,
      scrollW: sp.scrollWidth,
      hasHScroll: sp.scrollWidth > sp.clientWidth,
      hThickness: sp.offsetHeight - sp.clientHeight,
      vThickness: sp.offsetWidth - sp.clientWidth,
    };
  });
  console.log('headed measure:', JSON.stringify(m));
  check('headed: grid overflows', m.hasHScroll, `scrollW=${m.scrollW} > clientW=${m.clientW}`);
  check('headed: bottom scrollbar occupies >=14px', m.hThickness >= 14, `h=${m.hThickness}px v=${m.vThickness}px`);

  await page.evaluate(() => { document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft = 300; });
  await page.waitForTimeout(400);
  const box = await page.locator('[data-testid="man-schedule-scroll"]').boundingBox();
  await page.screenshot({
    path: path.join(shotsDir, 'final-bottom-scrollbar.png'),
    clip: { x: box.x, y: box.y + box.height - 80, width: box.width, height: 80 },
  });
  await page.screenshot({ path: path.join(shotsDir, 'final-standalone-headed.png') });

  const read = () => page.evaluate(() => Math.round(document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft));
  await page.evaluate(() => { document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft = 0; });
  await page.waitForTimeout(300);
  const b0 = await read();
  const nextBtn = page.getByRole('button', { name: 'Next week' });
  check('nav: "Next week" enabled', (await nextBtn.count()) === 1 && !(await nextBtn.isDisabled()), `count=${await nextBtn.count()}`);
  await nextBtn.click({ timeout: 10000 });
  await page.waitForTimeout(900);
  const b1 = await read();
  check('nav: › scrolls one column', b1 > b0, `scrollLeft ${b0} -> ${b1}`);
  await page.getByRole('button', { name: 'Previous week' }).click({ timeout: 10000 });
  await page.waitForTimeout(900);
  const b2 = await read();
  check('nav: ‹ scrolls back', b2 < b1, `scrollLeft ${b1} -> ${b2}`);
  await page.getByRole('button', { name: 'Today' }).click({ timeout: 10000 });
  await page.waitForTimeout(1200);
  const b3 = await read();
  const todayCol = await page.evaluate(() => {
    const el = document.querySelector('[data-man-schedule-today="1"]');
    const sp = document.querySelector('[data-testid="man-schedule-scroll"]');
    if (!el || !sp) return null;
    const r = el.getBoundingClientRect();
    const s = sp.getBoundingClientRect();
    return { inView: r.left >= s.left && r.right <= s.right + 1, relLeft: Math.round(r.left - s.left) };
  });
  check('nav: Today scrolls to today column', b3 > 0 && !!todayCol?.inView, `scrollLeft=${b3} today=${JSON.stringify(todayCol)}`);
  await page.screenshot({ path: path.join(shotsDir, 'final-today-column.png') });
  await ctx.close();
}

// ── B. GT tab, headed desktop 1440px ──
{
  const { ctx, page } = await bootPage(1440, 900, '/department/gestao-tripulantes', false);
  // dev-server cold compiles can reset the first fetch — reload + re-click until data lands
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForTimeout(2500);
    await dismissOverlays(page);
    await page.getByRole('button', { name: /Man Schedule/i }).first().waitFor({ state: 'visible', timeout: 90000 });
    await page.getByRole('button', { name: /Man Schedule/i }).first().click({ timeout: 30000 });
    await page.waitForSelector('[data-man-schedule-col]', { timeout: 60000 }).catch(() => null);
    await page
      .waitForFunction(
        () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length > 3,
        { timeout: 60000 }
      )
      .catch(() => null);
    const rows = await page.evaluate(
      () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length
    );
    if (rows > 3) break;
    if (attempt < 2) await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
  const m = await page.evaluate(() => {
    const sp = document.querySelector('[data-testid="man-schedule-scroll"]');
    const topBar = sp.previousElementSibling;
    return {
      clientW: sp.clientWidth,
      scrollW: sp.scrollWidth,
      hasHScroll: sp.scrollWidth > sp.clientWidth,
      hThickness: sp.offsetHeight - sp.clientHeight,
      topH: topBar ? topBar.scrollWidth > topBar.clientWidth : null,
    };
  });
  console.log('headed gt-tab measure:', JSON.stringify(m));
  check('gt-tab headed: grid overflows', m.hasHScroll, `scrollW=${m.scrollW} > clientW=${m.clientW}`);
  check('gt-tab headed: bottom scrollbar occupies >=14px', m.hThickness >= 14, `h=${m.hThickness}px`);
  check('gt-tab headed: top bar overflows', m.topH === true, `top=${m.topH}`);
  // drag the TOP scrollbar with the mouse (real user gesture)
  const topBox = await page.locator('[data-testid="man-schedule-scroll"] >> xpath=..').evaluate((el) => {
    const topBar = el.querySelector('.man-schedule-scroll:not([data-testid])');
    const r = topBar.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const read = () => page.evaluate(() => Math.round(document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft));
  const t0 = await read();
  // drag the top bar thumb: click-drag on the thumb area (left part) to the right
  await page.mouse.move(topBox.x + 60, topBox.y + topBox.h / 2);
  await page.mouse.down();
  await page.mouse.move(topBox.x + 300, topBox.y + topBox.h / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const t1 = await read();
  check('gt-tab headed: dragging TOP scrollbar thumb scrolls grid', t1 > t0, `scrollLeft ${t0} -> ${t1}`);
  await page.screenshot({ path: path.join(shotsDir, 'final-gt-tab-headed.png') });
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_report_final.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`);
if (failed.length) { console.log('FAILED:', failed.map((r2) => r2.name).join(' | ')); process.exit(2); }
