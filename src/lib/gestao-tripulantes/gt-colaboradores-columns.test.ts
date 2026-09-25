import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractFiltersAfterGtColaboradoresFrom,
  extractSelectsAfterGtColaboradoresFrom,
  GT_VW_COLABORADORES_VIEW_ALIASES,
  gtColaboradoresTableFilterIsSafe,
  gtColaboradoresTableSelectIsSafe,
  stripGtColaboradoresViewAliases,
} from './gt-colaboradores-columns';
import { CATALOG_COLAB_SELECT } from '../document-catalog/identity-match';
import { ALLOWED_COLAB_FIELDS } from './colaborador-cadastro';
import { flattenFullColaboradorRow, FULL_COLAB_BY_CPF_SELECT } from './full-colaborador-row';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function resolveImportedSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    const base = join(srcRoot, specifier.slice(2));
    for (const cand of [base + '.ts', base + '.tsx', join(base, 'index.ts')]) {
      if (existsSync(cand)) return cand;
    }
    return null;
  }
  if (specifier.startsWith('.')) {
    const base = join(dirname(fromFile), specifier);
    for (const cand of [base + '.ts', base + '.tsx', join(base, 'index.ts')]) {
      if (existsSync(cand)) return cand;
    }
  }
  return null;
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js')) out.push(full);
  }
  return out;
}

describe('gt_colaboradores table vs view aliases', () => {
  it('lists the view-only aliases from gt_vw_colaboradores_completo', () => {
    assert.deepEqual([...GT_VW_COLABORADORES_VIEW_ALIASES], [
      'centro_custo_nome',
      'centro_custo_codigo',
      'empresa_nome',
      'empresa_cnpj',
      'embarcacao_nome',
      'embarcacao_imo',
      'cargo_nome',
      'cargo_nivel',
      'cargo_ordem',
      'avatar',
      'first_name',
      'last_name',
      'user_email',
      'qtd_docs_vencidos',
      'qtd_docs_vencendo',
      'qtd_docs_validos',
      'proximos_vencimentos',
      'ultimo_embarque',
    ]);
  });

  it('rejects bare view aliases and allows joins', () => {
    assert.equal(
      gtColaboradoresTableSelectIsSafe(
        'id, nome_completo, cpf, cargo_nome, empresa_nome'
      ),
      false
    );
    assert.equal(
      gtColaboradoresTableSelectIsSafe(
        'id, cpf, cargo:gt_cargos(nome), empresa:gt_empresas(nome, cnpj)'
      ),
      true
    );
    assert.equal(gtColaboradoresTableSelectIsSafe(FULL_COLAB_BY_CPF_SELECT), true);
    assert.equal(gtColaboradoresTableSelectIsSafe(CATALOG_COLAB_SELECT), true);
    assert.equal(
      gtColaboradoresTableSelectIsSafe(
        'id, nome_completo, cpf, cargo:gt_cargos(nome), empresa:gt_empresas(nome, cnpj)'
      ),
      true
    );
    assert.equal(gtColaboradoresTableSelectIsSafe('id, funcao, cbo'), false);
    assert.equal(gtColaboradoresTableSelectIsSafe('*'), true);
  });

  it('flattens cargo/empresa joins for e-Social FullColaboradorInfo', () => {
    const flat = flattenFullColaboradorRow({
      id: 'c1',
      cpf: '12345678909',
      nome_completo: 'Ana Souza',
      matricula: 'M1',
      matricula_esocial: 'M1',
      data_admissao: '2024-01-01',
      cbo: '215105',
      cargo: { nome: 'Taifeiro' },
      empresa: { nome: 'ABZ', cnpj: '12.345.678/0001-90' },
    });
    assert.equal(flat.cargo_nome, 'Taifeiro');
    assert.equal(flat.funcao, 'Taifeiro');
    assert.equal(flat.empresa_nome, 'ABZ');
    assert.equal(flat.empresa_cnpj, '12.345.678/0001-90');
    assert.equal(flat.cargo_cbo, '215105');
  });

  it('strips view aliases from write payloads', () => {
    const stripped = stripGtColaboradoresViewAliases({
      nome_completo: 'Ana',
      cargo_id: 'x',
      cargo_nome: 'Taifeiro',
      empresa_nome: 'ABZ',
    });
    assert.equal(stripped.nome_completo, 'Ana');
    assert.equal(stripped.cargo_id, 'x');
    assert.equal('cargo_nome' in stripped, false);
    assert.equal('empresa_nome' in stripped, false);
  });

  it('does not whitelist view aliases on PUT/POST cadastro', () => {
    const allowed = new Set<string>(ALLOWED_COLAB_FIELDS);
    for (const alias of GT_VW_COLABORADORES_VIEW_ALIASES) {
      assert.equal(allowed.has(alias), false, alias);
    }
    assert.equal(allowed.has('funcao'), false);
    assert.equal(allowed.has('cargo_cbo'), false);
  });

  it('scans src for .from(gt_colaboradores) select/filter using view aliases', () => {
    const files = walkTsFiles(srcRoot);
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes("from('gt_colaboradores')") && !source.includes('from("gt_colaboradores")')) {
        continue;
      }
      const rel = file.replace(srcRoot + '/', 'src/');
      for (const select of extractSelectsAfterGtColaboradoresFrom(source, (spec) => {
        const resolved = resolveImportedSpecifier(file, spec);
        return resolved ? readFileSync(resolved, 'utf8') : null;
      })) {
        if (!gtColaboradoresTableSelectIsSafe(select)) {
          violations.push(`${rel} select: ${select.replace(/\s+/g, ' ').trim()}`);
        }
      }
      for (const filter of extractFiltersAfterGtColaboradoresFrom(source)) {
        if (!gtColaboradoresTableFilterIsSafe(filter)) {
          violations.push(`${rel} filter: ${filter.replace(/\s+/g, ' ').trim()}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});
