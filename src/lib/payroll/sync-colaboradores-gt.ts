/**
 * Espelha os colaboradores do GT na folha.
 *   gt_colaboradores → payroll_employees via o ponto único de merge
 *   (colaborador-merge.ts, design §3): match por CPF normalizado, senão por
 *   (company_id, registration_number); preenchimento ADITIVO; employee_id
 *   (vínculo GT ↔ folha) preenchido quando vazio.
 *
 * É o elo que faltava entre a logística e o DP: sem ficha em payroll_employees
 * o motor não tem em quem lançar os dias e todo mundo cai em "CPF não casado".
 *
 * Regras:
 * - GT é a fonte da vida funcional (nome, cargo, centro de custo, admissão) —
 *   gravada de forma aditiva: só preenche campo vazio na ficha.
 * - `base_salary` NUNCA é rebaixado: valor já existente na folha (WK, digitado
 *   pelo DP) só é substituído por um salário GT maior que zero quando a ficha
 *   ainda está zerada. Salário é dinheiro — o portal não inventa nem zera.
 * - Sem CPF de 11 dígitos → pendência, nunca grava.
 * - Sem empresa de folha correspondente → pendência (rode o sync de estrutura).
 * - Idempotente: reexecutar não duplica.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeColaborador } from './colaborador-merge';

const digitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

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
  const empresaPorCnpj = new Map(empresas.map((e) => [digitos(e.cnpj), e.id] as [string, string]).filter(([k]) => k));
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

    // Ponto único de merge (design §3): match por CPF/matrícula, preenchimento
    // aditivo, vínculo employee_id e auditoria vivem no service.
    const merge = await mergeColaborador(
      supabase,
      {
        company_id: companyId,
        registration_number: matricula,
        cpf,
        name: nome,
        cargo,
        base_salary: salarioGt,
        data_admissao: c.data_admissao || null,
        data_demissao: c.data_demissao || null,
        gt_colaborador_id: c.id,
        department_id: departmentId,
        status,
      },
      'gt',
    );

    if (merge.acao === 'criado') {
      resultado.inseridos += 1;
      if (salarioGt <= 0) resultado.semSalario.push({ cpf, nome });
      continue;
    }
    if (merge.acao === 'merged') {
      resultado.atualizados += 1;
    } else {
      resultado.inalterados += 1;
    }

    // Salário só sobe de zero; valor já lançado na folha manda.
    const baseFinal = merge.campos_adicionados.includes('base_salary')
      ? salarioGt
      : Number(existente?.base_salary) || 0;
    if (baseFinal <= 0) resultado.semSalario.push({ cpf, nome });
  }

  return resultado;
}
