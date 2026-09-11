// TEMP: debug GT page tab buttons
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
}, [session, profile, customToken]);
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('http://localhost:3000/department/gestao-tripulantes', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(15000);
const state = await page.evaluate(() => ({
  url: location.href,
  shell: !!document.querySelector('[data-testid="gt-page-shell"]'),
  buttons: Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim().slice(0, 45)).filter(Boolean).slice(0, 30),
  overlay: !!document.querySelector('.fixed.inset-0.z-50'),
}));
console.log(JSON.stringify(state, null, 1));
console.log('errors:', errs.slice(0, 6));
await page.screenshot({ path: 'scripts/_tmp_shots/gt-page-debug.png' });
await browser.close();
