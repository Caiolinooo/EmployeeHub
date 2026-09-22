import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { renderContracheque, type ContrachequeDados } from '@/lib/payroll/contracheque';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dp/folha/contracheque?sheetId=...&employeeId=...
 * Devolve o contracheque em HTML (imprimível em A4) do funcionário na sheet.
 * Gate: nível folha 'view'. Vazio de summary → 404 (rode o cálculo antes).
 */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export async function GET(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'view');
  if (!gate.ok) return gate.error;

  const { searchParams } = new URL(request.url);
  const sheetId = searchParams.get('sheetId');
  const employeeId = searchParams.get('employeeId');
  if (!sheetId || !employeeId) {
    return NextResponse.json(
      { success: false, error: 'Informe sheetId e employeeId.' },
      { status: 400 },
    );
  }

  const { data: sheet, error: erroSheet } = await supabaseAdmin
    .from('payroll_sheets')
    .select('id, reference_month, reference_year, payroll_companies(name, cnpj)')
    .eq('id', sheetId)
    .maybeSingle();
  if (erroSheet) return NextResponse.json({ success: false, error: erroSheet.message }, { status: 500 });
  if (!sheet) return NextResponse.json({ success: false, error: 'Sheet não encontrada.' }, { status: 404 });

  const { data: emp, error: erroEmp } = await supabaseAdmin
    .from('payroll_employees')
    .select('id, name, cpf, registration_number, position, admission_date, pis_pasep, base_salary, payroll_departments(name)')
    .eq('id', employeeId)
    .maybeSingle();
  if (erroEmp) return NextResponse.json({ success: false, error: erroEmp.message }, { status: 500 });
  if (!emp) return NextResponse.json({ success: false, error: 'Funcionário não encontrado.' }, { status: 404 });

  const { data: summary } = await supabaseAdmin
    .from('payroll_employee_summaries')
    .select('*')
    .eq('sheet_id', sheetId)
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (!summary) {
    return NextResponse.json(
      { success: false, error: 'Sem resumo calculado para este funcionário nesta sheet — rode o cálculo antes.' },
      { status: 404 },
    );
  }

  const { data: items } = await supabaseAdmin
    .from('payroll_sheet_items')
    .select('quantity, reference_value, calculated_value, payroll_codes(code, name, type)')
    .eq('sheet_id', sheetId)
    .eq('employee_id', employeeId);

  const empresaJoin = sheet.payroll_companies as { name: string; cnpj: string } | null;
  const deptJoin = emp.payroll_departments as { name: string } | null;

  const rubricas = (items ?? []).map((it) => {
    const code = it.payroll_codes as { code: string; name: string; type: string } | null;
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

  const dados: ContrachequeDados = {
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
      liquido:
        (Number(summary.total_earnings) || 0) -
        (Number(summary.total_deductions) || 0),
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

  return new NextResponse(renderContracheque(dados), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
