import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PayrollCode, PayrollApiResponse, PayrollPaginatedResponse } from '@/types/payroll';

/**
 * GET /api/payroll/codes
 * Lista todos os códigos de folha de pagamento
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');
    const isSystem = searchParams.get('isSystem');

    let query = supabaseAdmin
      .from('payroll_codes')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (type) {
      query = query.eq('type', type);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }
    if (isSystem !== null) {
      query = query.eq('is_system', isSystem === 'true');
    }

    // Aplicar paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Ordenar por tipo e código
    query = query.order('type', { ascending: true })
                 .order('code', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar códigos:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar códigos'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    const response: PayrollPaginatedResponse<PayrollCode> = {
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
 * POST /api/payroll/codes
 * Cria um novo código
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar dados obrigatórios
    if (!body.code || !body.type || !body.name) {
      return NextResponse.json({
        success: false,
        error: 'Código, tipo e nome são obrigatórios'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Verificar se código já existe para o tipo
    const { data: existingCode } = await supabaseAdmin
      .from('payroll_codes')
      .select('id')
      .eq('code', body.code)
      .eq('type', body.type)
      .single();

    if (existingCode) {
      return NextResponse.json({
        success: false,
        error: 'Código já existe para este tipo'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Criar código
    const { data, error } = await supabaseAdmin
      .from('payroll_codes')
      .insert([{
        code: body.code,
        type: body.type,
        name: body.name,
        description: body.description,
        calculation_type: body.calculationType || 'fixed',
        value: body.value || 0,
        formula: body.formula,
        legal_type: body.legalType,
        is_system: body.isSystem || false,
        is_active: body.isActive !== false
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar código:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar código'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Código criado com sucesso'
    } as PayrollApiResponse<PayrollCode>, { status: 201 });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}
