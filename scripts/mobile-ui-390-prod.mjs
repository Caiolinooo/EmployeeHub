/**
 * Prints 390×844 em build de produção (sessão + APIs via page.route).
 * Não esconde FABs. Sem bypass no código.
 *
 *   AFTER_URL=http://127.0.0.1:3002 BEFORE_URL=http://127.0.0.1:3003 \
 *     node scripts/mobile-ui-390-prod.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs/mobile-audit/fix-mobile-ui');
const BEFORE_URL = process.env.BEFORE_URL;
const AFTER_URL = process.env.AFTER_URL;
const VIEWPORT = { width: 390, height: 844 };

const USER_ID = '00000000-0000-4000-8000-000000000001';
const COLAB_ID = '00000000-0000-4000-8000-0000000000aa';
const FAKE_JWT =
  'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQURNSU4ifQ.proof';

const MODULES = {
  dashboard: true,
  noticias: true,
  ferias: true,
  reembolso: true,
  ponto: true,
  contracheque: true,
  epi: true,
  'gestao-tripulantes': true,
  academy: true,
  avaliacao: true,
  social: true,
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
      'gestao-tripulantes.matrizes.view': true,
      'gestao-tripulantes.matrizes.manage': true,
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
  empresa_nome: 'ABZ Offshore',
  status_embarque: 'embarcado',
  ativo: true,
  documentos: [],
  embarques: [],
};

function json(data, status = 200) {
  return { status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(data) };
}

function mockApi(urlString) {
  const url = new URL(urlString);
  const p = url.pathname;
  if (p.includes('/api/config')) {
    return json({
      title: 'Painel ABZ Group',
      description: 'Painel',
      logo: '',
      favicon: '/favicon.ico',
      primaryColor: '#005dff',
      secondaryColor: '#6339F5',
      companyName: 'ABZ Group',
      dashboardTitle: 'Centro',
      dashboardDescription: 'Bem-vindo',
      sidebarTitle: 'Painel ABZ',
    });
  }
  if (p.includes('/api/i18n')) return json({ data: [] });
  if (p.includes('/api/auth/verify-token')) return json({ success: true, userId: USER_ID, role: 'ADMIN' });
  if (p.includes('/api/auth/token-refresh')) return json({ success: true, token: FAKE_JWT, expiresIn: 86400 });
  if (p.includes('/api/user/effective-permissions')) {
    return json({
      success: true,
      effective_modules: MODULES,
      effective_features: USER.access_permissions.features,
      acl_permission_names: ['gestao-tripulantes.matrizes.view'],
    });
  }
  if (p.includes('/api/gestao-tripulantes/dashboard')) {
    return json({
      success: true,
      data: { total_colaboradores: 4, total_embarcados: 1, total_disponiveis: 1, total_docs_vencidos: 0 },
    });
  }
  if (p.includes(`/api/gestao-tripulantes/colaboradores/${COLAB_ID}`)) return json({ success: true, data: COLAB });
  if (p.includes('/api/gestao-tripulantes/colaboradores')) return json({ success: true, data: [COLAB] });
  if (p.includes('/api/gestao-tripulantes/')) return json({ success: true, data: [] });
  if (p.includes('/api/man-schedule/realtime')) return json({ success: true, count: 0, data: [], meta: {} });
  if (p.includes('/api/document-catalog')) {
    return json({ success: true, identity: { colaboradorId: COLAB_ID, fullName: 'Ana Souza' }, documents: [], total: 0 });
  }
  if (p.includes('/api/news/posts')) {
    return json({ posts: [], total: 0, page: 1, pagination: { page: 1, hasNext: false, hasPrev: false, total: 0 } });
  }
  if (p.includes('/api/user-shortcuts')) return json([]);
  if (p.includes('/api/')) return json({ success: true, data: [], items: [], requests: [], posts: [] });
  if (p.includes('/rest/v1/users_unified')) return json(USER);
  if (p.includes('/rest/v1/')) return json([]);
  if (p.includes('/auth/v1/')) return json({ access_token: null, token_type: 'bearer' });
  return null;
}

async function attachMocks(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
    const url = route.request().url();
    if (url.includes('/_next/') || url.includes('/images/') || url.includes('/fonts/') || url.includes('/rive/')) {
      return route.continue();
    }
    const mocked = mockApi(url);
    if (mocked) return route.fulfill(mocked);
    return route.continue();
  });
}

async function measureKpi(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('[data-gt-kpi-cards], div[data-gt-kpi-cards]');
    if (!wrap) return { hasKpi: false };
    const cs = getComputedStyle(wrap);
    const cards = [...wrap.children];
    const last = cards[cards.length - 1];
    const lr = last?.getBoundingClientRect();
    return {
      hasKpi: true,
      display: cs.display,
      overflowX: cs.overflowX,
      wrapOverflowX: wrap.scrollWidth > wrap.clientWidth + 2,
      cardCount: cards.length,
      lastRight: lr ? Math.round(lr.right) : 0,
      viewport: window.innerWidth,
    };
  });
}

async function measureFabs(page) {
  return page.evaluate(() => {
    const help = document.querySelector('[data-fab-help], [data-help-trigger]');
    const companion = document.querySelector('[data-fab-companion], [aria-label="Abrir Companion ABZ"]');
    const main = document.querySelector('main[data-portal-main], main');
    const hr = help?.getBoundingClientRect();
    const cr = companion?.getBoundingClientRect();
    return {
      help: hr ? { w: Math.round(hr.width), h: Math.round(hr.height), top: Math.round(hr.top), right: Math.round(hr.right) } : null,
      companion: cr ? { w: Math.round(cr.width), h: Math.round(cr.height), top: Math.round(cr.top), right: Math.round(cr.right) } : null,
      mainPb: main ? getComputedStyle(main).paddingBottom : null,
    };
  });
}

async function shotSide(baseUrl, prefix) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'pt-BR', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await attachMocks(page);
  const out = {};

  await page.goto(new URL('/department/gestao-tripulantes', baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(1600);
  out.kpi = await measureKpi(page);
  out.fabGt = await measureFabs(page);
  const gtFile = join(DOCS, `prod-390-${prefix}-gt-matriz.png`);
  await page.screenshot({ path: gtFile, fullPage: false });
  out.gtFile = gtFile;

  const row = page.getByText('Ana Souza').first();
  if (await row.count()) {
    await row.click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(900);
    const qhse = page.locator('[data-tab-key="qhse"]');
    if (await qhse.count()) await qhse.click({ timeout: 4_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const tabFile = join(DOCS, `prod-390-${prefix}-ficha-qhse.png`);
    await page.screenshot({ path: tabFile, fullPage: false });
    out.fichaFile = tabFile;
    await page.evaluate(() => {
      const shell = document.querySelector('[data-testid="collaborator-modal-tablist"]')?.parentElement;
      if (shell) shell.scrollLeft = shell.scrollWidth;
    });
    const swipeFile = join(DOCS, `prod-390-${prefix}-ficha-qhse-swipe.png`);
    await page.screenshot({ path: swipeFile, fullPage: false });
    out.fichaSwipeFile = swipeFile;
    out.tabs = await page.evaluate(() => {
      const inner = document.querySelector('[data-testid="collaborator-modal-tablist"]');
      const shell = inner?.parentElement;
      return {
        hasTablist: !!inner,
        overflowX: shell ? getComputedStyle(shell).overflowX : '',
        canSwipe: shell ? ['auto', 'scroll'].includes(getComputedStyle(shell).overflowX) : false,
        scrollable: shell ? shell.scrollWidth > shell.clientWidth + 2 : false,
      };
    });
  }

  await page.goto(new URL('/dashboard', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1600);
  out.fabDash = await measureFabs(page);
  const dashFile = join(DOCS, `prod-390-${prefix}-dashboard.png`);
  await page.screenshot({ path: dashFile, fullPage: false });
  out.dashFile = dashFile;

  await browser.close();
  return out;
}

if (!BEFORE_URL || !AFTER_URL) {
  console.error('BEFORE_URL e AFTER_URL obrigatórios');
  process.exit(2);
}

mkdirSync(DOCS, { recursive: true });
const before = await shotSide(BEFORE_URL, 'antes');
const after = await shotSide(AFTER_URL, 'depois');
const report = { viewport: VIEWPORT, before, after };
writeFileSync(join(DOCS, 'prod-390-metrics.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
