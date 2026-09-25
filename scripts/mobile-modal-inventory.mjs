/**
 * Inventário de overlays (fixed inset-0) — sem rede, sem secrets.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'docs/mobile-audit/fix-mobile-ui');
mkdirSync(OUT, { recursive: true });

function walk(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      walk(p, acc);
    } else if (/\.(tsx|jsx)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const files = walk(SRC);
const rows = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!/fixed inset-0/.test(src)) continue;
  const rel = relative(ROOT, file);
  const hasX =
    /ModalCloseButton/.test(src) ||
    /data-modal-close/.test(src) ||
    /FiX/.test(src) ||
    /<FiX/.test(src) ||
    /aria-label=['"]Fechar/.test(src) ||
    /✕/.test(src);
  const hasEsc = /useEscapeToClose/.test(src) || /Escape/.test(src) || /keydown/.test(src);
  const outside =
    /onClick=\{onClose\}/.test(src) ||
    /onClick=\{handleClose\}/.test(src) ||
    /onClick=\{\(\) => setIsOpen\(false\)\}/.test(src) ||
    /backdrop/.test(src);
  const panel = /data-modal-panel/.test(src);
  const gate = /impedir que o usuário feche/.test(src);
  let status = 'pendente';
  if (gate) status = 'sem X de propósito (form obrigatório)';
  else if (hasX && hasEsc && panel) status = 'corrigido';
  else if (hasX && panel) status = 'X + painel; Esc pendente';
  else if (hasX) status = 'tinha X; chrome mobile parcial';
  else status = 'sem X visível';
  rows.push({
    modal: rel.split('/').pop().replace(/\.(tsx|jsx)$/, ''),
    arquivo: rel,
    tinhaX: hasX,
    esc: hasEsc,
    toqueFora: outside,
    panel,
    status,
  });
}

rows.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
writeFileSync(join(OUT, 'modals.json'), JSON.stringify(rows, null, 2));

const md = [
  '| modal | arquivo | tinha X? | Esc? | toque fora? | status |',
  '|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.modal} | \`${r.arquivo}\` | ${r.tinhaX ? 'sim' : 'não'} | ${r.esc ? 'sim' : 'não'} | ${r.toqueFora ? 'sim' : 'não'} | ${r.status} |`,
  ),
].join('\n');
writeFileSync(join(OUT, 'modals.md'), md);
console.log(`overlays=${rows.length}`);
console.log(
  JSON.stringify(
    {
      corrigido: rows.filter((r) => r.status === 'corrigido').length,
      semX: rows.filter((r) => r.status === 'sem X visível').length,
      proposito: rows.filter((r) => r.status.startsWith('sem X de propósito')).length,
      parcial: rows.filter((r) => r.status !== 'corrigido' && !r.status.startsWith('sem X de propósito') && r.status !== 'sem X visível').length,
    },
    null,
    2,
  ),
);
