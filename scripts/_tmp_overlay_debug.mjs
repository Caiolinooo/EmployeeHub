// TEMP: identify the blocking overlay
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const { session, profile, customToken } = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'scripts/_tmp_scroll_session.json'), 'utf8')
);
const CHROME_EXE = 'C:\\Users\\caio.correia\\AppData\\Local\\ms-playwright\\chromium-1181\\chrome-win\\chrome.exe';

const browser = await chromium.launch({ executablePath: CHROME_EXE });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
await ctx.addInitScript(([s, p, t]) => {
  localStorage.setItem('token', t);
  localStorage.setItem('abzToken', t);
  localStorage.setItem('supabase_auth_token', JSON.stringify(s));
  localStorage.setItem('auth', 'true');
  localStorage.setItem('user', JSON.stringify(p));
  localStorage.setItem('languageDialogShown', 'true');
}, [session, profile, customToken]);
const page = await ctx.newPage();
await page.goto('http://localhost:3000/department/man-schedule', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(12000);
const info = await page.evaluate(() => {
  const overlays = Array.from(document.querySelectorAll('.fixed.inset-0'));
  return overlays.map((o) => ({
    cls: o.className.slice(0, 120),
    text: (o.innerText || '').slice(0, 300),
    buttons: Array.from(o.querySelectorAll('button')).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 40)),
    hasImg: !!o.querySelector('img'),
    hasVideo: !!o.querySelector('video'),
    hasAudio: !!o.querySelector('audio'),
  }));
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: path.join('scripts/_tmp_shots', 'overlay-debug.png') });
await browser.close();
