// TEMP (verification only): drives the portal with Playwright and measures the
// Man Schedule horizontal scroll model before/after the fix. Deleted after use.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const MODE = process.argv[2] || 'before';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const shotsDir = path.resolve(process.cwd(), 'scripts/_tmp_shots');
fs.mkdirSync(shotsDir, { recursive: true });

const { session, profile, email, customToken } = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_session.json'), 'utf8')
);

const report = { mode: MODE, email, pages: {}, consoleErrors: [] };

async function measure(page, label) {
  // wait for grid
  await page.waitForSelector('[data-testid="man-schedule-scroll"] table#man-schedule-table', { timeout: 60000 });
  await page.waitForTimeout(2500); // data + ResizeObserver settle
  const m = await page.evaluate(() => {
    const scrollport = document.querySelector('[data-testid="man-schedule-scroll"]');
    const table = scrollport?.querySelector('table#man-schedule-table');
    const topBar = scrollport?.previousElementSibling;
    const main = document.querySelector('main');
    const wrapper = main?.parentElement;
    const stickyName = scrollport?.querySelector('.man-schedule-sticky-name');
    const r = (el) => el ? Math.round(el.getBoundingClientRect().width) : null;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
      wrapperWidth: r(wrapper),
      mainWidth: r(main),
      scrollport: scrollport ? {
        clientWidth: scrollport.clientWidth,
        scrollWidth: scrollport.scrollWidth,
        rectWidth: r(scrollport),
        overflowX: getComputedStyle(scrollport).overflowX,
        hasHScroll: scrollport.scrollWidth > scrollport.clientWidth,
      } : null,
      tableWidth: r(table),
      topBar: topBar ? {
        clientWidth: topBar.clientWidth,
        scrollWidth: topBar.scrollWidth,
        hasHScroll: topBar.scrollWidth > topBar.clientWidth,
        height: Math.round(topBar.getBoundingClientRect().height),
      } : null,
      stickyName: stickyName ? {
        position: getComputedStyle(stickyName).position,
        left: getComputedStyle(stickyName).left,
      } : null,
    };
  });
  report.pages[label] = m;
  await page.screenshot({ path: path.join(shotsDir, `${MODE}-${label}.png`), fullPage: false });
  return m;
}

async function interactions(page, label) {
  // 1) drag bottom native scrollbar equivalent: set scrollLeft on scrollport, expect top bar to follow
  const res = await page.evaluate(async () => {
    const scrollport = document.querySelector('[data-testid="man-schedule-scroll"]');
    const topBar = scrollport?.previousElementSibling;
    const stickyName = scrollport?.querySelector('.man-schedule-sticky-name');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    if (!scrollport || !topBar) return { error: 'missing elements' };

    // table scroll -> top bar sync
    scrollport.scrollLeft = 400;
    await sleep(300);
    out.afterTableScroll = { table: scrollport.scrollLeft, top: Math.round(topBar.scrollLeft) };
    // sticky name must stay pinned at scrollport's left edge
    const spRect = scrollport.getBoundingClientRect();
    const nmRect = stickyName.getBoundingClientRect();
    out.stickyDeltaAt400 = Math.round(nmRect.left - spRect.left);

    // top bar scroll -> table sync
    topBar.scrollLeft = 800;
    await sleep(300);
    out.afterTopScroll = { table: Math.round(scrollport.scrollLeft), top: topBar.scrollLeft };
    const nmRect2 = stickyName.getBoundingClientRect();
    out.stickyDeltaAt800 = Math.round(nmRect2.left - spRect.left);
    scrollport.scrollLeft = 0;
    topBar.scrollLeft = 0;
    return out;
  });
  report.pages[label].interactions = res;
}

// Cached browser revision (1181) differs from playwright 1.55.1's default (1193) — use it directly.
const CHROME_EXE = process.env.CHROME_EXE ||
  'C:\\Users\\caio.correia\\AppData\\Local\\ms-playwright\\chromium-1181\\chrome-win\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME_EXE });
try {
  // ── Desktop ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([s, p, t]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('abzToken', t);
    localStorage.setItem('supabase_auth_token', JSON.stringify(s));
    localStorage.setItem('auth', 'true');
    localStorage.setItem('user', JSON.stringify(p));
    localStorage.setItem('languageDialogShown', 'true');
    localStorage.setItem('gt-man-schedule-viewport-day', '1'); // day view = many columns
  }, [session, profile, customToken]);
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') report.consoleErrors.push(msg.text().slice(0, 300)); });
  page.on('pageerror', (err) => report.consoleErrors.push(String(err).slice(0, 300)));

  // Standalone page
  await page.goto(`${BASE}/department/man-schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const m1 = await measure(page, 'standalone-desktop');
  if (MODE === 'after' && m1.scrollport?.hasHScroll) await interactions(page, 'standalone-desktop');

  // GT tab
  await page.goto(`${BASE}/department/gestao-tripulantes`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Man Schedule/i }).first().click();
  const m2 = await measure(page, 'gt-tab-desktop');
  if (MODE === 'after' && m2.scrollport?.hasHScroll) await interactions(page, 'gt-tab-desktop');
  await ctx.close();

  // ── Mobile ──
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctxM.addInitScript(([s, p, t]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('abzToken', t);
    localStorage.setItem('supabase_auth_token', JSON.stringify(s));
    localStorage.setItem('auth', 'true');
    localStorage.setItem('user', JSON.stringify(p));
    localStorage.setItem('languageDialogShown', 'true');
    localStorage.setItem('gt-man-schedule-viewport-day', '1');
  }, [session, profile, customToken]);
  const pageM = await ctxM.newPage();
  pageM.on('console', (msg) => { if (msg.type() === 'error') report.consoleErrors.push('M:' + msg.text().slice(0, 300)); });
  await pageM.goto(`${BASE}/department/man-schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await measure(pageM, 'standalone-mobile');
  await ctxM.close();
} finally {
  await browser.close();
}

report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 10);
fs.writeFileSync(path.resolve(process.cwd(), `scripts/_tmp_scroll_report_${MODE}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
