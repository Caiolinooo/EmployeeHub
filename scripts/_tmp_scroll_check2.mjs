// TEMP (verification only) v2: ancestor-chain instrumentation + data-aware waits.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const MODE = process.argv[2] || 'after2';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const shotsDir = path.resolve(process.cwd(), 'scripts/_tmp_shots');
fs.mkdirSync(shotsDir, { recursive: true });

const { session, profile, email, customToken } = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_session.json'), 'utf8')
);

const report = { mode: MODE, email, pages: {}, consoleErrors: [] };

async function waitForGrid(page) {
  // wait for the grid wrapper, then for real data columns; reload once if the
  // realtime fetch failed (dev-server cold compile can reset the first fetch).
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.waitForSelector('[data-testid="man-schedule-scroll"] table#man-schedule-table', { timeout: 60000 });
    const ok = await page
      .waitForSelector('[data-man-schedule-col]', { timeout: 45000 })
      .then(() => true)
      .catch(() => false);
    const rows = await page.evaluate(() =>
      document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length
    );
    if (ok && rows > 0) break;
    if (attempt === 0) await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(2500);
}

async function measure(page, label) {
  await waitForGrid(page);
  const m = await page.evaluate(() => {
    const scrollport = document.querySelector('[data-testid="man-schedule-scroll"]');
    const table = scrollport?.querySelector('table#man-schedule-table');
    const topBar = scrollport?.previousElementSibling;
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
    const chain = [];
    let el = scrollport;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      chain.push({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute('data-testid') || undefined,
        cls: (el.className || '').toString().slice(0, 90),
        rectW: r(el),
        clientW: el.clientWidth,
        scrollW: el.scrollWidth,
        overflowX: cs.overflowX,
        minW: cs.minWidth,
        display: cs.display,
      });
      el = el.parentElement;
    }
    const stickyName = scrollport?.querySelector('.man-schedule-sticky-name');
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
      scrollport: scrollport
        ? {
            clientWidth: scrollport.clientWidth,
            scrollWidth: scrollport.scrollWidth,
            hasHScroll: scrollport.scrollWidth > scrollport.clientWidth,
          }
        : null,
      tableWidth: r(table),
      dataRows: document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length,
      dataCols: document.querySelectorAll('[data-man-schedule-col]').length,
      topBar: topBar
        ? {
            clientWidth: topBar.clientWidth,
            scrollWidth: topBar.scrollWidth,
            hasHScroll: topBar.scrollWidth > topBar.clientWidth,
            height: Math.round(topBar.getBoundingClientRect().height),
          }
        : null,
      stickyName: stickyName
        ? { position: getComputedStyle(stickyName).position, left: getComputedStyle(stickyName).left }
        : null,
      chain,
    };
  });
  report.pages[label] = m;
  await page.screenshot({ path: path.join(shotsDir, `${MODE}-${label}.png`), fullPage: false });
  return m;
}

async function interactions(page, label) {
  const res = await page.evaluate(async () => {
    const scrollport = document.querySelector('[data-testid="man-schedule-scroll"]');
    const topBar = scrollport?.previousElementSibling;
    const stickyName = scrollport?.querySelector('.man-schedule-sticky-name');
    const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
    const out = {};
    if (!scrollport || !topBar) return { error: 'missing elements' };
    scrollport.scrollLeft = 400;
    await sleep(300);
    out.afterTableScroll = { table: scrollport.scrollLeft, top: Math.round(topBar.scrollLeft) };
    out.stickyDeltaAt400 = Math.round(
      stickyName.getBoundingClientRect().left - scrollport.getBoundingClientRect().left
    );
    topBar.scrollLeft = 800;
    await sleep(300);
    out.afterTopScroll = { table: Math.round(scrollport.scrollLeft), top: topBar.scrollLeft };
    out.stickyDeltaAt800 = Math.round(
      stickyName.getBoundingClientRect().left - scrollport.getBoundingClientRect().left
    );
    // Hoje / ‹ › nav must scroll the same scrollport
    scrollport.scrollLeft = 0;
    topBar.scrollLeft = 0;
    await sleep(200);
    return out;
  });
  report.pages[label].interactions = res;
}

const CHROME_EXE =
  process.env.CHROME_EXE ||
  'C:\\Users\\caio.correia\\AppData\\Local\\ms-playwright\\chromium-1181\\chrome-win\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME_EXE });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(
    ([s, p, t]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('abzToken', t);
      localStorage.setItem('supabase_auth_token', JSON.stringify(s));
      localStorage.setItem('auth', 'true');
      localStorage.setItem('user', JSON.stringify(p));
      localStorage.setItem('languageDialogShown', 'true');
      localStorage.setItem('gt-man-schedule-viewport-day', '1');
    },
    [session, profile, customToken]
  );
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', (err) => report.consoleErrors.push(String(err).slice(0, 200)));

  await page.goto(`${BASE}/department/man-schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const m1 = await measure(page, 'standalone-desktop');
  if (m1.scrollport?.hasHScroll) await interactions(page, 'standalone-desktop');

  await page.goto(`${BASE}/department/gestao-tripulantes`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Man Schedule/i }).first().click();
  const m2 = await measure(page, 'gt-tab-desktop');
  if (m2.scrollport?.hasHScroll) await interactions(page, 'gt-tab-desktop');
  await ctx.close();

  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctxM.addInitScript(
    ([s, p, t]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('abzToken', t);
      localStorage.setItem('supabase_auth_token', JSON.stringify(s));
      localStorage.setItem('auth', 'true');
      localStorage.setItem('user', JSON.stringify(p));
      localStorage.setItem('languageDialogShown', 'true');
      localStorage.setItem('gt-man-schedule-viewport-day', '1');
    },
    [session, profile, customToken]
  );
  const pageM = await ctxM.newPage();
  pageM.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push('M:' + msg.text().slice(0, 200));
  });
  await pageM.goto(`${BASE}/department/man-schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const mM = await measure(pageM, 'standalone-mobile');
  if (mM.scrollport?.hasHScroll) await interactions(pageM, 'standalone-mobile');
  await ctxM.close();
} finally {
  await browser.close();
}

report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 10);
fs.writeFileSync(
  path.resolve(process.cwd(), `scripts/_tmp_scroll_report_${MODE}.json`),
  JSON.stringify(report, null, 2)
);
// compact stdout: per page, the essentials + chain summary
for (const [label, m] of Object.entries(report.pages)) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify({ ...m, chain: undefined, interactions: m.interactions }, null, 1));
  console.log('chain:');
  for (const c of m.chain || []) {
    console.log(
      `  <${c.tag}${c.testid ? ` data-testid=${c.testid}` : ''}> rectW=${c.rectW} clientW=${c.clientW} scrollW=${c.scrollW} ox=${c.overflowX} minW=${c.minW} ${c.display} | ${c.cls}`
    );
  }
}
console.log('\nconsoleErrors:', report.consoleErrors.length);
report.consoleErrors.forEach((e) => console.log('  -', e));
