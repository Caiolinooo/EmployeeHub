/**
 * Provas 390×844 / 375×812 — GT + modais + módulos prioritários.
 * Rede mockada (HTML local). Sem banco, sem secrets.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/mobile-audit/fix-mobile-ui');
mkdirSync(OUT, { recursive: true });

const TAILWIND = 'https://cdn.tailwindcss.com';

const MODAL_CSS = `
@media (max-width: 767px) {
  [data-modal-close] {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  [data-modal-panel] {
    max-height: 100dvh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
`;

const PEOPLE = [
  { nome: 'Ana Souza', cargo: 'Marinheiro', status: 'Embarcado', empresa: 'ABZ Offshore' },
  { nome: 'Bruno Lima', cargo: 'Eletricista', status: 'Folga', empresa: 'ABZ Offshore' },
  { nome: 'Carla Nunes', cargo: 'Cozinheira', status: 'StandBy', empresa: 'ABZ Serviços' },
  { nome: 'Diego Alves', cargo: 'Oficial', status: 'Afastado', empresa: 'ABZ Offshore' },
];

function matrixRows() {
  return PEOPLE.map(
    (p) => `<tr class="border-b">
      <td class="px-3 py-2 whitespace-nowrap font-medium">${p.nome}</td>
      <td class="px-3 py-2 whitespace-nowrap">${p.cargo}</td>
      <td class="px-3 py-2 whitespace-nowrap">${p.empresa}</td>
      <td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full text-xs border">${p.status}</span></td>
    </tr>`,
  ).join('');
}

function scheduleGrid() {
  const days = Array.from({ length: 14 }, (_, i) => `0${i + 1}`.slice(-2));
  const head = days.map((d) => `<th class="sticky top-0 bg-white border px-2 py-1 text-[10px]">${d}/09</th>`).join('');
  const rows = PEOPLE.map((p, r) => {
    const cells = days
      .map((_, c) => {
        const code = (r + c) % 5 === 0 ? 'ON' : (r + c) % 5 === 1 ? 'OFF' : 'STB';
        const bg = code === 'ON' ? 'bg-green-200' : code === 'OFF' ? 'bg-slate-100' : 'bg-amber-100';
        return `<td class="border w-8 h-8 text-center ${bg}">${code}</td>`;
      })
      .join('');
    return `<tr><td class="sticky left-0 bg-white border px-2 py-1 font-medium whitespace-nowrap">${p.nome}</td>${cells}</tr>`;
  }).join('');
  return `<table class="w-max min-w-full border-separate border-spacing-0 text-xs">
    <thead><tr><th class="sticky top-0 left-0 z-50 bg-white border px-2 py-1">NOME</th>${head}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function pageShell({ title, tabs, filters, body, after }) {
  const tabClass = after
    ? 'flex flex-nowrap space-x-4 -mb-px min-w-max pb-0.5'
    : 'flex space-x-4 -mb-px';
  const tablist = after
    ? 'border-b border-gray-200 shrink-0 overflow-x-auto'
    : 'border-b border-gray-200 shrink-0 overflow-hidden';
  const bodyWrap = after
    ? 'flex flex-col flex-1 min-h-0 min-w-0 gap-3 max-lg:overflow-visible'
    : 'flex flex-col flex-1 min-h-0 min-w-0 gap-3 overflow-hidden';
  const listClass = after
    ? 'flex-1 min-h-0 min-w-0 overflow-auto min-h-[320px] max-lg:flex-none max-lg:min-h-[50vh]'
    : 'flex-1 min-h-0 min-w-0 overflow-hidden';
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <script src="${TAILWIND}"></script>
    <style>html,body{height:100%;margin:0} ${MODAL_CSS}</style>
  </head><body class="h-[100dvh] overflow-hidden bg-gray-100">
    <div class="flex flex-col h-full">
      <header class="shrink-0 bg-white border-b px-3 py-2 font-bold text-sm">Portal ABZ · ${title}</header>
      <main class="flex flex-col flex-1 min-h-0 px-3 py-3 overflow-hidden">
        <div class="flex flex-col flex-1 min-h-0 min-w-0 overflow-y-auto lg:overflow-hidden">
          <div class="${tablist}">
            <nav class="${tabClass}">
              ${tabs}
            </nav>
          </div>
          <div class="${bodyWrap}">
            ${filters}
            <div id="scrollport" class="${listClass}">${body}</div>
          </div>
        </div>
      </main>
    </div>
  </body></html>`;
}

const TABS = `
  <button class="pb-3 text-sm font-bold border-b-2 border-blue-600 shrink-0 whitespace-nowrap">Matriz</button>
  <button class="pb-3 text-sm font-bold border-b-2 border-transparent shrink-0 whitespace-nowrap">ASO logística</button>
  <button class="pb-3 text-sm font-bold border-b-2 border-transparent shrink-0 whitespace-nowrap">Escala</button>
  <button class="pb-3 text-sm font-bold border-b-2 border-transparent shrink-0 whitespace-nowrap">Histórico de edições</button>
  <button class="pb-3 text-sm font-bold border-b-2 border-transparent shrink-0 whitespace-nowrap">Matriz de treinamentos</button>
`;

const FILTERS = `
  <div class="shrink-0 space-y-2">
    <div class="grid grid-cols-1 gap-2">
      <input class="border rounded px-2 py-2 text-sm" value="Buscar colaborador..." readonly/>
      <select class="border rounded px-2 py-2 text-sm"><option>Todas as empresas</option></select>
      <select class="border rounded px-2 py-2 text-sm"><option>Todos os cargos</option></select>
      <select class="border rounded px-2 py-2 text-sm"><option>Todos os centros de custo</option></select>
      <select class="border rounded px-2 py-2 text-sm"><option>Todos os status</option></select>
    </div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-white border rounded p-3">Total 128</div>
      <div class="bg-white border rounded p-3">Embarcados 54</div>
      <div class="bg-white border rounded p-3">Disponíveis 41</div>
      <div class="bg-white border rounded p-3">Docs vencidos 11</div>
      <div class="bg-white border rounded p-3">Docs vencendo 7</div>
      <div class="bg-white border rounded p-3">ASO pendente 3</div>
    </div>
    <div class="h-40 bg-white border rounded p-3 text-xs text-gray-500">Marcados / ações em lote (barra extra no mobile)</div>
  </div>
`;

function languageDialog({ after }) {
  const close = after
    ? `<button type="button" data-modal-close="" aria-label="Fechar" class="absolute right-1 top-1 inline-flex items-center justify-center rounded-lg text-gray-500">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
       </button>`
    : '';
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <script src="${TAILWIND}"></script>
    <style>${MODAL_CSS}</style>
  </head><body class="min-h-[100dvh] bg-gray-200">
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div data-modal-panel="" class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        ${close}
        <h2 class="text-2xl font-semibold text-center mb-2">Choose Your Language</h2>
        <p class="text-gray-600 text-center mb-6">Escolha seu idioma</p>
        <button class="w-full text-left px-4 py-3 rounded-md border mb-2">🇧🇷 Português</button>
        <button class="w-full text-left px-4 py-3 rounded-md border mb-4">🇺🇸 English</button>
        <div class="flex justify-center"><button class="px-6 py-2 bg-blue-600 text-white rounded-md">Continue</button></div>
      </div>
    </div>
  </body></html>`;
}

function confirmationModal({ after }) {
  const close = after
    ? `<div class="absolute right-2 top-2">
         <button type="button" data-modal-close="" aria-label="Fechar" class="inline-flex items-center justify-center rounded-lg text-white/70">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
         </button>
       </div>`
    : '';
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <script src="${TAILWIND}"></script>
    <style>${MODAL_CSS}</style>
  </head><body class="min-h-[100dvh] bg-gray-200">
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60"></div>
      <div data-modal-panel="" class="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#1A1A1A] border border-white/10 shadow-2xl">
        ${close}
        <div class="p-6">
          <h3 class="text-xl font-semibold text-white mb-2">Excluir marcação</h3>
          <p class="text-gray-400 mb-6">Confirma a exclusão deste período na escala?</p>
          <div class="flex justify-end gap-3">
            <button class="px-4 py-2 rounded-lg bg-white/5 text-white">Cancelar</button>
            <button class="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  </body></html>`;
}

function simpleModule(title, body) {
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <script src="${TAILWIND}"></script>
  </head><body class="min-h-[100dvh] bg-gray-50">
    <header class="bg-white border-b px-3 py-3 font-bold">${title}</header>
    <main class="px-3 py-3">${body}</main>
  </body></html>`;
}

async function shot(page, name, html, size) {
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const file = join(OUT, `${name}-${size.width}x${size.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function measureScrollport(page, html, size) {
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const el = document.getElementById('scrollport');
    const r = el.getBoundingClientRect();
    const first = el.querySelector('td, [data-row]');
    return {
      height: Math.round(r.height),
      width: Math.round(r.width),
      visible: r.height > 40 && r.width > 40,
      hasRows: !!first,
      rowVisible: first ? first.getBoundingClientRect().height > 0 : false,
    };
  });
}

async function measureClose(page, html, size) {
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const btn = document.querySelector('[data-modal-close]');
    if (!btn) return { has: false };
    const r = btn.getBoundingClientRect();
    return { has: true, w: Math.round(r.width), h: Math.round(r.height), visible: r.width >= 44 && r.height >= 44 };
  });
}

const SIZE_390 = { width: 390, height: 844 };
const SIZE_375 = { width: 375, height: 812 };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const matrixBefore = pageShell({
  title: 'GT Matriz (antes)',
  tabs: TABS,
  filters: FILTERS,
  body: `<table class="min-w-[720px] w-full text-sm"><thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left">Nome</th><th class="px-3 py-2">Cargo</th><th class="px-3 py-2">Empresa</th><th class="px-3 py-2">Status</th></tr></thead><tbody>${matrixRows()}</tbody></table>`,
  after: false,
});
const matrixAfter = pageShell({
  title: 'GT Matriz (depois)',
  tabs: TABS,
  filters: FILTERS,
  body: `<table class="min-w-[720px] w-full text-sm"><thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left">Nome</th><th class="px-3 py-2">Cargo</th><th class="px-3 py-2">Empresa</th><th class="px-3 py-2">Status</th></tr></thead><tbody>${matrixRows()}</tbody></table>`,
  after: true,
});
const scheduleBefore = pageShell({
  title: 'GT Escala (antes)',
  tabs: TABS,
  filters: FILTERS,
  body: scheduleGrid(),
  after: false,
});
const scheduleAfter = pageShell({
  title: 'GT Escala (depois)',
  tabs: TABS,
  filters: FILTERS,
  body: scheduleGrid(),
  after: true,
});

const report = {
  matrix390_before: await measureScrollport(page, matrixBefore, SIZE_390),
  matrix390_after: await measureScrollport(page, matrixAfter, SIZE_390),
  schedule390_before: await measureScrollport(page, scheduleBefore, SIZE_390),
  schedule390_after: await measureScrollport(page, scheduleAfter, SIZE_390),
  lang_before: await measureClose(page, languageDialog({ after: false }), SIZE_390),
  lang_after: await measureClose(page, languageDialog({ after: true }), SIZE_390),
  confirm_after: await measureClose(page, confirmationModal({ after: true }), SIZE_390),
};

const shots = [];
for (const size of [SIZE_390, SIZE_375]) {
  shots.push(await shot(page, 'gt-matriz-antes', matrixBefore, size));
  shots.push(await shot(page, 'gt-matriz-depois', matrixAfter, size));
  shots.push(await shot(page, 'gt-escala-antes', scheduleBefore, size));
  shots.push(await shot(page, 'gt-escala-depois', scheduleAfter, size));
  shots.push(await shot(page, 'gt-abas', pageShell({ title: 'GT abas', tabs: TABS, filters: '', body: '<p class="p-4">Abas com swipe</p>', after: true }), size));
  shots.push(await shot(page, 'modal-language-antes', languageDialog({ after: false }), size));
  shots.push(await shot(page, 'modal-language-depois', languageDialog({ after: true }), size));
  shots.push(await shot(page, 'modal-confirmacao-depois', confirmationModal({ after: true }), size));
  shots.push(await shot(page, 'dashboard', simpleModule('Dashboard', `<div class="bg-gradient-to-r from-white via-blue-50 to-blue-100 rounded-2xl p-5 min-h-[200px]"><h1 class="text-2xl font-bold">Olá, Ana</h1><p class="text-gray-500">Bem-vindo ao Portal ABZ</p></div><div class="grid gap-3 mt-4"><div class="bg-white border rounded-xl p-4 min-h-[88px]">Pendências</div><div class="bg-white border rounded-xl p-4 min-h-[88px]">Atalhos</div></div>`), size));
  shots.push(await shot(page, 'noticias', simpleModule('ABZ News', `<div class="flex gap-2 overflow-x-auto mb-4"><button class="min-h-11 px-4 rounded-full bg-black text-white">Todos</button><button class="min-h-11 px-4 rounded-full bg-gray-100">Destaques</button></div><article class="bg-white rounded-xl border p-4">Comunicado interno — dados mockados</article>`), size));
  shots.push(await shot(page, 'ferias', simpleModule('Férias', `<div class="bg-white border rounded-xl max-lg:min-h-[40vh] overflow-x-auto"><table class="min-w-[640px] text-sm"><thead><tr class="bg-gray-50"><th class="p-2">Período</th><th class="p-2">Status</th><th class="p-2">Dias</th></tr></thead><tbody><tr><td class="p-2">01/10–14/10/2026</td><td class="p-2">Aprovado</td><td class="p-2">14</td></tr></tbody></table></div>`), size));
  shots.push(await shot(page, 'reembolso', simpleModule('Reembolso', `<div class="bg-white rounded-lg shadow p-4 min-h-[40vh]"><p class="font-semibold mb-2">Protocolo RE-1042</p><p>Almoço operacional — R$ 87,40</p></div>`), size));
  shots.push(await shot(page, 'contracheque', simpleModule('Contracheque', `<div class="bg-white border rounded-xl p-4 space-y-2"><p>09/2026 — ABZ Offshore</p><button class="min-h-11 px-3 rounded-lg bg-blue-600 text-white">Ver</button></div>`), size));
  shots.push(await shot(page, 'ponto', simpleModule('Ponto', `<a class="inline-flex items-center px-3 py-1.5 min-h-11 bg-gray-100 rounded-md text-xs">App Store</a> <a class="inline-flex items-center px-3 py-1.5 min-h-11 bg-gray-100 rounded-md text-xs">Google Play</a>`), size));
}

await browser.close();

writeFileSync(join(OUT, 'proof-metrics.json'), JSON.stringify({ report, shots }, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('shots', shots.length);

if (!report.matrix390_after.visible || !report.schedule390_after.visible) {
  process.exitCode = 1;
}
if (!report.lang_after.visible || !report.confirm_after.visible) {
  process.exitCode = 1;
}
