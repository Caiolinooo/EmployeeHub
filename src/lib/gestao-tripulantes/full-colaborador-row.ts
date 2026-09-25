/**
 * Table-safe select + flatten for e-Social / CPF full lookup.
 * Never select view aliases (`cargo_nome`, `empresa_nome`, …) on `gt_colaboradores`.
 */

export const FULL_COLAB_BY_CPF_SELECT = `
  id, cpf, nome_completo, matricula, matricula_esocial, data_admissao, cbo,
  cargo:gt_cargos(nome),
  empresa:gt_empresas(nome, cnpj)
`.replace(/\s+/g, ' ').trim();

export interface FullColaboradorInfo {
  id: string;
  cpf: string;
  nome_completo: string;
  matricula?: string | null;
  matricula_esocial?: string | null;
  data_admissao?: string | null;
  cargo_nome?: string | null;
  funcao?: string | null;
  cbo?: string | null;
  cargo_cbo?: string | null;
  empresa_cnpj?: string | null;
  empresa_nome?: string | null;
}

type CargoJoin = { nome?: string | null } | { nome?: string | null }[] | null;
type EmpresaJoin = { nome?: string | null; cnpj?: string | null } | { nome?: string | null; cnpj?: string | null }[] | null;

function asRel<T extends object>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function flattenFullColaboradorRow(row: {
  id: string;
  cpf?: string | null;
  nome_completo?: string | null;
  matricula?: string | null;
  matricula_esocial?: string | null;
  data_admissao?: string | null;
  cbo?: string | null;
  cargo?: CargoJoin;
  empresa?: EmpresaJoin;
}): FullColaboradorInfo {
  const cargo = asRel(row.cargo);
  const empresa = asRel(row.empresa);
  const cargoNome = cargo?.nome ?? null;
  return {
    id: row.id,
    cpf: row.cpf || '',
    nome_completo: row.nome_completo || '',
    matricula: row.matricula ?? null,
    matricula_esocial: row.matricula_esocial ?? null,
    data_admissao: row.data_admissao ?? null,
    cargo_nome: cargoNome,
    funcao: cargoNome,
    cbo: row.cbo ?? null,
    cargo_cbo: row.cbo ?? null,
    empresa_cnpj: empresa?.cnpj ?? null,
    empresa_nome: empresa?.nome ?? null,
  };
}
