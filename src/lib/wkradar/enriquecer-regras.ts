/**
 * Regras PURAS do enriquecimento WK → portal (sem Supabase/Next — testável
 * com tsx --test). Preenchem VAZIOS apenas; nunca sobrescrevem dado
 * existente. A orquestração com banco vive em enriquecer.ts.
 */

/** Funcionário da RadarAPI (cards/empresarial/funcionarios). */
export interface FuncionarioApi {
  id: number;
  codigo: string;
  nome: string;
  departamento: string | null;
  cargo: string | null;
}

/** Dados de identidade/remuneração de uma pessoa do backup WK. */
export interface BackupPessoa {
  pis: string | null;
  nascimento: string | null;
  moda: number | null;
  estavel: boolean;
}

export interface ColaboradorGt {
  id: string;
  matricula: string | null;
  pis_pasep: string | null;
  salario: number | null;
  data_nascimento: string | null;
  matricula_esocial: string | null;
  empresa_id: string | null;
}

export interface EmployeePayroll {
  id: string;
  registration_number: string | null;
  cpf: string | null;
  position: string | null;
  base_salary: number | null;
  pis_pasep: string | null;
  department_id: string | null;
  company_id: string | null;
}

export interface DepartamentoPayroll {
  id: string;
  code: string;
  name: string;
  company_id: string;
}

/** '783' → '17784306000189.000783' (convénia do portal: CNPJ + 6 dígitos). */
export function formatarMatriculaEsocial(matricula: string, cnpj: string): string {
  return `${cnpj.replace(/\D/g, '')}.${matricula.trim().padStart(6, '0')}`;
}

export const digitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');
export const texto = (v: unknown): string => String(v ?? '').trim();
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Mudanças em uma ficha payroll_employees, ou null se nada a preencher. */
export function calcularMudancasPayroll(
  emp: EmployeePayroll,
  wk: FuncionarioApi | undefined,
  backup: BackupPessoa | undefined,
  departamentos: DepartamentoPayroll[],
): Record<string, unknown> | null {
  const changes: Record<string, unknown> = {};

  if (!texto(emp.position) && wk?.cargo) changes.position = wk.cargo;

  if (!texto(emp.pis_pasep) && backup?.pis) changes.pis_pasep = backup.pis;

  if (
    (emp.base_salary == null || emp.base_salary === 0) &&
    backup?.estavel &&
    backup.moda != null &&
    backup.moda > 0
  ) {
    changes.base_salary = round2(backup.moda);
  }

  if (!emp.department_id && wk?.departamento && emp.company_id) {
    const alvo = texto(wk.departamento).toUpperCase();
    const match = departamentos.find(
      (d) =>
        d.company_id === emp.company_id &&
        (texto(d.name).toUpperCase() === alvo || texto(d.code).toUpperCase() === alvo),
    );
    if (match) changes.department_id = match.id;
  }

  return Object.keys(changes).length ? changes : null;
}

/**
 * Mudanças em uma ficha gt_colaboradores, ou null. matricula_esocial só
 * preenche quando NULA — exceções confirmadas (ex.: 803→CNPJ.000783) ficam.
 * Matrícula não-numérica vira pendência (registro poluído), nunca grava.
 */
export function calcularMudancasGt(
  gt: ColaboradorGt,
  backup: BackupPessoa | undefined,
  cnpjPadrao: string,
): { changes: Record<string, unknown> } | { pendencia: string } | null {
  const changes: Record<string, unknown> = {};
  const matricula = texto(gt.matricula);

  if (!texto(gt.pis_pasep) && backup?.pis) changes.pis_pasep = backup.pis;

  if (!texto(gt.data_nascimento) && backup?.nascimento) {
    changes.data_nascimento = backup.nascimento;
  }

  // Aprendizes têm remuneração legítima abaixo do mínimo — sem piso.
  if (
    gt.salario == null &&
    backup?.estavel &&
    backup.moda != null &&
    backup.moda > 0
  ) {
    changes.salario = round2(backup.moda);
  }

  if (!texto(gt.matricula_esocial)) {
    if (!matricula || !/^\d+$/.test(matricula)) {
      return {
        pendencia: `matrícula "${matricula || '(vazia)'}" não numérica — matricula_esocial não gerada`,
      };
    }
    changes.matricula_esocial = formatarMatriculaEsocial(matricula, cnpjPadrao);
  }

  return Object.keys(changes).length ? { changes } : null;
}
