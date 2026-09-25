/**
 * Table vs view contract for `gt_colaboradores`.
 *
 * `gt_vw_colaboradores_completo` is `c.*` plus join/aggregate aliases
 * (`supabase/migrations/20260520_000001_create_gestao_tripulantes.sql`).
 * The view was never redefined. Later ALTERs add table columns (cadastro,
 * ativo, esocial_*) that do not collide with these aliases.
 * Selecting those aliases on the TABLE makes PostgREST error.
 */

/** Aliases that exist only on `gt_vw_colaboradores_completo`, not the table. */
export const GT_VW_COLABORADORES_VIEW_ALIASES = [
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
] as const;

/**
 * Columns that appear in some selects but exist on neither table nor view.
 * Same PostgREST failure mode as view aliases.
 */
export const GT_COLAB_NON_TABLE_COLUMNS = [
  ...GT_VW_COLABORADORES_VIEW_ALIASES,
  'funcao',
  'cargo_cbo',
] as const;

const BARE_COLUMN = (name: string) =>
  new RegExp(`(^|[,\\s])${name}(?!\\s*:)([,\\s)]|$)`, 'i');

const FILTER_METHOD = '(?:eq|neq|gt|gte|lt|lte|ilike|like|in|is|order)';

/** True when a PostgREST select/filter string is safe on `gt_colaboradores`. */
export function gtColaboradoresTableSelectIsSafe(select: string): boolean {
  const trimmed = String(select || '').trim();
  if (!trimmed) return false;
  if (trimmed === '*') return true;
  return GT_COLAB_NON_TABLE_COLUMNS.every((alias) => !BARE_COLUMN(alias).test(trimmed));
}

export function stripGtColaboradoresViewAliases<T extends Record<string, unknown>>(
  payload: T
): T {
  const next = { ...payload };
  for (const alias of GT_COLAB_NON_TABLE_COLUMNS) {
    delete next[alias];
  }
  return next;
}

/** Bound a `.from('gt_colaboradores')` chain before the next `.from(`. */
export function sliceGtColaboradoresQueryWindow(source: string, fromIndex: number): string {
  const start = fromIndex;
  const afterFrom = source.slice(start + 1);
  const nextFrom = afterFrom.search(/\.from\s*\(/);
  const end = nextFrom === -1 ? start + 1600 : Math.min(start + 1600, start + 1 + nextFrom);
  return source.slice(start, end);
}

export function resolveSelectIdent(source: string, ident: string): string | null {
  const def = source.match(
    new RegExp(`(?:export\\s+)?const\\s+${ident}\\s*=\\s*([\`'"'])([\\s\\S]*?)\\1`)
  );
  return def?.[2] ?? null;
}

export function lookupImportedModuleSpecifier(source: string, ident: string): string | null {
  const imp = source.match(
    new RegExp(`import\\s*\\{[^}]*\\b${ident}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`)
  );
  return imp?.[1] ?? null;
}

export function extractSelectsAfterGtColaboradoresFrom(
  source: string,
  readImported?: (specifier: string) => string | null
): string[] {
  const selects: string[] = [];
  const fromRe = /\.from\(\s*['"]gt_colaboradores['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = fromRe.exec(source))) {
    const window = sliceGtColaboradoresQueryWindow(source, match.index);
    const quoted = window.match(/\.select\(\s*([`'"])([\s\S]*?)\1/);
    if (quoted?.[2]) {
      selects.push(quoted[2]);
      continue;
    }
    const ident = window.match(/\.select\(\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if (ident?.[1]) {
      const local = resolveSelectIdent(source, ident[1]);
      if (local) {
        selects.push(local);
        continue;
      }
      const spec = readImported ? lookupImportedModuleSpecifier(source, ident[1]) : null;
      const importedSource = spec && readImported ? readImported(spec) : null;
      const imported = importedSource ? resolveSelectIdent(importedSource, ident[1]) : null;
      if (imported) selects.push(imported);
    }
  }
  return selects;
}

export function extractFiltersAfterGtColaboradoresFrom(source: string): string[] {
  const filters: string[] = [];
  const fromRe = /\.from\(\s*['"]gt_colaboradores['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = fromRe.exec(source))) {
    const window = sliceGtColaboradoresQueryWindow(source, match.index);
    const methodRe = new RegExp(`\\.${FILTER_METHOD}\\(\\s*['"]([a-z0-9_]+)['"]`, 'gi');
    let methodMatch: RegExpExecArray | null;
    while ((methodMatch = methodRe.exec(window))) {
      filters.push(methodMatch[1]);
    }
    const orRe = /\.or\(\s*([`'"])([\s\S]*?)\1/g;
    let orMatch: RegExpExecArray | null;
    while ((orMatch = orRe.exec(window))) {
      filters.push(orMatch[2]);
    }
  }
  return filters;
}

export function gtColaboradoresTableFilterIsSafe(filter: string): boolean {
  const trimmed = String(filter || '').trim();
  if (!trimmed) return true;
  return GT_COLAB_NON_TABLE_COLUMNS.every((alias) => {
    const asColumn = new RegExp(`(^|[,\\s.])${alias}([,\\s.=]|$)`, 'i');
    return !asColumn.test(trimmed);
  });
}
