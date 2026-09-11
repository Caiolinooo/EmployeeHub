// TEMP: focused debug of the ‹ › nav buttons + bottom scrollbar visual evidence.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const shotsDir = path.resolve(process.cwd(), 'scripts/_tmp_shots');
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
await page.goto(`${BASE}/department/man-schedule`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('[data-man-schedule-col]', { timeout: 90000 });
await page.waitForFunction(
  () => document.querySelectorAll('[data-testid="man-schedule-scroll"] tbody tr').length > 3,
  { timeout: 60000 }
);
await page.waitForTimeout(2000);

// dump buttons with their accessible names
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).map((b) => ({
    text: b.textContent?.trim().slice(0, 20),
    aria: b.getAttribute('aria-label'),
    disabled: b.disabled,
  })).filter((b) => b.aria || b.text === '‹' || b.text === '›' || b.text === 'Hoje')
);
console.log('nav-ish buttons:', JSON.stringify(buttons, null, 1));

// click "Próxima semana" (week viewport) via exact accessible name
const before = await page.evaluate(() => document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft);
const btn = page.getByRole('button', { name: 'Próxima semana' });
const count = await btn.count();
console.log('matches for "Próxima semana":', count, 'disabled:', count ? await btn.first().isDisabled() : 'n/a');
await btn.first().click({ timeout: 5000 }).catch((e) => console.log('click error:', e.message.split('\n')[0]));
await page.waitForTimeout(900);
const after = await page.evaluate(() => document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft);
console.log(`nav › : scrollLeft ${before} -> ${after}`);

// "Hoje" button
await page.getByRole('button', { name: 'Hoje' }).first().click().catch((e) => console.log('hoje click error:', e.message.split('\n')[0]));
await page.waitForTimeout(900);
const afterHoje = await page.evaluate(() => document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft);
console.log(`Hoje: scrollLeft -> ${afterHoje}`);

// bottom scrollbar evidence: scroll a bit, then shoot the bottom strip of the scrollport
await page.evaluate(() => { document.querySelector('[data-testid="man-schedule-scroll"]').scrollLeft = 250; });
await page.waitForTimeout(500);
const box = await page.locator('[data-testid="man-schedule-scroll"]').boundingBox();
console.log('scrollport box:', JSON.stringify(box));
await page.screenshot({
  path: path.join(shotsDir, 'debug-bottom-scrollbar.png'),
  clip: { x: box.x, y: box.y + box.height - 60, width: box.width, height: 60 },
});
const css = await page.evaluate(() => {
  const sp = document.querySelector('[data-testid="man-schedule-scroll"]');
  const cs = getComputedStyle(sp);
  return { scrollbarWidth: cs.scrollbarWidth, scrollbarColor: cs.scrollbarColor, overflowX: cs.overflowX };
});
console.log('scrollport scrollbar CSS:', JSON.stringify(css));
await browser.close();
