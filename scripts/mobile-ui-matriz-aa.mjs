/**
 * GT Matriz 1440: after-vs-after no mesmo servidor (prova AA).
 *   AFTER_URL=http://127.0.0.1:3002 node scripts/mobile-ui-matriz-aa.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const AFTER_URL = process.env.AFTER_URL || 'http://127.0.0.1:3002';
const OUT = process.env.OUT || '/tmp/mui-1440-matriz-aa';
const VIEWPORT = { width: 1440, height: 900 };
const FAKE_JWT =
  'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQURNSU4ifQ.proof';

mkdirSync(OUT, { recursive: true });

async function capture(file) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT, locale: 'pt-BR' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((token) => {
    localStorage.setItem('abzToken', token);
    localStorage.setItem('token', token);
    localStorage.setItem('languageDialogShown', 'true');
    localStorage.setItem('main-sidebar-collapsed', 'true');
  }, FAKE_JWT);
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/_next/') || url.includes('/images/') || url.includes('/fonts/') || url.includes('/rive/')) {
      return route.continue();
    }
    if (url.includes('/api/') || url.includes('/rest/v1/') || url.includes('/auth/v1/')) {
      const p = new URL(url).pathname;
      let body = { success: true, data: [] };
      if (p.includes('/api/config')) {
        body = { title: 'Painel ABZ Group', description: 'x', logo: '', favicon: '/favicon.ico', primaryColor: '#005dff', secondaryColor: '#6339F5', companyName: 'ABZ', dashboardTitle: 'x', dashboardDescription: 'x', sidebarTitle: 'x' };
      } else if (p.includes('/api/i18n')) body = { data: [] };
      else if (p.includes('/api/auth/verify-token')) body = { success: true, userId: '00000000-0000-4000-8000-000000000001', role: 'ADMIN' };
      else if (p.includes('/api/user/effective-permissions')) {
        body = { success: true, effective_modules: { 'gestao-tripulantes': true, dashboard: true, epi: true }, effective_features: { 'gestao-tripulantes.matrizes.view': true }, acl_permission_names: [] };
      } else if (p.includes('/api/gestao-tripulantes/dashboard')) {
        body = { success: true, data: { total_colaboradores: 4, total_embarcados: 1, total_disponiveis: 1, total_docs_vencidos: 0 } };
      } else if (p.includes('/api/gestao-tripulantes/colaboradores')) {
        body = { success: true, data: [{ id: '00000000-0000-4000-8000-0000000000aa', nome_completo: 'Ana Souza', cargo_nome: 'Marinheiro', empresa_nome: 'ABZ Offshore', ativo: true, status_embarque: 'embarcado' }] };
      } else if (p.includes('/api/user-shortcuts')) body = [];
      else if (p.includes('/rest/v1/users_unified')) {
        body = { id: '00000000-0000-4000-8000-000000000001', email: 'prova@example.com', first_name: 'Prova', last_name: 'Mobile', role: 'ADMIN', active: true, access_permissions: { modules: { 'gestao-tripulantes': true, dashboard: true, epi: true } } };
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    return route.continue();
  });
  await page.goto(new URL('/department/gestao-tripulantes', AFTER_URL).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1600);
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important}[data-help-trigger],[data-fab-companion],[data-fab-help],[aria-label="Abrir Companion ABZ"]{visibility:hidden!important}',
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: false });
  await browser.close();
}

function diffPng(aPath, bPath) {
  const a = sharp(readFileSync(aPath)).ensureAlpha();
  const b = sharp(readFileSync(bPath)).ensureAlpha();
  return Promise.all([a.raw().toBuffer(), b.raw().toBuffer()]).then(([ar, br]) => {
    let px = 0;
    for (let i = 0; i < ar.length; i += 4) {
      if (ar[i] !== br[i] || ar[i + 1] !== br[i + 1] || ar[i + 2] !== br[i + 2] || ar[i + 3] !== br[i + 3]) px += 1;
    }
    return px;
  });
}

await capture(join(OUT, 'a.png'));
await capture(join(OUT, 'b.png'));
const aa = await diffPng(join(OUT, 'a.png'), join(OUT, 'b.png'));
const midAfter = await diffPng('/tmp/mui-1440-before/gt-matriz.png', '/tmp/mui-1440-after/gt-matriz.png');
const report = { sameServerAfterVsAfter: aa, midVsAfter: midAfter };
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
