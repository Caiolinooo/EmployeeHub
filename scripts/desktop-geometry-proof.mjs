/**
 * Prova de geometria desktop no app real (`next start`).
 * Sem harness estático. Sessão/APIs via page.route.
 *
 *   BEFORE_URL=http://127.0.0.1:3020 AFTER_URL=http://127.0.0.1:3021 \
 *   node scripts/desktop-geometry-proof.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = process.env.GEOM_DOCS || join(ROOT, 'docs/mobile-audit/fix-mobile-ui/desktop-geometry');
const BEFORE_URL = process.env.BEFORE_URL;
const AFTER_URL = process.env.AFTER_URL;
const VIEWPORTS = (process.env.VIEWPORTS || '1280x800,1440x900').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height };
});

const USER_ID = '00000000-0000-4000-8000-000000000001';
const COLAB_ID = '00000000-0000-4000-8000-0000000000aa';
const FAKE_JWT =
  'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQURNSU4ifQ.proof';

const MODULES = {
  dashboard: true,
  noticias: true,
  calendario: true,
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
  phone_number: '',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  access_permissions: {
    modules: MODULES,
    features: {
      'gestao-tripulantes.documents.edit': true,
      'gestao-tripulantes.documents.delete': true,
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
  matricula_esocial: '1001',
  foto_url: '',
  cargo_nome: 'Marinheiro',
  empresa_nome: 'ABZ Offshore',
  embarcacao_nome: 'Navio Prova',
  centro_custo_nome: 'CC-01',
  status_embarque: 'embarcado',
  standby: false,
  regime_trabalho: '14x14',
  escala_embarque: 14,
  escala_folga: 14,
  data_admissao: '2020-01-15',
  ativo: true,
  data_proximo_embarque: '2026-10-01',
  qtd_docs_vencidos: 0,
  qtd_docs_vencendo: 0,
  qtd_docs_validos: 2,
  documentos: [],
  embarques: [],
  substituicoes: [],
};

const DASHBOARD = {
  total_colaboradores: 4,
  total_embarcados: 1,
  total_disponiveis: 1,
  total_docs_vencidos: 0,
  total_docs_vencendo: 0,
  total_docs_vencidos_historico: 0,
  asos_pendentes_revisao: 0,
};

const SCHEDULE = {
  id: 'sched-1',
  cpf: '00000000000',
  matricula: '1001',
  centro_custo: 'CC-01',
  full_name: 'ANA SOUZA',
  position: 'MARINHEIRO',
  vessel: 'NAVIO PROVA',
  company: 'ABZ Offshore',
  rotation_start: '2026-09-18',
  rotation_end: '2026-10-01',
  embarque_status: 'Embarcado',
  local_embarque: '',
  rotation_type: 'normal',
  observacoes: null,
  tipo_codigo: 'ON',
  origem: 'local',
  ativo: true,
  exibir_dia_inicio: false,
};

function json(data, status = 200) {
  return {
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(data),
  };
}

function mockApi(urlString, req) {
  const url = new URL(urlString);
  const p = url.pathname;
  const accept = String(req?.headers?.()['accept'] || req?.headers?.()['Accept'] || '');

  if (p.includes('/api/config')) {
    return json({
      title: 'Painel ABZ Group',
      description: 'Painel centralizado',
      logo: '',
      favicon: '/favicon.ico',
      primaryColor: '#005dff',
      secondaryColor: '#6339F5',
      login_logo: '',
      sidebar_logo: '',
      widget_logo: '',
      companyName: 'ABZ Group',
      contactEmail: 'contato@example.com',
      footerText: '© 2026 ABZ Group',
      dashboardTitle: 'Centro de Recursos',
      dashboardDescription: 'Bem-vindo',
      sidebarTitle: 'Painel ABZ',
      googleClientId: '',
      googleClientSecret: '',
      googleRedirectUri: '',
    });
  }
  if (p.includes('/api/i18n')) return json({ data: [] });
  if (p.includes('/api/auth/verify-token')) {
    return json({ success: true, userId: USER_ID, role: 'ADMIN', timestamp: '2026-09-25T00:00:00.000Z' });
  }
  if (p.includes('/api/auth/token-refresh')) {
    return json({ success: true, token: FAKE_JWT, expiresIn: 86400 });
  }
  if (p.includes('/api/user/effective-permissions')) {
    return json({
      success: true,
      effective_modules: MODULES,
      effective_features: USER.access_permissions.features,
      acl_permission_names: ['gestao-tripulantes.documents.edit', 'gestao-tripulantes.matrizes.view'],
    });
  }
  if (p.includes('/api/gestao-tripulantes/dashboard')) return json({ success: true, data: DASHBOARD });
  if (p.includes('/api/gestao-tripulantes/live-probe')) {
    return json({ success: true, assinatura: 'proof-1', updatedAt: '2026-09-25T00:00:00.000Z' });
  }
  if (p.includes(`/api/gestao-tripulantes/colaboradores/${COLAB_ID}/desligamento`)) {
    return json({ success: true, data: null, pode_registrar: true });
  }
  if (p.includes(`/api/gestao-tripulantes/colaboradores/${COLAB_ID}`)) {
    return json({ success: true, data: COLAB });
  }
  if (p.includes('/api/gestao-tripulantes/colaboradores')) return json({ success: true, data: [COLAB] });
  if (p.includes('/api/gestao-tripulantes/tipos-evento')) return json({ success: true, data: [] });
  if (p.includes('/api/gestao-tripulantes/matrizes')) return json({ success: true, data: [] });
  if (p.includes('/api/man-schedule/realtime')) {
    return json({
      success: true,
      count: 1,
      data: [SCHEDULE],
      meta: {
        vessels: ['NAVIO PROVA'],
        positions: ['MARINHEIRO'],
        companies: ['ABZ Offshore'],
        cached: false,
        janela: 'all',
        source: 'gt_historico_embarques',
        window: { from: '2026-09-01', to: '2026-10-31' },
      },
    });
  }
  if (p.includes('/api/document-catalog')) {
    return json({
      success: true,
      identity: {
        userId: USER_ID,
        colaboradorId: COLAB_ID,
        fullName: 'Ana Souza',
        matchedByCpf: false,
        matchedByEmail: true,
      },
      documents: [],
      sources: [],
      total: 0,
    });
  }
  if (p.includes('/api/leave/requests')) return json([]);
  if (p.includes('/api/leave/config')) return json({ success: true, days: 30 });
  if (p.includes('/api/admin/leave-approvals')) return json({ isApprover: false, requests: [] });
  if (p.includes('/api/admin/leave-requests')) return json([]);
  if (p.includes('/api/news/posts')) {
    return json({ posts: [], total: 0, page: 1, pagination: { page: 1, hasNext: false, hasPrev: false, total: 0 } });
  }
  if (p.includes('/api/reembolso/user')) return json({ data: [], pagination: { total: 0 } });
  if (p.includes('/api/reembolso/')) return json({ success: true, data: [] });
  if (p.includes('/api/contracheque')) return json({ success: true, data: [] });
  if (p.includes('/api/calendar')) return json({ events: [], data: [] });
  if (p.includes('/api/user-shortcuts')) return json([]);
  if (p.includes('/api/admin/modules')) return json([]);
  if (p.includes('/api/admin/role-permissions')) return json({});
  if (p.includes('/api/cards')) return json([]);
  if (p.includes('/api/purchase-orders')) return json({ success: true, data: [] });
  if (p.includes('/api/dashboard/pendencies')) {
    return json({ emails_nao_lidos: 0, ferias_pendentes: 0, reembolsos_pendentes: 0 });
  }
  if (p.includes('/api/ia/')) return json({ success: true, sessionId: 'proof', messages: [] });
  if (p.includes('/api/notifications')) return json({ success: true, data: [] });
  if (p.includes('/api/')) return json({ success: true, data: [], items: [], requests: [], posts: [] });
  if (p.includes('/rest/v1/users_unified')) {
    if (accept.includes('vnd.pgrst.object+json')) return json(USER);
    return json([USER]);
  }
  if (p.includes('/rest/v1/sectors')) {
    return {
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify([
        {
          id: '00000000-0000-4000-8000-0000000000s1',
          name: 'Operações',
          description: 'Setor mockado para prova do ConfirmationModal',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
    };
  }
  if (p.includes('/rest/v1/')) return json([]);
  if (p.includes('/auth/v1/')) return json({ access_token: null, token_type: 'bearer' });
  return null;
}

async function attachMocks(page, { showLanguage, authed }) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ token, showLanguage: showLang, authed: isAuthed }) => {
      if (isAuthed) {
        localStorage.setItem('abzToken', token);
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('abzToken');
        localStorage.removeItem('token');
      }
      localStorage.setItem('main-sidebar-collapsed', 'true');
      localStorage.setItem('admin-sidebar-collapsed', 'true');
      localStorage.setItem('sidebar-meurh-open', 'false');
      localStorage.setItem('sidebar-dept-open', 'false');
      if (showLang) localStorage.removeItem('languageDialogShown');
      else localStorage.setItem('languageDialogShown', 'true');
    },
    { token: FAKE_JWT, showLanguage, authed },
  );
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/_next/') || url.includes('/images/') || url.includes('/fonts/') || url.includes('/rive/')) {
      return route.continue();
    }
    const mocked = mockApi(url, req);
    if (mocked) return route.fulfill(mocked);
    return route.continue();
  });
}

async function settle(page) {
  await page.waitForTimeout(1400);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
  await page.waitForTimeout(500);
}

function boxOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 0.5 && r.height < 0.5) return { x: r.x, y: r.y, w: r.width, h: r.height, empty: true };
  return { x: Number(r.x.toFixed(2)), y: Number(r.y.toFixed(2)), w: Number(r.width.toFixed(2)), h: Number(r.height.toFixed(2)) };
}

async function collectBoxes(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Number(r.x.toFixed(2)),
        y: Number(r.y.toFixed(2)),
        w: Number(r.width.toFixed(2)),
        h: Number(r.height.toFixed(2)),
      };
    };
    const first = (sel) => document.querySelector(sel);
    const byText = (tag, re) =>
      [...document.querySelectorAll(tag)].find((n) => re.test(n.textContent || ''));

    const dateStartLabel = byText('label', /Data Inicio|Data início/i);
    const dateEndLabel = byText('label', /Data Fim/i);
    const toolbar = dateStartLabel?.closest('.flex.items-end') || dateStartLabel?.parentElement?.parentElement;
    const confirmPanel = [...document.querySelectorAll('.fixed')].find((n) =>
      /Excluir Setor|Tem certeza que deseja excluir este setor/i.test(n.textContent || ''),
    );
    const languageEl = [...document.querySelectorAll('.fixed, [data-modal-panel], [role="dialog"]')].find((n) =>
      /idioma|language|Choose Your Language/i.test(n.textContent || ''),
    );
    const kpiEl =
      first('[data-gt-kpi-cards]') ||
      [...document.querySelectorAll('div')].find(
        (d) =>
          /Total de Tripulantes/i.test(d.textContent || '') &&
          d.querySelectorAll('button').length >= 3 &&
          d.getBoundingClientRect().height < 220,
      );
    const closeBtn = [...document.querySelectorAll('button[aria-label="Fechar"], [data-modal-close]')].find(
      (el) => {
        const r = el.getBoundingClientRect();
        return r.width >= 16 && r.height >= 16;
      },
    );
    const companion =
      first('[aria-label="Abrir Companion ABZ"]') ||
      first('[data-fab-companion]');
    const help =
      first('[data-help-trigger]') ||
      first('[data-fab-help]') ||
      first('[aria-label="Ajuda"]');

    const keep = (b) => (b && b.w >= 0.5 && b.h >= 0.5 ? b : null);
    const notOverlay = (b) => {
      const k = keep(b);
      if (!k) return null;
      if (k.w >= window.innerWidth - 2 && k.h >= window.innerHeight - 2) return null;
      return k;
    };

    const confirmTitleEl = byText('h2,h3', /Excluir Setor|Confirmar/i);

    return {
      header: keep(box(first('header'))),
      sidebar: keep(box(first('aside'))),
      main: keep(box(first('[data-portal-main], main'))),
      shell: keep(box(first('[data-testid="gt-page-shell"]'))),
      tabnav: keep(box(first('[data-testid="gt-page-shell"] nav') || first('nav.flex'))),
      tablist: keep(box(first('[data-testid="collaborator-modal-tablist"], [role="tablist"]'))),
      kpi: keep(box(kpiEl)),
      table: keep(box(first('[data-testid="gt-page-shell"] table') || first('table'))),
      schedule: keep(box(first('[data-testid="man-schedule-scroll"]'))),
      toolbar: keep(box(toolbar)),
      dateStart: keep(box(dateStartLabel)),
      dateEnd: keep(box(dateEndLabel)),
      fichaTablist: keep(box(first('[data-testid="collaborator-modal-tablist"]'))),
      fichaBody: keep(box(first('[data-testid="collaborator-modal-body"]'))),
      fichaPanel: keep(box(first('[data-testid="collaborator-modal-body"]')?.closest('[class*="max-w-6xl"]'))),
      modalPanel: notOverlay(
        box(
          first('[data-testid="collaborator-modal-body"]')?.closest('[class*="max-w-6xl"]') ||
            confirmTitleEl?.closest('.bg-white, [class*="rounded"]') ||
            languageEl?.querySelector('.bg-white, [class*="rounded"]') ||
            first('[data-modal-panel]'),
        ),
      ),
      modalClose: keep(box(closeBtn)),
      confirmTitle: keep(box(byText('h2,h3', /Excluir Setor|Confirmar/i))),
      confirmCancel: keep(box(byText('button', /^Cancelar$/i))),
      confirmOk: keep(box(byText('button', /^Excluir$|^Confirmar$/i))),
      languagePanel: keep(box(languageEl)),
      loginCard: keep(box(first('form') || first('input[type="password"]')?.closest('div'))),
      loginTitle: keep(box(first('h1'))),
      fabHelp: keep(box(help)),
      fabCompanion: keep(box(companion)),
    };
  });
}

async function capturePage(page, baseUrl, path, extra) {
  const url = new URL(path, baseUrl).toString();
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settle(page);
  if (extra) await extra(page);
  await settle(page);
  const boxes = await collectBoxes(page);
  const info = await page.evaluate(() => ({
    href: location.href,
    title: document.title,
    body: document.body.innerText.slice(0, 280),
  }));
  return { status: resp?.status() ?? 0, ...info, boxes };
}

async function openSchedule(page) {
  const tab = page.getByRole('button', { name: /Man Schedule/i }).first();
  await tab.waitFor({ timeout: 12_000 });
  await tab.click();
  await page.waitForTimeout(1600);
  await page.locator('[data-testid="man-schedule-scroll"]').waitFor({ timeout: 12_000 }).catch(() => {});
}

async function openFicha(page) {
  const row = page.getByText('Ana Souza').first();
  if (await row.count()) {
    await row.click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(900);
  }
}

async function openConfirm(page) {
  const del = page.locator('button[title="Excluir"]').first();
  await del.waitFor({ timeout: 12_000 });
  await del.click();
  await page.getByText('Excluir Setor').waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
}

async function runSide(baseUrl, outDir, viewport) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport, locale: 'pt-BR' });
  const page = await ctx.newPage();
  await attachMocks(page, { showLanguage: false, authed: true });
  const results = {};
  const shots = {};

  const allPages = [
    ['dashboard', '/dashboard', null],
    ['gt-lista', '/department/gestao-tripulantes', null],
    ['gt-escala', '/department/gestao-tripulantes', openSchedule],
    ['ferias', '/ferias', null],
    ['reembolso', '/reembolso', null],
    ['contracheque', '/contracheque', null],
  ];
  const only = (process.env.ONLY_PAGES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const pages = only.length ? allPages.filter(([name]) => only.includes(name)) : allPages;

  for (const [name, path, extra] of pages) {
    results[name] = await capturePage(page, baseUrl, path, extra);
    const shot = join(outDir, `${name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    shots[name] = shot;
  }

  const want = (name) => !only.length || only.includes(name);

  if (want('ficha')) {
    results.ficha = await capturePage(page, baseUrl, '/department/gestao-tripulantes', openFicha);
    await page.screenshot({ path: join(outDir, 'ficha.png'), fullPage: false });
    shots.ficha = join(outDir, 'ficha.png');
  }

  if (want('confirm')) {
    results.confirm = await capturePage(page, baseUrl, '/admin/setores', openConfirm);
    await page.screenshot({ path: join(outDir, 'confirm.png'), fullPage: false });
    shots.confirm = join(outDir, 'confirm.png');
  }

  if (want('login')) {
    const loginCtx = await browser.newContext({ viewport, locale: 'pt-BR' });
    const loginPage = await loginCtx.newPage();
    await attachMocks(loginPage, { showLanguage: false, authed: false });
    results.login = await capturePage(loginPage, baseUrl, '/login');
    await loginPage.screenshot({ path: join(outDir, 'login.png'), fullPage: false });
    shots.login = join(outDir, 'login.png');
    await loginCtx.close();
  }

  if (want('language')) {
    const langCtx = await browser.newContext({ viewport, locale: 'pt-BR' });
    const langPage = await langCtx.newPage();
    await attachMocks(langPage, { showLanguage: true, authed: true });
    results.language = await capturePage(langPage, baseUrl, '/dashboard', async (p) => {
      await p.waitForTimeout(1600);
    });
    await langPage.screenshot({ path: join(outDir, 'language.png'), fullPage: false });
    shots.language = join(outDir, 'language.png');
    await langCtx.close();
  }

  await ctx.close();
  await browser.close();
  writeFileSync(join(outDir, 'boxes.json'), JSON.stringify(results, null, 2));
  return { results, shots };
}

function boxesEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function formatBox(b) {
  if (!b) return '—';
  return `${b.w}×${b.h}@(${b.x},${b.y})`;
}

async function diffPng(aPath, bPath, heatPath) {
  if (!existsSync(aPath) || !existsSync(bPath)) return { px: -1, reason: 'missing' };
  const a = sharp(readFileSync(aPath)).ensureAlpha();
  const b = sharp(readFileSync(bPath)).ensureAlpha();
  const [am, bm] = await Promise.all([a.metadata(), b.metadata()]);
  if (am.width !== bm.width || am.height !== bm.height) {
    return { px: (am.width || 0) * (am.height || 0), reason: `size ${am.width}x${am.height} vs ${bm.width}x${bm.height}` };
  }
  const [ar, br] = await Promise.all([a.raw().toBuffer(), b.raw().toBuffer()]);
  let px = 0;
  let maxChannel = 0;
  const heat = Buffer.alloc(ar.length, 255);
  for (let i = 0; i < ar.length; i += 4) {
    const dr = Math.abs(ar[i] - br[i]);
    const dg = Math.abs(ar[i + 1] - br[i + 1]);
    const db = Math.abs(ar[i + 2] - br[i + 2]);
    const da = Math.abs(ar[i + 3] - br[i + 3]);
    const diff = dr || dg || db || da;
    maxChannel = Math.max(maxChannel, dr, dg, db, da);
    if (diff) {
      px += 1;
      heat[i] = 220;
      heat[i + 1] = 30;
      heat[i + 2] = 30;
      heat[i + 3] = 255;
    } else {
      heat[i] = Math.round(ar[i] * 0.35 + 165);
      heat[i + 1] = Math.round(ar[i + 1] * 0.35 + 165);
      heat[i + 2] = Math.round(ar[i + 2] * 0.35 + 165);
      heat[i + 3] = 255;
    }
  }
  if (heatPath && px > 0) {
    await sharp(heat, { raw: { width: am.width, height: am.height, channels: 4 } }).png().toFile(heatPath);
  }
  return { px, maxChannel };
}

if (process.env.MODE === 'swipe-esc') {
  const headUrl = process.env.HEAD_URL || 'http://127.0.0.1:3021';
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'pt-BR',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await attachMocks(page, { showLanguage: false, authed: true });
  const vis = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-modal-panel], .fixed.inset-0, [role=dialog]')].filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width >= 8 && r.height >= 8 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0;
      }).length,
    );

  await page.goto(`${headUrl}/department/gestao-tripulantes`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settle(page);
  const kpi = await page.evaluate(() => {
    const el = document.querySelector('[data-gt-kpi-cards]');
    if (!el) return null;
    return { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, overflowX: getComputedStyle(el).overflowX };
  });
  const tabs = await page.evaluate(() => {
    const nav = document.querySelector('[data-testid="gt-page-shell"] nav');
    const shell = nav?.parentElement;
    return {
      navScroll: nav?.scrollWidth,
      navClient: nav?.clientWidth,
      shellOverflowX: shell ? getComputedStyle(shell).overflowX : null,
    };
  });

  await page.goto(`${headUrl}/admin/setores`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settle(page);
  await page.locator('button[title="Excluir"]').first().click();
  await page.waitForTimeout(400);
  const confirmBefore = await vis();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const confirmAfter = await vis();

  await page.goto(`${headUrl}/department/gestao-tripulantes`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settle(page);
  await page.getByText('Ana Souza').first().click();
  await page.waitForTimeout(800);
  const desligar = page.getByTestId('desligar-colaborador');
  let deslig = { opened: false };
  if (await desligar.count()) {
    await desligar.click();
    await page.waitForTimeout(500);
    const before = await vis();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    deslig = { opened: true, before, after: await vis() };
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Man Schedule/i }).click();
  await page.waitForTimeout(1600);
  const fech = page.getByRole('button', { name: /Fechamento/i });
  let fechamento = { opened: false };
  if (await fech.count()) {
    await fech.click();
    await page.waitForTimeout(700);
    const before = await vis();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    fechamento = { opened: true, before, after: await vis() };
  }

  await page.goto(`${headUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settle(page);
  const addBtn = page.getByRole('button', { name: /atalho|shortcut|Adicionar/i }).first();
  let addShortcut = { opened: false, btn: await addBtn.count() };
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(700);
    const before = await vis();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    addShortcut = { opened: true, btn: 1, before, after: await vis() };
  }

  const out = {
    kpi,
    tabs,
    confirmEsc: { before: confirmBefore, after: confirmAfter },
    deslig,
    fechamento,
    addShortcut,
  };
  mkdirSync(join(DOCS, 'mobile'), { recursive: true });
  writeFileSync(join(DOCS, 'mobile/swipe-esc.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(0);
}

if (!BEFORE_URL || !AFTER_URL) {
  console.error('BEFORE_URL e AFTER_URL obrigatórios');
  process.exit(2);
}

mkdirSync(DOCS, { recursive: true });
const pair = process.env.PAIR || 'base-vs-head';
const table = [];
const summary = { pair, viewports: VIEWPORTS, pages: {} };

for (const viewport of VIEWPORTS) {
  const vp = `${viewport.width}x${viewport.height}`;
  const beforeDir = join(DOCS, pair, vp, 'base');
  const afterDir = join(DOCS, pair, vp, 'head');
  const heatDir = join(DOCS, pair, vp, 'heat');
  mkdirSync(heatDir, { recursive: true });
  const before = await runSide(BEFORE_URL, beforeDir, viewport);
  const after = await runSide(AFTER_URL, afterDir, viewport);
  summary.pages[vp] = {};
  for (const name of Object.keys(after.results)) {
    const bBoxes = before.results[name]?.boxes || {};
    const aBoxes = after.results[name]?.boxes || {};
    const keys = [...new Set([...Object.keys(bBoxes), ...Object.keys(aBoxes)])];
    const pageRows = [];
    for (const key of keys) {
      const equal = boxesEqual(bBoxes[key], aBoxes[key]);
      const row = {
        page: name,
        viewport: vp,
        element: key,
        bbox_base: bBoxes[key],
        bbox_head: aBoxes[key],
        equal,
      };
      table.push(row);
      pageRows.push(row);
    }
    const shot = await diffPng(before.shots[name], after.shots[name], join(heatDir, `${name}-heat.png`));
    summary.pages[vp][name] = {
      status_base: before.results[name]?.status,
      status_head: after.results[name]?.status,
      href_base: before.results[name]?.href,
      href_head: after.results[name]?.href,
      boxes_equal: pageRows.filter((r) => r.bbox_base || r.bbox_head).every((r) => r.equal),
      boxes_diff: pageRows.filter((r) => !r.equal && (r.bbox_base || r.bbox_head)).map((r) => r.element),
      px: shot.px,
      maxChannel: shot.maxChannel || 0,
    };
  }
}

writeFileSync(join(DOCS, `${pair}-bboxes.json`), JSON.stringify({ summary, table }, null, 2));

const md = [
  `# Geometria desktop — ${pair}`,
  '',
  '| página | viewport | elemento | bbox base | bbox HEAD | igual? |',
  '|---|---|---|---|---|---|',
  ...table
    .filter((r) => r.bbox_base || r.bbox_head)
    .map((r) => `| ${r.page} | ${r.viewport} | ${r.element} | ${formatBox(r.bbox_base)} | ${formatBox(r.bbox_head)} | ${r.equal ? 'sim' : 'NÃO'} |`),
  '',
  '## Resumo px / boxes',
  '',
  '| viewport | página | boxes iguais | boxes diff | px | maxChannel |',
  '|---|---|---|---|---:|---:|',
];
for (const [vp, pages] of Object.entries(summary.pages)) {
  for (const [name, info] of Object.entries(pages)) {
    md.push(
      `| ${vp} | ${name} | ${info.boxes_equal ? 'sim' : 'não'} | ${(info.boxes_diff || []).join(', ') || '—'} | ${info.px} | ${info.maxChannel} |`,
    );
  }
}
writeFileSync(join(DOCS, `${pair}-table.md`), md.join('\n') + '\n');
console.log(JSON.stringify(summary, null, 2));

const geomFail = table.some((r) => !r.equal && (r.bbox_base || r.bbox_head));
if (geomFail) process.exitCode = 1;
