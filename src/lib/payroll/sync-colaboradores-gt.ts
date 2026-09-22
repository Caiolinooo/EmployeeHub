/**
 * Espelha os colaboradores do GT na folha.
 *   gt_colaboradores → payroll_employees (casamento por CPF; chave de gravação
 *   é UNIQUE(company_id, registration_number))
 *
 * É o elo que faltava entre a logística e o DP: sem ficha em payroll_employees
 * o motor não tem em quem lançar os dias e todo mundo cai em "CPF não casado".
 *
 * Regras:
 * - GT é a fonte da verdade de nome, cargo, centro de custo, admissão e demissão.
 * - `base_salary` NUNCA é rebaixado: valor já existente na folha (WK, digitado
 *   pelo DP) só é substituído por um salário GT maior que zero quando a ficha
 *   ainda está zerada. Salário é dinheiro — o portal não inventa nem zera.
 * - Sem CPF de 11 dígitos → pendência, nunca grava.
 * - Sem empresa de folha correspondente → pendência (rode o sync de estrutura).
 * - Idempotente: reexecutar não duplica.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const digitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

const formatarCpf = (d: string): string =>
  d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;

/** Mesma convenção de código do sync de estrutura: payroll_departments.code é VARCHAR(10). */
const codigoDepartamento = (codigo: string | null, nome: string | null): string =>
  (((codigo || nome || '').trim()) || '').slice(0, 10);

type Embed<T> = T | T[] | null;

