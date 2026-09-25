/**
 * Mobile-first Phase 1: capture public (and gated) routes at 375x812 and 390x844.
 * Writes PNGs + metrics JSON under docs/mobile-audit/. No secrets.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.MOBILE_AUDIT_BASE || 'http://127.0.0.1:3000';
const OUT = path.resolve('docs/mobile-audit');
const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
];

/** Public / token-less first, then a representative gated set. */
const ROUTES = [
  { slug: 'root', path: '/', public: true },
  { slug: 'login', path: '/login', public: true },
  { slug: 'register', path: '/register', public: true },
  { slug: 'reset-password', path: '/reset-password', public: true },
  { slug: 'set-password', path: '/set-password', public: true },
  { slug: 'verify-email', path: '/verify-email', public: true },
  { slug: 'unauthorized', path: '/unauthorized', public: true },
  { slug: 'lista-presenca-public', path: '/lista-presenca/public/audit-placeholder', public: true },
  { slug: 'academy-validate', path: '/academy/certificates/validate/audit-placeholder', public: true },
  { slug: 'assinatura-token', path: '/assinatura/audit-placeholder', public: true },
  { slug: 'dashboard', path: '/dashboard', public: false },
  { slug: 'chat', path: '/chat', public: false },
  { slug: 'admin', path: '/admin', public: false },
];

fs.mkdirSync(OUT, { recursive: true });

function slugify(route, viewport) {
  return `${route.slug}-${viewport.name}`;
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
    const clientW = doc.clientWidth;
    const overflowX = scrollW > clientW + 2;
    const smallTargets = Array.from(
      document.querySelectorAll('button, a, [role="button"], input, select, textarea')
    )
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (r.bottom < 0 || r.top > window.innerHeight) return false;
        return r.width < 44 || r.height < 44;
      })
      .slice(0, 12)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      });
    return {
      title: document.title,
      href: location.href,
      pathname: location.pathname,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: scrollW,
      clientWidth: clientW,
      overflowX,
      overflowPx: Math.max(0, scrollW - clientW),
      smallTargetCount: smallTargets.length,
      smallTargets,
    };
  });
}

async function waitForReady(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await new Promise((r) => setTimeout(r, 1800));
}

const results = [];

const browser = await chromium.launch({ headless: true });

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const route of ROUTES) {
    const name = slugify(route, viewport);
    const file = path.join(OUT, `${name}.png`);
    const entry = {
      slug: route.slug,
      path: route.path,
      public: route.public,
      viewport: viewport.name,
      file: `docs/mobile-audit/${name}.png`,
    };
    try {
      const response = await page.goto(`${BASE}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await waitForReady(page);
      const metrics = await measure(page);
      await page.screenshot({ path: file, fullPage: false, type: 'png' });
      entry.status = response?.status() ?? null;
      entry.finalPath = metrics.pathname;
      entry.title = metrics.title;
      entry.overflowX = metrics.overflowX;
      entry.overflowPx = metrics.overflowPx;
      entry.smallTargetCount = metrics.smallTargetCount;
      entry.smallTargets = metrics.smallTargets;
      entry.ok = true;
      const bytes = fs.statSync(file).size;
      entry.bytes = bytes;
      console.log(
        `${name} status=${entry.status} final=${entry.finalPath} overflow=${entry.overflowPx}px small=${entry.smallTargetCount} ${bytes}B`
      );
    } catch (err) {
      entry.ok = false;
      entry.error = String(err?.message || err).slice(0, 300);
      console.error(`${name} FAIL ${entry.error}`);
    }
    results.push(entry);
  }

  await context.close();
}

await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  viewports: VIEWPORTS.map((v) => v.name),
  totals: {
    shots: results.length,
    ok: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    overflow: results.filter((r) => r.overflowX).length,
  },
  results,
};

fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.totals, null, 2));
