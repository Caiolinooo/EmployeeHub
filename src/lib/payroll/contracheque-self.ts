/**
 * Auto-serviço de contracheque (portal /contracheque): resolve o funcionário
 * (payroll_employees) do usuário logado e monta o payload do holerite.
 *
 * Vínculo de identidade (design §2): payroll_employees NÃO tem coluna de
 * e-mail — o match é por CPF normalizado (11 dígitos), coletado de:
 *   1. users_unified.tax_id (CPF do perfil do portal);
 *   2. gt_colaboradores.cpf via user_id (vínculo GT ↔ portal);
 *   3. gt_colaboradores.cpf via e-mail (fallback quando não há user_id).
 * payroll_employees.cpf é gravado em 2 formatos no repo (sync GT formata
 * '000.000.000-00'; fixtures/importadores gravam dígitos) — a busca cobre os 2.
 *
 * Padrão do módulo folha: tudo via supabaseAdmin (service_role); auth do
 * usuário fica na rota (tokenFromRequest + verifyToken de payroll-auth).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeCpf } from '@/lib/utils/identity';
import type { ContrachequeDados } from '@/lib/payroll/contracheque';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface UsuarioPortal {
  id: string;
  email: string;
  nome: string;
  cpf: string; // tax_id normalizado (pode ser '')
}

export interface FuncionarioVinculado {
  id: string;
  name: string | null;
  cpf: string | null;
}

/** '52998224725' → '529.982.247-25' (formato gravado pelo sync GT). */
function formatarCpf(digitos: string): string {
  if (digitos.length !== 11) return digitos;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/** Carrega o usuário do portal (users_unified) pelo userId do JWT. */
export async function carregarUsuarioPortal(userId: string): Promise<UsuarioPortal | null> {
  const { data, error } = await supabaseAdmin
    .from('users_unified')
    .select('id, email, name, first_name, last_name, tax_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`users_unified: ${error.message}`);
  if (!data) return null;
  const row = data as {
    id: string;
    email: string | null;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    tax_id: string | null;
  };
  const nome =
    (row.name || '').trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    email: (row.email || '').trim().toLowerCase(),
    nome,
    cpf: normalizeCpf(row.tax_id || ''),
  };
}

/**
 * CPFs candidatos do usuário: tax_id do perfil + CPFs do cadastro GT
 * (vínculo por user_id; fallback por e-mail). Só 11 dígitos.
 */
async function coletarCpfsDoUsuario(usuario: UsuarioPortal): Promise<string[]> {
  const cpfs = new Set<string>();
  if (usuario.cpf.length === 11) cpfs.add(usuario.cpf);

  const porUserId = await supabaseAdmin
    .from('gt_colaboradores')
    .select('cpf')
    .eq('user_id', usuario.id)
    .is('deleted_at', null);
  if (porUserId.error) throw new Error(`gt_colaboradores: ${porUserId.error.message}`);

  let porEmail: { data: unknown; error: { message: string } | null } = { data: [], error: null };
  if (usuario.email) {
    porEmail = await supabaseAdmin
      .from('gt_colaboradores')
      .select('cpf')
      .ilike('email', usuario.email)
      .is('deleted_at', null);
    if (porEmail.error) throw new Error(`gt_colaboradores(email): ${porEmail.error.message}`);
  }

  for (const r of [...(porUserId.data || []), ...((porEmail.data as unknown[]) || [])]) {
    const cpf = normalizeCpf(String((r as { cpf?: string | null }).cpf || ''));
    if (cpf.length === 11) cpfs.add(cpf);
  }
  return [...cpfs];
}

/**
 * Funcionários da folha vinculados ao usuário logado (match por CPF).
 * Lista vazia = usuário sem vínculo com payroll_employees (não é erro).
 */
export async function resolverFuncionariosDoUsuario(
  usuario: UsuarioPortal,
): Promise<FuncionarioVinculado[]> {
  const cpfs = await coletarCpfsDoUsuario(usuario);
  if (cpfs.length === 0) return [];

  const formatos = cpfs.flatMap((c) => [c, formatarCpf(c)]);
  const { data, error } = await supabaseAdmin
    .from('payroll_employees')
    .select('id, name, cpf')
    .in('cpf', formatos);
  if (error) throw new Error(`payroll_employees: ${error.message}`);
  return (data || []) as FuncionarioVinculado[];
}

/**
 * Monta o ContrachequeDados do funcionário na sheet (mesmo payload da rota
 * administrativa /api/dp/folha/contracheque). NULL quando não há resumo
 * calculado para o par (sheet ainda não calculada para este funcionário).
 */
export async function carregarDadosContracheque(
  sheetId: string,
  employeeId: string,
): Promise<ContrachequeDados | null> {
  const { data: sheet, error: erroSheet } = await supabaseAdmin
    .from('payroll_sheets')
    .select('id, reference_month, reference_year, payroll_companies(name, cnpj)')
    .eq('id', sheetId)
    .maybeSingle();
  if (erroSheet) throw new Error(`payroll_sheets: ${erroSheet.message}`);
  if (!sheet) return null;

  const { data: emp, error: erroEmp } = await supabaseAdmin
    .from('payroll_employees')
    .select('id, name, cpf, registration_number, position, admission_date, pis_pasep, base_salary, payroll_departments(name)')
    .eq('id', employeeId)
    .maybeSingle();
  if (erroEmp) throw new Error(`payroll_employees: ${erroEmp.message}`);
  if (!emp) return null;

  const { data: summary } = await supabaseAdmin
    .from('payroll_employee_summaries')
    .select('*')
    .eq('sheet_id', sheetId)
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (!summary) return null;

  const { data: items } = await supabaseAdmin
    .from('payroll_sheet_items')
    .select('quantity, reference_value, calculated_value, payroll_codes(code, name, type)')
    .eq('sheet_id', sheetId)
    .eq('employee_id', employeeId);

  const empresaJoin = sheet.payroll_companies as unknown as { name: string; cnpj: string } | null;
  const deptJoin = emp.payroll_departments as unknown as { name: string } | null;

  const rubricas = (items ?? []).map((it) => {
    const code = it.payroll_codes as unknown as { code: string; name: string; type: string } | null;
    const tipo = code?.type;
    return {
      codigo: code?.code || '',
      descricao: code?.name || '',
      quantidade: Number(it.quantity) || null,
      referencia: Number(it.reference_value) || null,
      valor: Number(it.calculated_value) || 0,
      natureza: tipo === 'desconto' ? ('desconto' as const) : tipo === 'informativo' ? ('informativo' as const) : ('provento' as const),
    };
  });

  return {
    competencia: `${MESES[(sheet.reference_month as number) - 1]}/${sheet.reference_year}`,
    empresa: {
      razaoSocial: empresaJoin?.name || 'Empresa',
      cnpj: empresaJoin?.cnpj || '',
    },
    empregado: {
      nome: emp.name || '',
      cpf: emp.cpf || '',
      matricula: emp.registration_number || '',
      cargo: emp.position || '',
      departamento: deptJoin?.name || '',
      admissao: emp.admission_date || '',
      pis: emp.pis_pasep || '',
      salarioBase: Number(summary.base_salary) || 0,
    },
    rubricas,
    totais: {
      proventos: Number(summary.total_earnings) || 0,
      descontos: Number(summary.total_deductions) || 0,
      liquido: (Number(summary.total_earnings) || 0) - (Number(summary.total_deductions) || 0),
    },
    bases: {
      inss: Number(summary.inss_base) || 0,
      irrf: Number(summary.irrf_base) || 0,
      fgts: Number(summary.fgts_base) || 0,
    },
    valores: {
      inss: Number(summary.inss_value) || 0,
      irrf: Number(summary.irrf_value) || 0,
      fgts: Number(summary.fgts_value) || 0,
    },
  };
}
