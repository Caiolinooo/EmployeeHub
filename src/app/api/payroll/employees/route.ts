import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PayrollEmployee, PayrollEmployeeForm, PayrollApiResponse, PayrollPaginatedResponse } from '@/types/payroll';

/**
 * GET /api/payroll/employees
 * Lista todos os funcionários da folha de pagamento
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const companyId = searchParams.get('companyId');
    const departmentId = searchParams.get('departmentId');
    const name = searchParams.get('name');
    const position = searchParams.get('position');
    const status = searchParams.get('status');

    let query = supabase
      .from('payroll_employees')
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
    if (name) {
      query = query.ilike('name', `%${name}%`);
    }
    if (position) {
      query = query.ilike('position', `%${position}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // Aplicar paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Ordenar por nome
    query = query.order('name', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar funcionários:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar funcionários'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    const response: PayrollPaginatedResponse<PayrollEmployee> = {
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
 * POST /api/payroll/employees
 * Cria um novo funcionário
 */
export async function POST(request: NextRequest) {
  try {
    const body: PayrollEmployeeForm = await request.json();

    // Validar dados obrigatórios
    if (!body.name || !body.companyId || body.baseSalary === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Nome, empresa e salário base são obrigatórios'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Verificar se número de registro já existe na empresa
    if (body.registrationNumber) {
      const { data: existingEmployee } = await supabase
        .from('payroll_employees')
        .select('id')
        .eq('company_id', body.companyId)
        .eq('registration_number', body.registrationNumber)
        .single();

      if (existingEmployee) {
        return NextResponse.json({
          success: false,
          error: 'Número de registro já existe nesta empresa'
        } as PayrollApiResponse<null>, { status: 400 });
      }
    }

    // Criar funcionário
    const { data, error } = await supabase
      .from('payroll_employees')
      .insert([{
        employee_id: body.employeeId,
        company_id: body.companyId,
        department_id: body.departmentId,
        registration_number: body.registrationNumber,
        name: body.name,
        cpf: body.cpf,
        position: body.position,
        base_salary: body.baseSalary,
        admission_date: body.admissionDate,
        termination_date: body.terminationDate,
        status: body.status,
        bank_code: body.bankCode,
        bank_agency: body.bankAgency,
        bank_account: body.bankAccount,
        pis_pasep: body.pisPasep,
        dependents: body.dependents
      }])
      .select(`
        *,
        company:payroll_companies(*),
        department:payroll_departments(*)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar funcionário:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar funcionário'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Funcionário criado com sucesso'
    } as PayrollApiResponse<PayrollEmployee>, { status: 201 });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}
