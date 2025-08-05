import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PayrollCompany, PayrollCompanyForm, PayrollApiResponse, PayrollPaginatedResponse } from '@/types/payroll';

/**
 * GET /api/payroll/companies
 * Lista todas as empresas da folha de pagamento
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const name = searchParams.get('name');
    const cnpj = searchParams.get('cnpj');
    const isActive = searchParams.get('isActive');

    let query = supabaseAdminAdmin
      .from('payroll_companies')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (name) {
      query = query.ilike('name', `%${name}%`);
    }
    if (cnpj) {
      query = query.ilike('cnpj', `%${cnpj}%`);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    // Aplicar paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Ordenar por nome
    query = query.order('name', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar empresas:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar empresas'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    const response: PayrollPaginatedResponse<PayrollCompany> = {
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
 * POST /api/payroll/companies
 * Cria uma nova empresa
 */
export async function POST(request: NextRequest) {
  try {
    const body: PayrollCompanyForm = await request.json();

    // Validar dados obrigatórios
    if (!body.name || !body.cnpj) {
      return NextResponse.json({
        success: false,
        error: 'Nome e CNPJ são obrigatórios'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Verificar se CNPJ já existe
    const { data: existingCompany } = await supabaseAdmin
      .from('payroll_companies')
      .select('id')
      .eq('cnpj', body.cnpj)
      .single();

    if (existingCompany) {
      return NextResponse.json({
        success: false,
        error: 'CNPJ já cadastrado'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Criar empresa
    const { data, error } = await supabaseAdmin
      .from('payroll_companies')
      .insert([{
        name: body.name,
        cnpj: body.cnpj,
        address: body.address,
        phone: body.phone,
        email: body.email,
        contact_person: body.contactPerson,
        is_active: body.isActive
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar empresa:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar empresa'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Empresa criada com sucesso'
    } as PayrollApiResponse<PayrollCompany>, { status: 201 });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}
