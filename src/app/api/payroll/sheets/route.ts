import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PayrollSheet, PayrollSheetForm, PayrollApiResponse, PayrollPaginatedResponse } from '@/types/payroll';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payroll/sheets
 * Lista todas as folhas de pagamento
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const companyId = searchParams.get('companyId');
    const departmentId = searchParams.get('departmentId');
    const referenceMonth = searchParams.get('referenceMonth');
    const referenceYear = searchParams.get('referenceYear');
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('payroll_sheets')
      .select(`
        *,
        company:payroll_companies(*),
        department:payroll_departments(*)
      `, { count: 'exact' });

    // Aplicar filtros
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }
    if (referenceMonth) {
      query = query.eq('reference_month', parseInt(referenceMonth));
    }
    if (referenceYear) {
      query = query.eq('reference_year', parseInt(referenceYear));
    }
    if (status) {
      query = query.eq('status', status);
    }

    // Aplicar paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Ordenar por ano e mês (mais recente primeiro)
    query = query.order('reference_year', { ascending: false })
                 .order('reference_month', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar folhas:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar folhas de pagamento'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    const response: PayrollPaginatedResponse<PayrollSheet> = {
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}

/**
 * POST /api/payroll/sheets
 * Cria uma nova folha de pagamento
 */
export async function POST(request: NextRequest) {
  try {
    const body: PayrollSheetForm = await request.json();

    // Validar dados obrigatórios
    if (!body.companyId || !body.referenceMonth || !body.referenceYear || !body.periodStart || !body.periodEnd) {
      return NextResponse.json({
        success: false,
        error: 'Empresa, mês/ano de referência e período são obrigatórios'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Verificar se já existe folha para o mesmo período
    let existingQuery = supabaseAdmin
      .from('payroll_sheets')
      .select('id')
      .eq('company_id', body.companyId)
      .eq('reference_month', body.referenceMonth)
      .eq('reference_year', body.referenceYear);

    if (body.departmentId) {
      existingQuery = existingQuery.eq('department_id', body.departmentId);
    } else {
      existingQuery = existingQuery.is('department_id', null);
    }

    const { data: existingSheet } = await existingQuery.single();

    if (existingSheet) {
      return NextResponse.json({
        success: false,
        error: 'Já existe uma folha de pagamento para este período'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Contar funcionários ativos da empresa/departamento
    let employeeQuery = supabaseAdmin
      .from('payroll_employees')
      .select('id', { count: 'exact' })
      .eq('company_id', body.companyId)
      .eq('status', 'active');

    if (body.departmentId) {
      employeeQuery = employeeQuery.eq('department_id', body.departmentId);
    }

    const { count: employeeCount } = await employeeQuery;

    // Criar folha de pagamento
    const { data, error } = await supabaseAdmin
      .from('payroll_sheets')
      .insert([{
        company_id: body.companyId,
        department_id: body.departmentId,
        reference_month: body.referenceMonth,
        reference_year: body.referenceYear,
        period_start: body.periodStart,
        period_end: body.periodEnd,
        status: 'draft',
        total_employees: employeeCount || 0,
        notes: body.notes
      }])
      .select(`
        *,
        company:payroll_companies(*),
        department:payroll_departments(*)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar folha:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar folha de pagamento'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Folha de pagamento criada com sucesso'
    } as PayrollApiResponse<PayrollSheet>, { status: 201 });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}
