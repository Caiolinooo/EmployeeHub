// TEMP probe: what happens after injecting the session?
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const { session, profile } = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_session.json'), 'utf8'));
const CHROME_EXE = 'C:\\Users\\caio.correia\\AppData\\Local\\ms-playwright\\chromium-1181\\chrome-win\\chrome.exe';

const browser = await chromium.launch({ executablePath: CHROME_EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(([s, p]) => {
  localStorage.setItem('supabase_auth_token', JSON.stringify(s));
  localStorage.setItem('auth', 'true');
  localStorage.setItem('user', JSON.stringify(p));
    localStorage.setItem('languageDialogShown', 'true');
}, [session, profile]);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`${BASE}/department/man-schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(25000);
const state = await page.evaluate(() => ({
  url: location.href,
  hasScrollport: !!document.querySelector('[data-testid="man-schedule-scroll"]'),
  hasTable: !!document.querySelector('table#man-schedule-table'),
  bodyText: document.body.innerText.slice(0, 400),
  lsKeys: Object.keys(localStorage).filter((k) => /supabase|auth|user/i.test(k)),
}));
await page.screenshot({ path: 'scripts/_tmp_shots/probe.png' });
console.log(JSON.stringify({ state, errors: errors.slice(0, 8) }, null, 2));
await browser.close();
