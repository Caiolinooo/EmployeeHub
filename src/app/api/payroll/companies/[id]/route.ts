import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PayrollCompany, PayrollCompanyForm, PayrollApiResponse } from '@/types/payroll';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payroll/companies/[id]
 * Busca uma empresa específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('payroll_companies')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Empresa não encontrada'
        } as PayrollApiResponse<null>, { status: 404 });
      }

      console.error('Erro ao buscar empresa:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar empresa'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data
    } as PayrollApiResponse<PayrollCompany>);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}

/**
 * PUT /api/payroll/companies/[id]
 * Atualiza uma empresa
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: PayrollCompanyForm = await request.json();

    // Validar dados obrigatórios
    if (!body.name || !body.cnpj) {
      return NextResponse.json({
        success: false,
        error: 'Nome e CNPJ são obrigatórios'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Verificar se CNPJ já existe em outra empresa
    const { data: existingCompany } = await supabaseAdmin
      .from('payroll_companies')
      .select('id')
      .eq('cnpj', body.cnpj)
      .neq('id', params.id)
      .single();

    if (existingCompany) {
      return NextResponse.json({
        success: false,
        error: 'CNPJ já cadastrado em outra empresa'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Atualizar empresa
    const { data, error } = await supabaseAdmin
      .from('payroll_companies')
      .update({
        name: body.name,
        cnpj: body.cnpj,
        address: body.address,
        phone: body.phone,
        email: body.email,
        contact_person: body.contactPerson,
        is_active: body.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Empresa não encontrada'
        } as PayrollApiResponse<null>, { status: 404 });
      }

      console.error('Erro ao atualizar empresa:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar empresa'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Empresa atualizada com sucesso'
    } as PayrollApiResponse<PayrollCompany>);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}

/**
 * DELETE /api/payroll/companies/[id]
 * Remove uma empresa
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se existem funcionários vinculados
    const { data: employees } = await supabaseAdmin
      .from('payroll_employees')
      .select('id')
      .eq('company_id', params.id)
      .limit(1);

    if (employees && employees.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Não é possível excluir empresa com funcionários vinculados'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Verificar se existem folhas de pagamento vinculadas
    const { data: sheets } = await supabaseAdmin
      .from('payroll_sheets')
      .select('id')
      .eq('company_id', params.id)
      .limit(1);

    if (sheets && sheets.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Não é possível excluir empresa com folhas de pagamento vinculadas'
      } as PayrollApiResponse<null>, { status: 400 });
    }

    // Remover empresa
    const { error } = await supabaseAdmin
      .from('payroll_companies')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Erro ao remover empresa:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao remover empresa'
      } as PayrollApiResponse<null>, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Empresa removida com sucesso'
    } as PayrollApiResponse<null>);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    } as PayrollApiResponse<null>, { status: 500 });
  }
}
