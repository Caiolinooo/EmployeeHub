/**
 * Departamento da folha vem do departamento do cadastro (WK), não do centro de custo.
 * payroll_departments.code é VARCHAR(10).
 */

export interface DepartamentoCadastro {
  codigo?: string | null;
  nome?: string | null;
}

export function codigoFolha(codigo: string | null | undefined, nome: string | null | undefined): string {
  return ((codigo || nome || '').trim() || '').slice(0, 10);
}

function norm(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "01 - ABZ SERVIÇOS" → codigo 01, nome o texto inteiro se não houver catálogo. */
export function partirDepartamentoTexto(texto: string | null | undefined): DepartamentoCadastro | null {
  const t = String(texto || '').trim();
  if (!t) return null;
  const m = /^(\S+)\s*-\s+(.+)$/.exec(t);
  if (m && m[1].length <= 10) return { codigo: m[1], nome: m[2].trim() };
  return { codigo: null, nome: t };
}

export function resolverDepartmentId(opts: {
  companyId: string;
  departamento: DepartamentoCadastro | null;
  texto: string | null | undefined;
  porCodigo: Map<string, string>;
  porNome: Map<string, string>;
}): string | null {
  const doTexto = partirDepartamentoTexto(opts.texto);
  const codigo = codigoFolha(opts.departamento?.codigo || doTexto?.codigo, null);
  if (codigo) {
    const porCodigo = opts.porCodigo.get(`${opts.companyId}|${codigo}`);
    if (porCodigo) return porCodigo;
  }
  const nome = (opts.departamento?.nome || doTexto?.nome || '').trim();
  if (!nome) return null;
  return opts.porNome.get(`${opts.companyId}|${norm(nome)}`) ?? null;
}