const unwrap = <T>(v: Embed<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

interface ColaboradorGt {
  id: string;
  cpf: string | null;
  nome_completo: string | null;
  matricula: string | null;
  ativo: boolean | null;
  salario: number | string | null;
  data_admissao: string | null;
  data_demissao: string | null;
  cargo: Embed<{ nome: string | null }>;
  empresa: Embed<{ nome: string | null; cnpj: string | null }>;
  centro_custo: Embed<{ codigo: string | null; nome: string | null }>;
}

interface EmployeeFolha {
  id: string;
  company_id: string;
  department_id: string | null;
  registration_number: string | null;
  name: string | null;
  cpf: string | null;
  base_salary: number | null;
  status: string | null;
}

export interface PendenciaSyncColaborador {
  cpf: string;
  nome: string;
  motivo: string;
}

export interface ResultadoSyncColaboradores {
  inseridos: number;
  atualizados: number;
  inalterados: number;
  semSalario: Array<{ cpf: string; nome: string }>;
  pendencias: PendenciaSyncColaborador[];
}

export async function sincronizarColaboradoresGt(
  supabase: SupabaseClient,
): Promise<ResultadoSyncColaboradores> {
  const { data: gtRows, error: gtErr } = await supabase
    .from('gt_colaboradores')
    .select(
      `id, cpf, nome_completo, matricula, ativo, salario, data_admissao, data_demissao,
       cargo:gt_cargos(nome),
       empresa:gt_empresas(nome, cnpj),
       centro_custo:gt_centros_custo(codigo, nome)`,
    )
    .is('deleted_at', null)
    .order('nome_completo');
  if (gtErr) throw new Error(`gt_colaboradores: ${gtErr.message}`);
  const colaboradores = (gtRows || []) as unknown as ColaboradorGt[];

  const { data: compRows, error: compErr } = await supabase
    .from('payroll_companies')
    .select('id, name, cnpj, is_active')
    .eq('is_active', true);
  if (compErr) throw new Error(`payroll_companies: ${compErr.message}`);
  const empresas = compRows || [];
  const empresaPorNome = new Map(empresas.map((e) => [String(e.name).trim().toLowerCase(), e.id]));
  const empresaPorCnpj = new Map(empresas.map((e) => [digitos(e.cnpj), e.id]).filter(([k]) => k));
  /** Uma empresa ativa só: o GT sem contraparte nominal ainda tem destino óbvio. */
  const empresaUnica = empresas.length === 1 ? empresas[0].id : null;

  const { data: deptRows, error: deptErr } = await supabase
    .from('payroll_departments')
    .select('id, company_id, code, is_active')
    .eq('is_active', true);
  if (deptErr) throw new Error(`payroll_departments: ${deptErr.message}`);
  const deptPorEmpresaCodigo = new Map(
    (deptRows || []).map((d) => [`${d.company_id}|${d.code}`, d.id]),
  );

  const { data: empRows, error: empErr } = await supabase
    .from('payroll_employees')
    .select('id, company_id, department_id, registration_number, name, cpf, base_salary, status');
  if (empErr) throw new Error(`payroll_employees: ${empErr.message}`);
  const existentes = (empRows || []) as EmployeeFolha[];
  const porCpf = new Map<string, EmployeeFolha>();
  const porMatricula = new Map<string, EmployeeFolha>();
  for (const e of existentes) {
    const cpf = digitos(e.cpf);
    if (cpf.length === 11) porCpf.set(`${e.company_id}|${cpf}`, e);
    if (e.registration_number) porMatricula.set(`${e.company_id}|${e.registration_number.trim()}`, e);
  }

  const resultado: ResultadoSyncColaboradores = {
    inseridos: 0,
    atualizados: 0,
    inalterados: 0,
    semSalario: [],
    pendencias: [],
  };
  const agora = new Date().toISOString();

  for (const c of colaboradores) {
    const cpf = digitos(c.cpf);
    const nome = (c.nome_completo || '').trim();
    if (!nome) continue;

    if (cpf.length !== 11) {
      resultado.pendencias.push({ cpf: cpf || '(vazio)', nome, motivo: 'CPF ausente ou inválido no cadastro do GT' });
      continue;
    }

    const empresaGt = unwrap(c.empresa);
    const companyId =
      (empresaGt?.cnpj ? empresaPorCnpj.get(digitos(empresaGt.cnpj)) : undefined) ||
      (empresaGt?.nome ? empresaPorNome.get(empresaGt.nome.trim().toLowerCase()) : undefined) ||
      empresaUnica;
    if (!companyId) {
      resultado.pendencias.push({
        cpf,
        nome,
        motivo: `Empresa "${empresaGt?.nome || 'sem empresa no GT'}" não tem contraparte ativa na folha — rode o sync de estrutura`,
      });
      continue;
    }

    const cc = unwrap(c.centro_custo);
    const departmentId = cc
      ? deptPorEmpresaCodigo.get(`${companyId}|${codigoDepartamento(cc.codigo, cc.nome)}`) ?? null
      : null;

    const matricula = (c.matricula || '').trim() || `GT-${cpf.slice(-8)}`;
    const salarioGt = Number(c.salario) || 0;
    const demitido = Boolean(c.data_demissao) || c.ativo === false;
    const status = demitido ? 'terminated' : 'active';
    const cargo = unwrap(c.cargo)?.nome?.trim() || null;

    const existente = porCpf.get(`${companyId}|${cpf}`) || porMatricula.get(`${companyId}|${matricula}`);

    if (!existente) {
      const { error } = await supabase.from('payroll_employees').insert({
        employee_id: c.id,
        company_id: companyId,
        department_id: departmentId,
        registration_number: matricula,
        name: nome,
        cpf: formatarCpf(cpf),
        position: cargo,
        base_salary: salarioGt,
        admission_date: c.data_admissao || null,
        termination_date: c.data_demissao || null,
        status,
      });
      if (error) throw new Error(`insert ${nome} (${cpf}): ${error.message}`);
      resultado.inseridos += 1;
      if (salarioGt <= 0) resultado.semSalario.push({ cpf, nome });
      continue;
    }

    const baseAtual = Number(existente.base_salary) || 0;
    const patch: Record<string, unknown> = {};
    if (existente.name !== nome) patch.name = nome;
    if (digitos(existente.cpf) !== cpf) patch.cpf = formatarCpf(cpf);
    if (departmentId && existente.department_id !== departmentId) patch.department_id = departmentId;
    if (existente.status !== status) patch.status = status;
    // Salário só sobe de zero; valor já lançado na folha manda.
    if (baseAtual <= 0 && salarioGt > 0) patch.base_salary = salarioGt;

    if (Object.keys(patch).length === 0) {
      resultado.inalterados += 1;
    } else {
      patch.updated_at = agora;
      const { error } = await supabase.from('payroll_employees').update(patch).eq('id', existente.id);
      if (error) throw new Error(`update ${nome} (${cpf}): ${error.message}`);
      resultado.atualizados += 1;
    }

    const baseFinal = typeof patch.base_salary === 'number' ? patch.base_salary : baseAtual;
    if (baseFinal <= 0) resultado.semSalario.push({ cpf, nome });
  }

  return resultado;
}
