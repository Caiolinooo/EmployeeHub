// TEMP: step-by-step GT tab click debug
import { chromium } from 'playwright';
import fs from 'node:fs';

const { session, profile, customToken } = JSON.parse(fs.readFileSync('scripts/_tmp_scroll_session.json', 'utf8'));
const CHROME_EXE = 'C:\\Users\\caio.correia\\AppData\\Local\\ms-playwright\\chromium-1181\\chrome-win\\chrome.exe';

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
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)));
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));

await page.goto('http://localhost:3000/department/gestao-tripulantes', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(6000);

const snap = async (label) => {
  const s = await page.evaluate(() => ({
    url: location.href,
    overlay: !!document.querySelector('.fixed.inset-0.z-50'),
    overlayText: (document.querySelector('.fixed.inset-0.z-50')?.innerText || '').slice(0, 80),
    tabBtn: !!Array.from(document.querySelectorAll('button')).find((b) => /Man Schedule/i.test(b.textContent || '')),
    scrollport: !!document.querySelector('[data-testid="man-schedule-scroll"]'),
    rows: document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length,
  }));
  console.log(label, JSON.stringify(s));
};
await snap('after-load:');

// dismiss overlay
await page.evaluate(() => {
  const overlay = document.querySelector('.fixed.inset-0.z-50');
  const cta = overlay && Array.from(overlay.querySelectorAll('button')).find((b) => /got it|vamos|continuar|fechar|ok/i.test(b.textContent || ''));
  if (cta) cta.click();
});
await page.waitForTimeout(1500);
await snap('after-dismiss:');

// click the tab via DOM (bypasses actionability flakes)
const clicked = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => /Man Schedule \(Escala MIO\)/i.test(b.textContent || ''));
  if (!btn) return false;
  btn.click();
  return true;
});
console.log('dom click:', clicked);
await page.waitForTimeout(4000);
await snap('after-click:');
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(6000);
  const s = await page.evaluate(() => ({
    scrollport: !!document.querySelector('[data-testid="man-schedule-scroll"]'),
    rows: document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length,
    cols: document.querySelectorAll('[data-man-schedule-col]').length,
  }));
  console.log(`poll ${i}:`, JSON.stringify(s));
  if (s.rows > 3) break;
}
await page.screenshot({ path: 'scripts/_tmp_shots/gt-click-debug.png' });
console.log('errors:', errs.slice(0, 8));
await browser.close();
