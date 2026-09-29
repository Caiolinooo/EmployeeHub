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
 * - GT é a fonte da vida funcional (nome, cargo, departamento WK, admissão) —
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
import { resolverDepartmentId } from './departamento-de-cadastro';
import { contaComDigito } from '@/lib/gestao-tripulantes/bancos-br';

const digitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

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
  departamento: string | null;
  dados_bancarios: { codigo?: string; agencia?: string; conta?: string; digito?: string } | null;
  departamento_ref: Embed<{ codigo: string | null; nome: string | null }>;
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
       departamento, dados_bancarios,
       cargo:gt_cargos(nome),
       empresa:gt_empresas(nome, cnpj),
       departamento_ref:gt_departamentos!departamento_id(codigo, nome)`,
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
    .select('id, company_id, code, name, is_active')
    .eq('is_active', true);
  if (deptErr) throw new Error(`payroll_departments: ${deptErr.message}`);
  const normDept = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const deptPorCodigo = new Map(
    (deptRows || []).map((d) => [`${d.company_id}|${d.code}`, d.id as string]),
  );
  const deptPorNome = new Map(
    (deptRows || []).filter((d) => d.name).map((d) => [`${d.company_id}|${normDept(String(d.name))}`, d.id as string]),
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

    const dep = unwrap(c.departamento_ref);
    const departmentId = resolverDepartmentId({
      companyId,
      departamento: dep,
      texto: c.departamento,
      porCodigo: deptPorCodigo,
      porNome: deptPorNome,
    });
    const banco = c.dados_bancarios && typeof c.dados_bancarios === 'object' ? c.dados_bancarios : null;

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
        bank_code: banco?.codigo || null,
        bank_agency: banco?.agencia || null,
        bank_account: contaComDigito(banco?.conta, banco?.digito) || null,
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
