/**
 * Diff dos CSS do build de produção: remove só @media (max-width: 767px)
 * e compara o resto. Prova que seletores novos não vazam para desktop.
 *
 * Uso:
 *   BEFORE_CSS=/tmp/mui-a-before/.next/static/css \
 *   AFTER_CSS=/tmp/mui-a-after/.next/static/css \
 *   node scripts/mobile-ui-css-diff.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function collectCss(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.css')).sort();
  return files.map((f) => ({ name: f, css: readFileSync(join(dir, f), 'utf8') }));
}

function stripMedia767(css) {
  const needle = '@media (max-width: 767px)';
  let out = '';
  let i = 0;
  while (i < css.length) {
    const idx = css.indexOf(needle, i);
    if (idx < 0) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, idx);
    let j = idx + needle.length;
    while (j < css.length && /\s/.test(css[j])) j += 1;
    if (css[j] !== '{') {
      out += css.slice(idx, j);
      i = j;
      continue;
    }
    let depth = 0;
    let k = j;
    for (; k < css.length; k += 1) {
      if (css[k] === '{') depth += 1;
      else if (css[k] === '}') {
        depth -= 1;
        if (depth === 0) {
          k += 1;
          break;
        }
      }
    }
    i = k;
  }
  return out.replace(/\n{3,}/g, '\n\n');
}

function selectorsOutside(css) {
  const before = css.split('@media (max-width: 767px)')[0] || css;
  const wanted = [
    '[data-modal-close]',
    '[data-modal-panel]',
    '[data-gt-kpi-cards]',
    '[data-portal-main]',
    '[data-fab-companion]',
    '[data-fab-help]',
    '[data-fab-companion-panel]',
    '[data-fab-companion-action]',
  ];
  return wanted.filter((sel) => before.includes(sel));
}

const beforeDir = process.env.BEFORE_CSS;
const afterDir = process.env.AFTER_CSS;
if (!beforeDir || !afterDir) {
  console.error('BEFORE_CSS e AFTER_CSS obrigatórios');
  process.exit(2);
}

const beforeFiles = collectCss(beforeDir);
const afterFiles = collectCss(afterDir);
const beforeAll = beforeFiles.map((f) => f.css).join('\n');
const afterAll = afterFiles.map((f) => f.css).join('\n');
const beforeStripped = stripMedia767(beforeAll);
const afterStripped = stripMedia767(afterAll);
const leaked = selectorsOutside(afterAll);

const outDir = process.env.CSS_DIFF_OUT || '/tmp/mui-css-diff';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'before.stripped.css'), beforeStripped);
writeFileSync(join(outDir, 'after.stripped.css'), afterStripped);

const identical = beforeStripped === afterStripped;
const report = {
  identical,
  leakedOutside767: leaked,
  beforeBytes: beforeAll.length,
  afterBytes: afterAll.length,
  beforeStrippedBytes: beforeStripped.length,
  afterStrippedBytes: afterStripped.length,
  beforeFiles: beforeFiles.map((f) => f.name),
  afterFiles: afterFiles.map((f) => f.name),
  deltaBytes: afterStripped.length - beforeStripped.length,
};

writeFileSync(join(outDir, 'css-diff.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!identical || leaked.length) process.exitCode = 1;
