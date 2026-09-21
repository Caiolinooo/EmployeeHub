import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dp/wk/colaboradores
 * Lista paginada de colaboradores da folha (SELECT em payroll_employees APENAS
 * — inclusive os vindos do sync WK; o casamento com gt_colaboradores é feito
 * por CPF no cliente). Query: ?page=1&limit=20&companyId=&departmentId=&status=&q=
 * Resposta: { success, data: { colaboradores }, total, page, limit }
 */
export async function GET(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'view');
  if (!gate.ok) return gate.error;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
    const companyId = searchParams.get('companyId');
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const busca = (searchParams.get('q') || '').trim().replace(/[,()%]/g, ' ').trim();

    let query = supabaseAdmin
      .from('payroll_employees')
      .select(
        'id, registration_number, name, cpf, position, base_salary, admission_date, termination_date, status',
        { count: 'exact' },
      );

    if (companyId) query = query.eq('company_id', companyId);
    if (departmentId) query = query.eq('department_id', departmentId);
    if (status && ['active', 'inactive', 'terminated'].includes(status)) {
      query = query.eq('status', status);
    }
    if (busca) {
      query = query.or(
        `name.ilike.%${busca}%,cpf.ilike.%${busca}%,registration_number.ilike.%${busca}%`,
      );
    }

    const from = (page - 1) * limit;
    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(from, from + limit - 1);
    if (error) throw new Error(`Falha ao listar payroll_employees: ${error.message}`);

    return NextResponse.json({
      success: true,
      data: { colaboradores: data || [] },
      total: count ?? 0,
      page,
      limit,
    });
  } catch (erro) {
    console.error('[dp/wk/colaboradores] erro:', erro);
    return NextResponse.json(
      { success: false, error: erro instanceof Error ? erro.message : 'Erro ao listar colaboradores da folha' },
      { status: 500 },
    );
  }
}
