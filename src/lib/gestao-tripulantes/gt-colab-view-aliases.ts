/**
 * View-only aliases on `gt_vw_colaboradores_completo`.
 * Selecting or writing them on TABLE `gt_colaboradores` makes PostgREST error.
 *
 * Source: supabase/migrations/20260520_000001_create_gestao_tripulantes.sql
 * (CREATE VIEW gt_vw_colaboradores_completo).
 */

export const GT_COLAB_VIEW_ALIASES = [
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

export type GtColabViewAlias = (typeof GT_COLAB_VIEW_ALIASES)[number];

export function gtColabTableSelectIsSafe(select: string): boolean {
  return GT_COLAB_VIEW_ALIASES.every((alias) => {
    const re = new RegExp(`(^|[,\\s])${alias}([,\\s]|$)`, 'i');
    return !re.test(select);
  });
}

export function stripGtColabViewAliases<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const alias of GT_COLAB_VIEW_ALIASES) {
    delete out[alias];
  }
  return out;
}

export function asRel<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Table columns + embeds only. Never `cargo_nome` / `empresa_nome` /
 * `empresa_cnpj` (view aliases) or `funcao` / `cargo_cbo` (not on table).
 */
export const FULL_COLAB_BY_CPF_SELECT =
  'id, cpf, nome_completo, matricula, matricula_esocial, data_admissao, cbo, cargo:gt_cargos(nome), empresa:gt_empresas(nome, cnpj)';

export type FullColabSelectRow = {
  id: string;
  cpf?: string | null;
  nome_completo?: string | null;
  matricula?: string | null;
  matricula_esocial?: string | null;
  data_admissao?: string | null;
  cbo?: string | null;
  cargo_nome?: string | null;
  funcao?: string | null;
  cargo_cbo?: string | null;
  empresa_nome?: string | null;
  empresa_cnpj?: string | null;
  cargo?: { nome?: string | null } | { nome?: string | null }[] | null;
  empresa?: { nome?: string | null; cnpj?: string | null } | { nome?: string | null; cnpj?: string | null }[] | null;
};

export function flattenFullColaboradorRow(row: FullColabSelectRow): {
  id: string;
  cpf: string;
  nome_completo: string;
  matricula: string | null;
  matricula_esocial: string | null;
  data_admissao: string | null;
  cargo_nome: string | null;
  funcao: string | null;
  cbo: string | null;
  cargo_cbo: string | null;
  empresa_cnpj: string | null;
  empresa_nome: string | null;
} {
  const cargo = asRel(row.cargo);
  const empresa = asRel(row.empresa);
  const cargoNome = row.cargo_nome ?? cargo?.nome ?? null;
  const cbo = row.cbo ?? null;
  return {
    id: row.id,
    cpf: row.cpf || '',
    nome_completo: row.nome_completo || '',
    matricula: row.matricula ?? null,
    matricula_esocial: row.matricula_esocial ?? null,
    data_admissao: row.data_admissao ?? null,
    cargo_nome: cargoNome,
    funcao: row.funcao ?? cargoNome,
    cbo,
    cargo_cbo: row.cargo_cbo ?? cbo,
    empresa_cnpj: row.empresa_cnpj ?? empresa?.cnpj ?? null,
    empresa_nome: row.empresa_nome ?? empresa?.nome ?? null,
  };
}
