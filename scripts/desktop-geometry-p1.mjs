/**
 * Prova de geometria desktop P1 no app real (`next start`).
 * Sem harness estático. Sessão/APIs via page.route.
 *
 *   MODULE=news|globalsearch|chat|academy \
 *   BEFORE_URL=http://127.0.0.1:3020 AFTER_URL=http://127.0.0.1:3031 \
 *   GEOM_DOCS=/tmp/p1-news/docs/mobile-audit/fix-mobile-p1/news/desktop-geometry \
 *   node /tmp/desktop-geometry-p1.mjs
 *
 *   MODE=mobile-esc HEAD_URL=... MODULE=news VIEWPORTS=390x844,375x812
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const MODULE = process.env.MODULE || 'news';
const DOCS = process.env.GEOM_DOCS || `/tmp/p1-${MODULE}-geom`;
const BEFORE_URL = process.env.BEFORE_URL;
const AFTER_URL = process.env.AFTER_URL;
const VIEWPORTS = (process.env.VIEWPORTS || '1280x800,1440x900').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  return { width, height };
});

const USER_ID = '00000000-0000-4000-8000-000000000001';
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
  academy: true,
  chat: true,
  ia: true,
  admin: true,
  social: true,
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
    features: { academy_editor: true, academy_moderator: true, 'news.publish': true },
  },
};

const NEWS_POST = {
  id: 'post-1',
  title: 'Post de prova',
  excerpt: 'Resumo',
  content: 'Conteudo de prova do editor fullscreen.',
  media_urls: [],
  external_links: [],
  tags: ['prova'],
  featured: false,
  pinned: false,
  views_count: 1,
  likes_count: 0,
  comments_count: 0,
  published_at: '2026-09-01T12:00:00.000Z',
  author: { id: USER_ID, first_name: 'Prova', last_name: 'Mobile', email: USER.email, role: 'ADMIN' },
  category: { id: 'cat-1', name: 'SMS', description: '', color: '#2563eb', icon: '' },
};

const COURSE = {
  id: 'course-1',
  title: 'NR-1 Prova',
  description: 'Curso mock',
  short_description: 'Mock',
  thumbnail_url: '',
  duration: 1800,
  difficulty_level: 'beginner',
  is_published: false,
  is_featured: false,
  tags: ['nr1'],
  prerequisites: [],
  learning_objectives: [],
  category_id: 'cat-1',
  instructor_id: USER_ID,
  view_count: 0,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  stats: { enrollments: 0, ratings_count: 0, average_rating: 0 },
  category: { id: 'cat-1', name: 'SMS', color: '#2563eb' },
};

const SERVER = {
  id: 'srv-1',
  name: 'ABZ Prova',
  description: 'Servidor mock',
  icon_url: '',
  is_public: true,
  created_by: USER_ID,
};

const SURFACES = {
  news: [
    ['login', '/login', null, { authed: false }],
    ['dashboard', '/dashboard', null],
    ['noticias', '/noticias', null],
    ['news-fullscreen', '/noticias', openNewsFullscreen],
  ],
  globalsearch: [
    ['login', '/login', null, { authed: false }],
    ['dashboard', '/dashboard', null],
    ['globalsearch-ctrlk', '/dashboard', openGlobalSearch],
  ],
  chat: [
    ['login', '/login', null, { authed: false }],
    ['dashboard', '/dashboard', null],
    ['chat', '/chat', null],
    ['chat-create-server', '/chat', openCreateServer],
    ['chat-start-dm', '/chat', openStartDm],
  ],
  academy: [
    ['login', '/login', null, { authed: false }],
    ['dashboard', '/dashboard', null],
    ['academy-editor', '/academy/editor', null],
    ['academy-delete', '/academy/editor', openAcademyDelete],
  ],
};

function json(data, status = 200) {
  return { status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(data) };
}

function mockApi(urlString, req) {
  const url = new URL(urlString);
  const p = url.pathname;
  const accept = String(req?.headers?.()['accept'] || req?.headers?.()['Accept'] || '');

  if (p.includes('/api/config')) {
    return json({
      title: 'Painel ABZ Group',
      description: 'Painel',
      logo: '',
      favicon: '/favicon.ico',
      primaryColor: '#005dff',
      secondaryColor: '#6339F5',
      login_logo: '',
      sidebar_logo: '',
      widget_logo: '',
      companyName: 'ABZ Group',
      contactEmail: 'contato@example.com',
      footerText: '© 2026',
      dashboardTitle: 'Centro',
      dashboardDescription: 'Bem-vindo',
      sidebarTitle: 'Painel ABZ',
    });
  }
  if (p.includes('/api/i18n')) return json({ data: [] });
  if (p.includes('/api/auth/verify-token')) {
    return json({ success: true, userId: USER_ID, role: 'ADMIN', timestamp: '2026-09-25T00:00:00.000Z' });
  }
  if (p.includes('/api/auth/token-refresh')) return json({ success: true, token: FAKE_JWT, expiresIn: 86400 });
  if (p.includes('/api/user/effective-permissions')) {
    return json({
      success: true,
      effective_modules: MODULES,
      effective_features: USER.access_permissions.features,
      acl_permission_names: ['news.edit', 'news.publish', 'news.create', 'academy.editor'],
    });
  }
  if (p.includes('/api/acl/')) {
    return json({
      user: { id: USER_ID, name: 'Prova', email: USER.email, role: 'ADMIN' },
      individual_permissions: [],
      role_permissions: [],
      hasPermission: true,
      granted: true,
      success: true,
    });
  }
  if (p.includes('/api/news/categories')) {
    return json([{ id: 'cat-1', name: 'SMS', description: '', color: '#2563eb', icon: '' }]);
  }
  if (p.includes('/api/news/posts/') || /\/api\/news\/posts\/[^/]+$/.test(p)) {
    return json({
      ...NEWS_POST,
      media_urls: JSON.stringify(NEWS_POST.media_urls || []),
      external_links: JSON.stringify([]),
      tags: JSON.stringify(NEWS_POST.tags || []),
      visibility_settings: JSON.stringify({ public: true, roles: [], users: [] }),
    });
  }
  if (p.includes('/api/news/posts')) {
    return json({
      posts: [NEWS_POST],
      total: 1,
      page: 1,
      pagination: { page: 1, hasNext: false, hasPrev: false, total: 1 },
    });
  }
  if (p.includes('/api/academy/categories')) {
    return json({ success: true, categories: [{ id: 'cat-1', name: 'SMS', color: '#2563eb' }] });
  }
  if (p.includes('/api/academy/modules')) {
    return json({
      success: true,
      modules: [{
        id: 'mod-1',
        course_id: 'course-1',
        title: 'Módulo 1',
        description: 'Intro',
        video_url: '',
        thumbnail_url: '',
        duration: 600,
        sort_order: 1,
        is_published: false,
      }],
    });
  }
  if (p.includes('/api/academy/questions')) {
    return json({
      success: true,
      questions: [{
        id: 'q-1',
        course_id: 'course-1',
        question_type: 'MULTIPLE_CHOICE',
        question_text: 'O que é NR-1?',
        order_index: 1,
        options: [
          { option_text: 'Norma', is_correct: true },
          { option_text: 'Outro', is_correct: false },
        ],
      }],
    });
  }
  if (p.includes('/api/academy/courses')) return json({ success: true, courses: [COURSE] });
  if (p.includes('/api/chat/servers')) return json({ servers: [SERVER] });
  if (p.includes('/api/chat/channels')) return json({ channels: [] });
  if (p.includes('/api/chat/users')) {
    return json({ users: [{ id: 'u-2', name: 'Colega Prova', email: 'colega@example.com', status: 'online' }] });
  }
  if (p.includes('/api/chat/presence')) return json({ success: true, users: [] });
  if (p.includes('/api/chat/messages')) return json({ messages: [] });
  if (p.includes('/api/search')) {
    return json({
      query: 'nr',
      results: [{
        id: 'r-1',
        type: 'news',
        title: 'NR-1 no portal',
        content: 'Resultado mock',
        url: '/noticias',
        relevance: 1,
      }],
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });
  }
  if (p.includes('/api/user-shortcuts')) return json([]);
  if (p.includes('/api/admin/modules')) return json([]);
  if (p.includes('/api/cards')) return json([]);
  if (p.includes('/api/notifications')) return json({ success: true, data: [] });
  if (p.includes('/api/dashboard/pendencies')) {
    return json({ emails_nao_lidos: 0, ferias_pendentes: 0, reembolsos_pendentes: 0 });
  }
  if (p.includes('/api/ia/')) return json({ success: true, sessionId: 'proof', messages: [], sessions: [] });
  if (p.includes('/api/')) return json({ success: true, data: [], items: [], posts: [], sessions: [], integrations: [] });
  if (p.includes('/rest/v1/users_unified')) {
    if (accept.includes('vnd.pgrst.object+json')) return json(USER);
    return json([USER]);
  }
  if (p.includes('/rest/v1/')) return json([]);
  if (p.includes('/auth/v1/')) return json({ access_token: null, token_type: 'bearer' });
  return null;
}

async function attachMocks(page, { authed = true } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ token, authed: isAuthed }) => {
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
      localStorage.setItem('languageDialogShown', 'true');
    },
    { token: FAKE_JWT, authed },
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

async function openNewsFullscreen(page) {
  await page.getByText('Post de prova').first().waitFor({ timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const more = buttons.find((b) => {
      const cls = String(b.className || '');
      return cls.includes('rounded-full') && cls.includes('p-2') && b.querySelector('svg')
        && !b.hasAttribute('data-help-trigger') && !b.hasAttribute('data-fab-companion');
    });
    if (more) more.click();
  });
  await page.waitForTimeout(500);
  const edit = page.getByRole('button', { name: /^\s*Editar\s*$/i });
  if (await edit.count()) await edit.first().click();
  else await page.getByText(/^\s*Editar\s*$/i).first().click({ timeout: 4000 }).catch(() => {});
  await page.getByText('Editor do ABZ News').first().waitFor({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function openGlobalSearch(page) {
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(500);
}

async function openCreateServer(page) {
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /criar novo servidor/i.test(b.getAttribute('title') || ''),
    );
    if (btn) btn.click();
  });
  await page.getByText('Nome do Servidor').first().waitFor({ timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function openStartDm(page) {
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('div')].find((el) => {
      const t = (el.textContent || '').trim();
      return t === 'Mensagens Diretas' || (t.startsWith('Mensagens Diretas') && t.length < 28);
    });
    const plus = row?.parentElement?.querySelector('svg');
    if (plus) plus.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(500);
}

async function openAcademyDelete(page) {
  await page.getByText('NR-1 Prova').first().waitFor({ timeout: 12_000 }).catch(() => {});
  const del = page.locator('button[title="Excluir"], button[title*="xcluir"]').first();
  if (await del.count()) await del.click();
  await page.getByText(/Excluir Curso/i).first().waitFor({ timeout: 6_000 }).catch(() => {});
  await page.waitForTimeout(400);
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
    const visible = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width < 8 || r.height < 8) return null;
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return null;
      const hidden = el.closest('.md\\:hidden, .lg\\:hidden, .sm\\:hidden');
      if (hidden) {
        const hs = getComputedStyle(hidden);
        if (hs.display === 'none' || hs.visibility === 'hidden') return null;
      }
      return el;
    };
    const first = (sel) => visible(document.querySelector(sel));
    const firstAny = (sel) => [...document.querySelectorAll(sel)].find((el) => visible(el));
    const byText = (tag, re) =>
      [...document.querySelectorAll(tag)].find((n) => visible(n) && re.test(n.textContent || ''));
    const keep = (b) => (b && b.w >= 0.5 && b.h >= 0.5 ? b : null);
    const notOverlay = (b) => {
      const k = keep(b);
      if (!k) return null;
      if (k.w >= window.innerWidth - 2 && k.h >= window.innerHeight - 2) return null;
      return k;
    };

    const newsTitle = byText('h1', /Editor do ABZ News/i);
    const academyTitle = byText('h3,h1,h2', /Excluir Curso/i);
    const chatTitle = byText('h3,h2', /Criar Servidor|Iniciar|Nova conversa/i);
    const searchPanelEl = firstAny('[data-modal-panel]');
    const searchInput = firstAny('input[placeholder*="buscar" i], input[placeholder*="Buscar" i]');
    const closeBtn = [...document.querySelectorAll('button[aria-label="Fechar"], [data-modal-close]')].find((el) => visible(el));
    const panelEl =
      searchPanelEl ||
      newsTitle?.closest('[data-modal-panel], .fixed') ||
      academyTitle?.closest('[data-modal-panel], .bg-white') ||
      chatTitle?.closest('[data-modal-panel], [class*="rounded"]');

    return {
      header: keep(box(first('header'))),
      sidebar: keep(box(first('aside'))),
      main: keep(box(first('[data-portal-main], main'))),
      loginCard: keep(box(first('form') || first('input[type="password"]')?.closest('div'))),
      loginTitle: keep(box(first('h1'))),
      newsTitle: keep(box(newsTitle)),
      newsFechar: keep(box(byText('button', /^Fechar$/i))),
      academyTitle: keep(box(academyTitle)),
      academyCancel: keep(box(byText('button', /^Cancelar$/i))),
      academyOk: keep(box(byText('button', /Sim, excluir|Excluir/i))),
      chatTitle: keep(box(chatTitle)),
      chatCancel: keep(box(byText('button', /^Cancelar$/i))),
      searchPanel: notOverlay(box(searchPanelEl || (searchInput && searchInput.closest('[data-modal-panel]')))),
      modalPanel: notOverlay(box(panelEl)),
      modalClose: keep(box(closeBtn)),
      fabHelp: keep(box(first('[data-help-trigger], [data-fab-help], [aria-label="Ajuda"]'))),
      fabCompanion: keep(box(first('[aria-label="Abrir Companion ABZ"], [data-fab-companion]'))),
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

async function runSide(baseUrl, outDir, viewport) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = {};
  const shots = {};
  const surfaces = SURFACES[MODULE] || [];

  for (const [name, path, extra, opts] of surfaces) {
    const ctx = await browser.newContext({ viewport, locale: 'pt-BR' });
    const page = await ctx.newPage();
    await attachMocks(page, { authed: opts?.authed !== false });
    results[name] = await capturePage(page, baseUrl, path, extra);
    const shot = join(outDir, `${name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    shots[name] = shot;
    await ctx.close();
  }

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

function visFn() {
  return [...document.querySelectorAll('[data-modal-panel], .fixed.inset-0, [role=dialog]')].filter((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (r.width < 8 || r.height < 8) return false;
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    const parent = el.closest('.md\\:hidden, .lg\\:hidden');
    if (parent) {
      const ps = getComputedStyle(parent);
      if (ps.display === 'none' || ps.visibility === 'hidden') return false;
    }
    return true;
  }).length;
}

if (process.env.MODE === 'mobile-esc') {
  const headUrl = process.env.HEAD_URL;
  const browser = await chromium.launch({ headless: true });
  const out = { module: MODULE, viewports: {} };
  for (const viewport of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport,
      locale: 'pt-BR',
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await attachMocks(page, { authed: true });
    const rec = {};
    if (MODULE === 'news') {
      await page.goto(`${headUrl}/noticias`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await settle(page);
      await openNewsFullscreen(page);
      const close = await page.evaluate(() => {
        const el = document.querySelector('[data-modal-close]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, display: getComputedStyle(el).display };
      });
      const before = await page.evaluate(visFn);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      rec.news = { close, before, after: await page.evaluate(visFn) };
    }
    if (MODULE === 'globalsearch') {
      await page.goto(`${headUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await settle(page);
      const trigger = page.locator('[data-global-search-trigger]').first();
      if (await trigger.count()) await trigger.click();
      else await page.keyboard.press('Control+k');
      await page.waitForTimeout(400);
      const close = await page.evaluate(() => {
        const el = document.querySelector('[data-modal-close]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      const before = await page.evaluate(visFn);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      rec.search = { close, before, after: await page.evaluate(visFn) };
    }
    if (MODULE === 'chat') {
      await page.goto(`${headUrl}/chat`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await settle(page);
      await openCreateServer(page);
      const close = await page.evaluate(() => {
        const el = document.querySelector('[data-modal-close]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      const textBefore = await page.evaluate(() => document.body.innerText);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const textAfter = await page.evaluate(() => document.body.innerText);
      rec.chat = {
        close,
        formGone: /Nome do Servidor/i.test(textBefore) && !/Nome do Servidor/i.test(textAfter),
      };
    }
    if (MODULE === 'academy') {
      await page.goto(`${headUrl}/academy/editor`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await settle(page);
      await openAcademyDelete(page);
      const close = await page.evaluate(() => {
        const el = document.querySelector('[data-modal-close]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      const before = await page.evaluate(visFn);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      rec.academy = { close, before, after: await page.evaluate(visFn) };
    }
    out.viewports[`${viewport.width}x${viewport.height}`] = rec;
    await ctx.close();
  }
  mkdirSync(DOCS, { recursive: true });
  writeFileSync(join(DOCS, 'mobile-esc.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(0);
}

if (!BEFORE_URL || !AFTER_URL) {
  console.error('BEFORE_URL e AFTER_URL obrigatórios');
  process.exit(2);
}

mkdirSync(DOCS, { recursive: true });
const pair = process.env.PAIR || `p1-${MODULE}-same-path`;
const table = [];
const summary = { pair, module: MODULE, viewports: VIEWPORTS, pages: {} };

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
      body_base: before.results[name]?.body,
      body_head: after.results[name]?.body,
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
