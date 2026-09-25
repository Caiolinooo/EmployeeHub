import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FULL_COLAB_BY_CPF_SELECT,
  flattenFullColaboradorRow,
  GT_COLAB_VIEW_ALIASES,
  gtColabTableSelectIsSafe,
  stripGtColabViewAliases,
} from './gt-colab-view-aliases';

const SRC_ROOT = path.join(process.cwd(), 'src');

const SAFE_SELECT_IDENTS = new Set([
  'CATALOG_COLAB_SELECT',
  'FULL_COLAB_BY_CPF_SELECT',
  'LIST_SELECT',
  'PROFILE_SELECT',
  'COLAB_SELECT',
]);

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walkTsFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

function extractBalanced(source: string, openIndex: number): string | null {
  if (source[openIndex] !== '(') return null;
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

function unwrapSelectArg(raw: string): { kind: 'literal' | 'ident'; value: string } | null {
  const trimmed = raw.trim();
  const ident = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
  if (ident && !trimmed.startsWith("'") && !trimmed.startsWith('"') && !trimmed.startsWith('`')) {
    return { kind: 'ident', value: ident[1] };
  }
  if (trimmed.startsWith('`') || trimmed.startsWith("'") || trimmed.startsWith('"')) {
    const quote = trimmed[0];
    const end = trimmed.indexOf(quote, 1);
    if (end < 0) return null;
    return { kind: 'literal', value: trimmed.slice(1, end) };
  }
  return null;
}

function extractTableSelects(source: string): Array<{ kind: 'literal' | 'ident'; value: string }> {
  const found: Array<{ kind: 'literal' | 'ident'; value: string }> = [];
  const fromRe = /\.from\(\s*['"]gt_colaboradores['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = fromRe.exec(source))) {
    const window = source.slice(match.index, match.index + 800);
    const selectAt = window.search(/\.select\s*\(/);
    if (selectAt < 0) continue;
    const abs = match.index + selectAt + window.slice(selectAt).indexOf('(');
    const inner = extractBalanced(source, abs);
    if (!inner) continue;
    const parsed = unwrapSelectArg(inner);
    if (parsed) found.push(parsed);
  }
  return found;
}

function extractEmbedSelects(source: string): string[] {
  const found: string[] = [];
  const embedRe = /(?:colaborador:)?gt_colaboradores\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = embedRe.exec(source))) {
    const open = match.index + match[0].length - 1;
    const inner = extractBalanced(source, open);
    if (inner && inner.includes(':') || (inner && /[a-z_]/.test(inner))) {
      if (inner && !inner.includes('from(')) found.push(inner);
    }
  }
  return found;
}

describe('gt_colaboradores table vs view aliases', () => {
  it('rejects every view-only alias from gt_vw_colaboradores_completo', () => {
    assert.ok(GT_COLAB_VIEW_ALIASES.includes('cargo_nome'));
    assert.ok(GT_COLAB_VIEW_ALIASES.includes('empresa_cnpj'));
    assert.ok(GT_COLAB_VIEW_ALIASES.includes('embarcacao_imo'));
    assert.ok(GT_COLAB_VIEW_ALIASES.includes('user_email'));
    for (const alias of GT_COLAB_VIEW_ALIASES) {
      assert.equal(gtColabTableSelectIsSafe(`id, ${alias}`), false, alias);
    }
    assert.equal(gtColabTableSelectIsSafe('id, nome_completo, cargo:gt_cargos(nome)'), true);
  });

  it('keeps catalog + list + CPF selects safe', () => {
    const catalog = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/document-catalog/identity-match.ts'),
      'utf8'
    );
    const catalogSelect = catalog.match(/export const CATALOG_COLAB_SELECT =\s*'([^']+)'/)?.[1];
    assert.ok(catalogSelect);
    assert.equal(gtColabTableSelectIsSafe(catalogSelect), true);
    const listSelect = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/gestao-tripulantes/colaborador-get.ts'),
      'utf8'
    );
    const listMatch = listSelect.match(/export const LIST_SELECT = `\s*([\s\S]*?)`/);
    assert.ok(listMatch);
    assert.equal(gtColabTableSelectIsSafe(listMatch[1]), true);
    assert.equal(gtColabTableSelectIsSafe(FULL_COLAB_BY_CPF_SELECT), true);
    assert.equal(
      gtColabTableSelectIsSafe(
        'id, cpf, nome_completo, matricula, matricula_esocial, data_admissao, cargo_nome, funcao, cbo, cargo_cbo, empresa_cnpj, empresa_nome'
      ),
      false
    );
  });

  it('flattens cargo/empresa embeds for findFullColaboradorByCpf', () => {
    const flat = flattenFullColaboradorRow({
      id: 'c1',
      cpf: '12345678909',
      nome_completo: 'Ana Souza',
      matricula: '100',
      matricula_esocial: '100',
      data_admissao: '2024-01-01',
      cbo: '215105',
      cargo: { nome: 'Taifeiro' },
      empresa: { nome: 'ABZ', cnpj: '17784306000189' },
    });
    assert.equal(flat.cargo_nome, 'Taifeiro');
    assert.equal(flat.funcao, 'Taifeiro');
    assert.equal(flat.empresa_nome, 'ABZ');
    assert.equal(flat.empresa_cnpj, '17784306000189');
    assert.equal(flat.cargo_cbo, '215105');
    const fromArray = flattenFullColaboradorRow({
      id: 'c2',
      cargo: [{ nome: 'Marinheiro' }],
      empresa: [{ nome: 'Grupo', cnpj: '00' }],
    });
    assert.equal(fromArray.cargo_nome, 'Marinheiro');
    assert.equal(fromArray.empresa_nome, 'Grupo');
  });

  it('strips view aliases before writing the table', () => {
    const stripped = stripGtColabViewAliases({
      nome_completo: 'Ana',
      cargo_id: 'x',
      cargo_nome: 'Taifeiro',
      empresa_nome: 'ABZ',
      empresa_cnpj: '00',
    });
    assert.equal(stripped.nome_completo, 'Ana');
    assert.equal(stripped.cargo_id, 'x');
    assert.equal('cargo_nome' in stripped, false);
    assert.equal('empresa_nome' in stripped, false);
    assert.equal('empresa_cnpj' in stripped, false);
  });

  it('scans src for .from(gt_colaboradores) selects that use view aliases', () => {
    const hits: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      const source = fs.readFileSync(file, 'utf8');
      const rel = path.relative(process.cwd(), file);
      for (const sel of extractTableSelects(source)) {
        if (sel.kind === 'ident') {
          if (!SAFE_SELECT_IDENTS.has(sel.value)) {
            hits.push(`${rel} select ident ${sel.value} not in SAFE_SELECT_IDENTS`);
          }
          continue;
        }
        if (!gtColabTableSelectIsSafe(sel.value)) {
          hits.push(`${rel} table select uses view alias: ${sel.value.slice(0, 120)}`);
        }
      }
      for (const embed of extractEmbedSelects(source)) {
        if (!gtColabTableSelectIsSafe(embed)) {
          hits.push(`${rel} embed gt_colaboradores(...) uses view alias: ${embed.slice(0, 120)}`);
        }
      }
    }
    assert.deepEqual(hits, []);
  });
});
