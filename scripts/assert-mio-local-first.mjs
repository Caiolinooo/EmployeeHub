/**
 * Assert MIO local-first contracts without calling mio.app.br.
 * Run: node scripts/assert-mio-local-first.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const ok = [];

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === '.next' || name.name === 'scratch') continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|mjs)$/.test(name.name)) acc.push(p);
  }
  return acc;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

const APP = path.join(ROOT, 'src', 'app');
const COMP = path.join(ROOT, 'src', 'components');
const allowRuntimeMio = [
  'src/app/api/mio/test/',
  'src/app/api/mio/sync/',
  'src/app/api/mio/cache/atualizar/',
  'src/app/api/gestao-tripulantes/cron/sync-mio/',
  'src/app/api/gestao-tripulantes/mio-auditoria/',
  'src/app/api/gestao-tripulantes/mio/sync/',
  'src/app/admin/mio/',
  'src/app/admin/integracao-erp/',
];

function isAllowed(file) {
  const r = rel(file);
  return allowRuntimeMio.some((a) => r.startsWith(a) || r.includes(a));
}

for (const base of [APP, COMP]) {
  if (!fs.existsSync(base)) continue;
  for (const file of walk(base)) {
    const text = fs.readFileSync(file, 'utf8');
    if (!/from ['"]@\/lib\/mio\/client['"]|mioClient\./.test(text)) continue;
    if (isAllowed(file)) {
      ok.push(`allowlisted mioClient: ${rel(file)}`);
      continue;
    }
    failures.push(`runtime mioClient in ${rel(file)}`);
  }
}

const client = fs.readFileSync(path.join(ROOT, 'src/lib/mio/client.ts'), 'utf8');
if (!/Forbidden write blocked/.test(client) || !/async put/.test(client)) {
  failures.push('mio client put() must exist and block writes');
} else {
  ok.push('client.put blocks writes');
}
if (!/assertMioPullContext/.test(client)) {
  failures.push('client must assert pull context');
} else {
  ok.push('client asserts pull context');
}

const sync = fs.readFileSync(path.join(ROOT, 'src/lib/gestao-tripulantes/mio-sync.ts'), 'utf8');
if (/int-integrante-add|int-integrante-upd/.test(sync)) {
  failures.push('mio-sync still contains write-to-MIO endpoints');
} else {
  ok.push('mio-sync has no MIO write endpoints');
}
if (!/Forbidden write blocked: syncToMIO/.test(sync)) {
  failures.push('syncToMIO must be a disabled no-op');
} else {
  ok.push('syncToMIO is no-op');
}
if (!/isMioIntegranteAtivo/.test(sync) || /ativo:\s*true/.test(sync) && !/isMioIntegranteAtivo/.test(sync)) {
  failures.push('inactive mapping missing');
} else {
  ok.push('inactive colaboradores mapped via isMioIntegranteAtivo');
}
if (!/findColaboradorByCpf/.test(sync)) {
  failures.push('training/embarque pull must include inactive via findColaboradorByCpf (no ativo filter)');
} else {
  ok.push('pull uses findColaboradorByCpf (includes inactive)');
}
if (/Soft-delete versão anterior do mesmo curso/.test(sync)) {
  failures.push('training history soft-delete still present');
} else {
  ok.push('training history is preserved');
}
if (!/baixarAnexoMioParaLocal/.test(sync)) {
  failures.push('file copy into local storage missing');
} else {
  ok.push('MIO files copied into local storage');
}

const cron = fs.readFileSync(path.join(ROOT, 'src/app/api/gestao-tripulantes/cron/sync-mio/route.ts'), 'utf8');
if (/syncToMIO\(/.test(cron)) {
  failures.push('cron still calls syncToMIO');
} else {
  ok.push('cron pull-only (no syncToMIO)');
}

const man = fs.readFileSync(path.join(ROOT, 'src/app/api/man-schedule/realtime/route.ts'), 'utf8');
if (/mioClient/.test(man)) {
  failures.push('Man Schedule still imports/calls mioClient');
} else {
  ok.push('Man Schedule does not call mioClient');
}
if (!/gt_historico_embarques/.test(man) || /from\('mio_cache'\)/.test(man)) {
  failures.push('Man Schedule must read gt_historico_embarques, not mio_cache blobs');
} else {
  ok.push('Man Schedule serves gt_historico_embarques');
}

console.log(ok.map((x) => 'OK  ' + x).join('\n'));
if (failures.length) {
  console.error(failures.map((x) => 'FAIL ' + x).join('\n'));
  process.exit(1);
}
console.log('ASSERT_MIO_LOCAL_FIRST_OK');
