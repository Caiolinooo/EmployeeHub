// TEMP (verification only) v3 — final acceptance run for the Man Schedule scroll fix.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const MODE = 'after3';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const shotsDir = path.resolve(process.cwd(), 'scripts/_tmp_shots');
fs.mkdirSync(shotsDir, { recursive: true });

const { session, profile, email, customToken } = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_session.json'), 'utf8')
);

const report = { mode: MODE, email, checks: {}, consoleErrors: [] };
const check = (name, cond, detail) => {
  report.checks[name] = { pass: !!cond, detail };
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}: ${detail}`);
};

function initScript() {
  return {
    fn: ([s, p, t]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('abzToken', t);
      localStorage.setItem('supabase_auth_token', JSON.stringify(s));
      localStorage.setItem('auth', 'true');
      localStorage.setItem('user', JSON.stringify(p));
      localStorage.setItem('languageDialogShown', 'true');
      localStorage.setItem('gt-man-schedule-viewport-day', '1');
    },
    args: [session, profile, customToken],
  };
}

async function waitForGridWithData(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const respPromise = page
      .waitForResponse((r) => r.url().includes('/api/man-schedule/realtime') && r.status() === 200, { timeout: 90000 })
      .catch(() => null);
    await page.waitForSelector('[data-testid="man-schedule-scroll"] table#man-schedule-table', { timeout: 60000 });
    await respPromise;
    await page
      .waitForFunction(
        () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length > 3,
        { timeout: 30000 }
      )
      .catch(() => null);
    const rows = await page.evaluate(
      () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length
    );
    if (rows > 3) return rows;
    if (attempt < 2) await page.reload({ waitUntil: 'domcontentloaded' });
  }
  return 0;
}

async function measure(page) {
  return page.evaluate(() => {
    const sp = document.querySelector('[data-testid="man-schedule-scroll"]');
    const topBar = sp?.previousElementSibling;
    const stickyName = sp?.querySelector('.man-schedule-sticky-name');
    const thead = sp?.querySelector('thead');
    return {
      clientW: sp.clientWidth,
      scrollW: sp.scrollWidth,
      hasHScroll: sp.scrollWidth > sp.clientWidth,
      hScrollbarThickness: sp.offsetHeight - sp.clientHeight,
      topBar: topBar
        ? { clientW: topBar.clientWidth, scrollW: topBar.scrollWidth, hasHScroll: topBar.scrollWidth > topBar.clientWidth, h: Math.round(topBar.getBoundingClientRect().height) }
        : null,
      stickyName: stickyName
        ? { pos: getComputedStyle(stickyName).position, left: getComputedStyle(stickyName).left }
        : null,
      theadPos: thead ? getComputedStyle(thead).position : null,
      rows: document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length,
      cols: document.querySelectorAll('[data-man-schedule-col]').length,
      docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

async function interactionSuite(page, label) {
  // sync both ways + sticky name pinned + nav button scrolls the scrollport
  const r = await page.evaluate(async () => {
    const sp = document.querySelector('[data-testid="man-schedule-scroll"]');
    const topBar = sp.previousElementSibling;
    const stickyName = sp.querySelector('.man-schedule-sticky-name');
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const out = {};
    sp.scrollLeft = 300;
    await sleep(250);
    out.bottomToTop = { table: sp.scrollLeft, top: Math.round(topBar.scrollLeft) };
    out.stickyDelta = Math.round(stickyName.getBoundingClientRect().left - sp.getBoundingClientRect().left);
    topBar.scrollLeft = 0;
    await sleep(250);
    out.topToBottom = { table: Math.round(sp.scrollLeft), top: topBar.scrollLeft };
    return out;
  });
  check(`${label}: bottom bar scrolls grid + syncs top`, r.bottomToTop.table === 300 && r.bottomToTop.top === 300, JSON.stringify(r.bottomToTop));
  check(`${label}: top bar scrolls grid`, r.topToBottom.table === 0 && r.topToBottom.top === 0, JSON.stringify(r.topToBottom));
  check(`${label}: sticky NOME stays pinned`, r.stickyDelta === 0, `delta=${r.stickyDelta}px`);

  // nav button › scrolls one column inside the same scrollport
  const before = await page.evaluate(() => document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft);
  await page.getByRole('button', { name: /pr.xima|next/i }).first().click().catch(() => null);
  await page.waitForTimeout(600);
  const afterNav = await page.evaluate(() => document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft);
  check(`${label}: ‹ › column nav scrolls the scrollport`, afterNav > before, `scrollLeft ${before} → ${afterNav}`);
}

const CHROME_EXE =
  process.env.CHROME_EXE ||
  'C:\\Users\\caio.correia\\AppData\\Local\\ms-playwright\\chromium-1181\\chrome-win\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME_EXE });
try {
  // ── A. Standalone page, desktop 1440 ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const init = initScript();
  await ctx.addInitScript(init.fn, init.args);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && report.consoleErrors.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => report.consoleErrors.push(String(e).slice(0, 160)));

  await page.goto(`${BASE}/department/man-schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const rows = await waitForGridWithData(page);
  check('standalone: realtime data loaded', rows > 3, `rows=${rows}`);
  await page.waitForTimeout(1500);

  let m = await measure(page);
  report.standaloneWide = m;
  console.log('standalone@1440:', JSON.stringify(m));
  check('standalone@1440: chain bounded to viewport', m.clientW <= 1184 && !m.docOverflowX, `clientW=${m.clientW} docOverflowX=${m.docOverflowX}`);

  // narrow the window so the month exceeds the pane -> scroll must appear
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.waitForTimeout(1200);
  m = await measure(page);
  report.standaloneNarrow = m;
  console.log('standalone@1000:', JSON.stringify(m));
  check('standalone@1000: grid overflows horizontally', m.hasHScroll, `scrollW=${m.scrollW} > clientW=${m.clientW}`);
  check('standalone@1000: bottom native scrollbar visible (>=14px)', m.hScrollbarThickness >= 14, `thickness=${m.hScrollbarThickness}px`);
  check('standalone@1000: top synced bar overflows too', m.topBar?.hasHScroll, JSON.stringify(m.topBar));
  check('standalone@1000: thead sticky', m.theadPos === 'sticky', `thead position=${m.theadPos}`);
  await page.screenshot({ path: path.join(shotsDir, `${MODE}-standalone-narrow.png`) });
  await interactionSuite(page, 'standalone@1000');
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── B. GT tab, desktop 1440 ──
  await page.goto(`${BASE}/department/gestao-tripulantes`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Man Schedule/i }).first().click();
  await page.waitForSelector('[data-man-schedule-col]', { timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length > 3,
    { timeout: 60000 }
  );
  await page.waitForTimeout(2000);
  m = await measure(page);
  report.gtTab = m;
  console.log('gt-tab@1440:', JSON.stringify(m));
  check('gt-tab: grid overflows horizontally', m.hasHScroll, `scrollW=${m.scrollW} > clientW=${m.clientW}`);
  check('gt-tab: bottom native scrollbar visible (>=14px)', m.hScrollbarThickness >= 14, `thickness=${m.hScrollbarThickness}px`);
  check('gt-tab: top synced bar overflows too', m.topBar?.hasHScroll, JSON.stringify(m.topBar));
  await page.screenshot({ path: path.join(shotsDir, `${MODE}-gt-tab.png`) });
  // scrolled state screenshot for sticky evidence
  await page.evaluate(() => { document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft = 500; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotsDir, `${MODE}-gt-tab-scrolled.png`) });
  await interactionSuite(page, 'gt-tab');
  await ctx.close();

  // ── C. Standalone page, mobile 390 ──
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctxM.addInitScript(init.fn, init.args);
  const pageM = await ctxM.newPage();
  pageM.on('console', (msg) => msg.type() === 'error' && report.consoleErrors.push('M:' + msg.text().slice(0, 160)));
  await pageM.goto(`${BASE}/department/man-schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitForGridWithData(pageM);
  await pageM.waitForTimeout(1500);
  const mm = await measure(pageM);
  report.standaloneMobile = mm;
  console.log('standalone@390:', JSON.stringify(mm));
  check('mobile: grid overflows horizontally', mm.hasHScroll, `scrollW=${mm.scrollW} > clientW=${mm.clientW}`);
  check('mobile: no page-level horizontal overflow', !mm.docOverflowX, `docOverflowX=${mm.docOverflowX}`);
  await pageM.screenshot({ path: path.join(shotsDir, `${MODE}-mobile.png`) });
  await interactionSuite(pageM, 'mobile');
  await ctxM.close();
} finally {
  await browser.close();
}

report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 10);
fs.writeFileSync(path.resolve(process.cwd(), `scripts/_tmp_scroll_report_${MODE}.json`), JSON.stringify(report, null, 2));
const failed = Object.entries(report.checks).filter(([, v]) => !v.pass);
console.log(`\n==== ${Object.keys(report.checks).length - failed.length}/${Object.keys(report.checks).length} checks passed ====`);
if (failed.length) { console.log('FAILED:', failed.map(([k]) => k).join(' | ')); process.exit(2); }
