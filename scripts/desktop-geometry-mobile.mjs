/**
 * Mobile 390/375 contra next start real (HEAD). Sem harness estático.
 *   HEAD_URL=http://127.0.0.1:3021 node scripts/desktop-geometry-mobile.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs/mobile-audit/fix-mobile-ui/desktop-geometry/mobile');
const HEAD_URL = process.env.HEAD_URL || 'http://127.0.0.1:3021';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const COLAB_ID = '00000000-0000-4000-8000-0000000000aa';
const FAKE_JWT =
  'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQURNSU4ifQ.proof';

function json(data, status = 200) {
  return { status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(data) };
}

const MODULES = {
  dashboard: true,
  ferias: true,
  reembolso: true,
  contracheque: true,
  epi: true,
  'gestao-tripulantes': true,
  admin: true,
};
const USER = {
  id: USER_ID,
  email: 'prova.mobile@example.com',
  first_name: 'Prova',
  last_name: 'Mobile',
  role: 'ADMIN',
  active: true,
  access_permissions: {
    modules: MODULES,
    features: {
      'gestao-tripulantes.documents.edit': true,
      'gestao-tripulantes.matrizes.view': true,
    },
  },
};
const COLAB = {
  id: COLAB_ID,
  nome_completo: 'Ana Souza',
  cpf: '00000000000',
  email: 'ana.prova@example.com',
  matricula: '1001',
  cargo_nome: 'Marinheiro',
  empresa_nome: 'ABZ',
  embarcacao_nome: 'Navio',
  status_embarque: 'embarcado',
  ativo: true,
  documentos: [],
  embarques: [],
};
const SCHEDULE = {
  id: 'sched-1',
  full_name: 'ANA SOUZA',
  position: 'MARINHEIRO',
  vessel: 'NAVIO',
  company: 'ABZ',
  rotation_start: '2026-09-18',
  rotation_end: '2026-10-01',
  tipo_codigo: 'ON',
  origem: 'local',
  ativo: true,
};

function mockApi(urlString, req) {
  const p = new URL(urlString).pathname;
  const accept = String(req?.headers?.()['accept'] || '');
  if (p.includes('/api/config')) return json({ title: 'Painel', logo: '', favicon: '/favicon.ico', companyName: 'ABZ' });
  if (p.includes('/api/i18n')) return json({ data: [] });
  if (p.includes('/api/auth/verify-token')) return json({ success: true, userId: USER_ID, role: 'ADMIN' });
  if (p.includes('/api/auth/token-refresh')) return json({ success: true, token: FAKE_JWT, expiresIn: 86400 });
  if (p.includes('/api/user/effective-permissions')) {
    return json({ success: true, effective_modules: MODULES, effective_features: USER.access_permissions.features, acl_permission_names: [] });
  }
  if (p.includes('/api/gestao-tripulantes/dashboard')) {
    return json({ success: true, data: { total_colaboradores: 4, total_embarcados: 1, total_disponiveis: 1, total_docs_vencidos: 0, total_docs_vencendo: 0, total_docs_vencidos_historico: 0, asos_pendentes_revisao: 0 } });
  }
  if (p.includes('/api/gestao-tripulantes/live-probe')) return json({ success: true, assinatura: 'm' });
  if (p.includes(`/api/gestao-tripulantes/colaboradores/${COLAB_ID}/desligamento`)) {
    return json({ success: true, data: null, pode_registrar: true });
  }
  if (p.includes(`/api/gestao-tripulantes/colaboradores/${COLAB_ID}`)) return json({ success: true, data: COLAB });
  if (p.includes('/api/gestao-tripulantes/colaboradores')) return json({ success: true, data: [COLAB] });
  if (p.includes('/api/man-schedule/realtime')) {
    return json({ success: true, count: 1, data: [SCHEDULE], meta: { vessels: ['NAVIO'], positions: ['MARINHEIRO'], companies: ['ABZ'] } });
  }
  if (p.includes('/api/document-catalog')) return json({ success: true, identity: { colaboradorId: COLAB_ID }, documents: [], total: 0 });
  if (p.includes('/api/cards')) {
    return json([{ id: 'c1', title: 'GT', href: '/department/gestao-tripulantes', icon: 'FiUsers' }]);
  }
  if (p.includes('/api/user-shortcuts')) return json({ suggestions: [] });
  if (p.includes('/api/')) return json({ success: true, data: [], items: [] });
  if (p.includes('/rest/v1/users_unified')) return accept.includes('object+json') ? json(USER) : json([USER]);
  if (p.includes('/rest/v1/sectors')) {
    return {
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify([{ id: 's1', name: 'Ops', description: 'x', created_at: '2026-01-01', updated_at: '2026-01-01' }]),
    };
  }
  if (p.includes('/rest/v1/')) return json([]);
  if (p.includes('/auth/v1/')) return json({});
  return null;
}

async function attach(page) {
  await page.addInitScript(
    ({ token }) => {
      localStorage.setItem('abzToken', token);
      localStorage.setItem('token', token);
      localStorage.setItem('languageDialogShown', 'true');
      localStorage.setItem('main-sidebar-collapsed', 'true');
    },
    { token: FAKE_JWT },
  );
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/_next/') || url.includes('/images/') || url.includes('/fonts/')) return route.continue();
    const mocked = mockApi(url, req);
    if (mocked) return route.fulfill(mocked);
    return route.continue();
  });
}

async function box(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, sel);
}

async function visiblePanels(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('[data-modal-panel], [role="dialog"], .fixed.inset-0')].filter((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width < 8 || r.height < 8) return false;
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false;
      return true;
    }).length;
  });
}

async function runVp(viewport) {
  const vp = `${viewport.width}x${viewport.height}`;
  const out = { viewport: vp };
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport, locale: 'pt-BR', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await attach(page);

  await page.goto(`${HEAD_URL}/department/gestao-tripulantes`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1600);
  const table = await box(page, 'table');
  const kpi = await page.evaluate(() => {
    const el = document.querySelector('[data-gt-kpi-cards]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: getComputedStyle(el).overflowX };
  });
  const tabnav = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="gt-page-shell"] nav') || document.querySelector('nav.flex');
    if (!el) return null;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: getComputedStyle(el.parentElement || el).overflowX };
  });
  out.lista = { table, kpi, tabnav, ana: await page.getByText('Ana Souza').count() };
  await page.screenshot({ path: join(DOCS, `lista-${vp}.png`), fullPage: false });

  await page.goto(`${HEAD_URL}/department/gestao-tripulantes?tab=schedule`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1600);
  const schedule = await box(page, '[data-testid="man-schedule-scroll"]');
  out.escala = { schedule, ana: await page.getByText('ANA SOUZA').count() };
  await page.screenshot({ path: join(DOCS, `escala-${vp}.png`), fullPage: false });

  await page.goto(`${HEAD_URL}/admin/setores`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1200);
  const del = page.locator('button[title="Excluir"]').first();
  let confirm = { opened: false };
  if (await del.count()) {
    await del.click();
    await page.waitForTimeout(600);
    const x = await box(page, '[data-modal-close]');
    const before = await visiblePanels(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const after = await visiblePanels(page);
    confirm = { opened: true, x, x44: !!(x && x.w >= 44 && x.h >= 44), panelsBefore: before, panelsAfter: after };
  }
  out.confirm = confirm;

  await page.goto(`${HEAD_URL}/department/gestao-tripulantes`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1200);
  const row = page.getByText('Ana Souza').first();
  let ficha = { opened: false };
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(900);
    const x = await box(page, '[data-modal-close], [data-testid="collaborator-modal-tablist"]');
    const closeBtn = await box(page, '[data-modal-close]');
    const tabs = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="collaborator-modal-tablist"]');
      if (!el) return null;
      const shell = el.parentElement;
      return {
        innerScroll: el.scrollWidth,
        innerClient: el.clientWidth,
        shellScroll: shell?.scrollWidth,
        shellClient: shell?.clientWidth,
      };
    });
    const before = await visiblePanels(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    ficha = { opened: true, closeBtn, x44: !!(closeBtn && closeBtn.w >= 44 && closeBtn.h >= 44), tabs, panelsBefore: before, panelsAfter: await visiblePanels(page) };
  }
  out.ficha = ficha;

  await browser.close();
  return out;
}

mkdirSync(DOCS, { recursive: true });
const results = {};
for (const vp of [
  { width: 390, height: 844 },
  { width: 375, height: 812 },
]) {
  results[`${vp.width}x${vp.height}`] = await runVp(vp);
}
writeFileSync(join(DOCS, 'runtime.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
