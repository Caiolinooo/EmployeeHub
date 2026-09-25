/**
 * Prova 1440×900 em build de produção: sessão + APIs mockadas no Playwright
 * (page.route). Sem bypass no código, sem banco, sem secrets.
 *
 * Uso:
 *   BEFORE_URL=http://127.0.0.1:3001 AFTER_URL=http://127.0.0.1:3002 \
 *   node scripts/mobile-ui-auth-proof.mjs
 *
 * Pastas irmãs: /tmp/mui-1440-before e /tmp/mui-1440-after
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs/mobile-audit/fix-mobile-ui');
const BEFORE_DIR = process.env.BEFORE_DIR || '/tmp/mui-1440-before';
const AFTER_DIR = process.env.AFTER_DIR || '/tmp/mui-1440-after';
const BEFORE_URL = process.env.BEFORE_URL;
const AFTER_URL = process.env.AFTER_URL;
const VIEWPORT = { width: 1440, height: 900 };

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

function mockApi(urlString) {
  const url = new URL(urlString);
  const p = url.pathname;

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
  if (p.includes('/api/i18n')) {
    return json({ data: [] });
  }
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
  if (p.includes('/api/gestao-tripulantes/dashboard')) {
    return json({ success: true, data: DASHBOARD });
  }
  if (p.includes('/api/gestao-tripulantes/live-probe')) {
    return json({ success: true, assinatura: 'proof-1', updatedAt: '2026-09-25T00:00:00.000Z' });
  }
  if (p.includes(`/api/gestao-tripulantes/colaboradores/${COLAB_ID}/desligamento`)) {
    return json({ success: true, data: null });
  }
  if (p.includes(`/api/gestao-tripulantes/colaboradores/${COLAB_ID}`)) {
    return json({ success: true, data: COLAB });
  }
  if (p.includes('/api/gestao-tripulantes/colaboradores')) {
    return json({ success: true, data: [COLAB] });
  }
  if (p.includes('/api/gestao-tripulantes/tipos-evento')) {
    return json({ success: true, data: [] });
  }
  if (p.includes('/api/gestao-tripulantes/matrizes')) {
    return json({ success: true, data: [] });
  }
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
  if (p.includes('/api/cards')) return json([]);
  if (p.includes('/api/purchase-orders')) return json({ success: true, data: [] });
  if (p.includes('/api/dashboard/pendencies')) return json({ emails_nao_lidos: 0, ferias_pendentes: 0, reembolsos_pendentes: 0 });
  if (p.includes('/api/ia/')) return json({ success: true, sessionId: 'proof', messages: [] });
  if (p.includes('/api/notifications')) return json({ success: true, data: [] });
  if (p.includes('/api/')) {
    return json({ success: true, data: [], items: [], requests: [], posts: [] });
  }

  if (p.includes('/rest/v1/users_unified')) return json(USER);
  if (p.includes('/rest/v1/')) return json([]);
  if (p.includes('/auth/v1/')) return json({ access_token: null, token_type: 'bearer' });

  return null;
}

const CONFIRM_HTML = `
<div id="proof-confirmation-modal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
  <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
  <div data-modal-panel="" class="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#1A1A1A] border border-white/10 shadow-2xl">
    <div class="p-6">
      <h3 class="text-xl font-semibold text-white mb-2">Excluir marcação</h3>
      <p class="text-gray-400 mb-6">Confirma a exclusão deste período na escala?</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="px-4 py-2 rounded-lg bg-white/5 text-white">Cancelar</button>
        <button type="button" class="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">Confirmar</button>
      </div>
    </div>
  </div>
</div>`;

async function attachMocks(page, { showLanguage }) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ token, showLanguage: showLang }) => {
      localStorage.setItem('abzToken', token);
      localStorage.setItem('token', token);
      localStorage.setItem('main-sidebar-collapsed', 'true');
      localStorage.setItem('sidebar-meurh-open', 'false');
      localStorage.setItem('sidebar-dept-open', 'false');
      if (showLang) localStorage.removeItem('languageDialogShown');
      else localStorage.setItem('languageDialogShown', 'true');
    },
    { token: FAKE_JWT, showLanguage },
  );
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/_next/') || url.includes('/images/') || url.includes('/fonts/') || url.includes('/rive/')) {
      return route.continue();
    }
    const mocked = mockApi(url);
    if (mocked) return route.fulfill(mocked);
    return route.continue();
  });
}

async function settle(page) {
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}[data-help-trigger],[data-fab-companion],[data-fab-help],[aria-label="Abrir Companion ABZ"]{visibility:hidden!important}',
  });
  await page.waitForTimeout(400);
}

async function shotPage(page, baseUrl, path, outFile, extra) {
  const errors = [];
  page.once('pageerror', (err) => errors.push(String(err)));
  const url = new URL(path, baseUrl).toString();
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settle(page);
  if (extra) await extra(page);
  await page.screenshot({ path: outFile, fullPage: false });
  const info = await page.evaluate(() => ({
    href: location.href,
    title: document.title,
    hasMain: !!document.querySelector('[data-portal-main], main'),
    hasLogin: !!document.querySelector('input[type="password"], form[action*="login"]'),
    hasLanguage: !!document.querySelector('[data-modal-panel]') && /idioma|language|Choose Your Language/i.test(document.body.innerText),
    hasConfirm: !!document.getElementById('proof-confirmation-modal'),
    hasKpi: !!document.querySelector('[data-gt-kpi-cards]'),
    hasTablist: !!document.querySelector('[data-testid="collaborator-modal-tablist"]'),
    bodyText: document.body.innerText.slice(0, 240),
  }));
  return { status: resp?.status() ?? 0, ...info, errors, file: outFile };
}

async function runSide(baseUrl, outDir, label) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = {};

  const pages = [
    ['dashboard', '/dashboard'],
    ['gt-matriz', '/department/gestao-tripulantes'],
    ['gt-escala', '/department/gestao-tripulantes?tab=schedule'],
    ['ferias', '/ferias'],
    ['reembolso', '/reembolso'],
    ['noticias', '/noticias'],
    ['ponto', '/ponto'],
    ['contracheque', '/contracheque'],
  ];

  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'pt-BR' });
  const page = await ctx.newPage();
  await attachMocks(page, { showLanguage: false });

  for (const [name, path] of pages) {
    results[name] = await shotPage(page, baseUrl, path, join(outDir, `${name}.png`));
  }

  results.ficha = await shotPage(
    page,
    baseUrl,
    '/department/gestao-tripulantes',
    join(outDir, 'ficha.png'),
    async (p) => {
        const row = p.getByText('Ana Souza').first();
        if (await row.count()) {
          await row.click({ timeout: 8_000 }).catch(() => {});
          await p.waitForTimeout(800);
          const qhse = p.locator('[data-tab-key="qhse"]');
          if (await qhse.count()) await qhse.click({ timeout: 4_000 }).catch(() => {});
          await p.waitForTimeout(600);
        }
    },
  );

  results.language = await (async () => {
    const ctx2 = await browser.newContext({ viewport: VIEWPORT, locale: 'pt-BR' });
    const p2 = await ctx2.newPage();
    await attachMocks(p2, { showLanguage: true });
    const info = await shotPage(p2, baseUrl, '/dashboard', join(outDir, 'language.png'), async (pg) => {
      await pg.waitForTimeout(1400);
    });
    await ctx2.close();
    return info;
  })();

  results.confirm = await shotPage(
    page,
    baseUrl,
    '/dashboard',
    join(outDir, 'confirm.png'),
    async (p) => {
      await p.evaluate((html) => {
        document.getElementById('proof-confirmation-modal')?.remove();
        document.body.insertAdjacentHTML('beforeend', html);
      }, CONFIRM_HTML);
      await p.waitForTimeout(200);
    },
  );

  await ctx.close();
  await browser.close();
  writeFileSync(join(outDir, `${label}-info.json`), JSON.stringify(results, null, 2));
  return results;
}

async function diffPng(aPath, bPath) {
  if (!existsSync(aPath) || !existsSync(bPath)) return { px: -1, reason: 'missing' };
  const a = sharp(readFileSync(aPath)).ensureAlpha();
  const b = sharp(readFileSync(bPath)).ensureAlpha();
  const [am, bm] = await Promise.all([a.metadata(), b.metadata()]);
  if (am.width !== bm.width || am.height !== bm.height) {
    return { px: (am.width || 0) * (am.height || 0), reason: `size ${am.width}x${am.height} vs ${bm.width}x${bm.height}` };
  }
  const [ar, br] = await Promise.all([a.raw().toBuffer(), b.raw().toBuffer()]);
  let px = 0;
  for (let i = 0; i < ar.length; i += 4) {
    if (ar[i] !== br[i] || ar[i + 1] !== br[i + 1] || ar[i + 2] !== br[i + 2] || ar[i + 3] !== br[i + 3]) px += 1;
  }
  return { px };
}

if (!BEFORE_URL || !AFTER_URL) {
  console.error('BEFORE_URL e AFTER_URL obrigatórios');
  process.exit(2);
}

mkdirSync(BEFORE_DIR, { recursive: true });
mkdirSync(AFTER_DIR, { recursive: true });

const before = await runSide(BEFORE_URL, BEFORE_DIR, 'before');
const after = await runSide(AFTER_URL, AFTER_DIR, 'after');

const names = Object.keys(after);
const table = {};
for (const name of names) {
  const diff = await diffPng(join(BEFORE_DIR, `${name}.png`), join(AFTER_DIR, `${name}.png`));
  table[name] = {
    px: diff.px,
    reason: diff.reason || null,
    beforeHref: before[name]?.href,
    afterHref: after[name]?.href,
    beforeLogin: before[name]?.hasLogin,
    afterLogin: after[name]?.hasLogin,
    afterHasMain: after[name]?.hasMain,
  };
}

const out = { viewport: VIEWPORT, beforeDir: BEFORE_DIR, afterDir: AFTER_DIR, table, before, after };
writeFileSync(join(DOCS, 'auth-1440-metrics.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(table, null, 2));
const failed = Object.entries(table).filter(([, v]) => v.px !== 0);
if (failed.length) {
  console.error('nonzero', failed.map(([k, v]) => `${k}:${v.px}`).join(' '));
  process.exitCode = 1;
}
