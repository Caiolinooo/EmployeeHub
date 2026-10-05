import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payroll/profiles
 * Lista os perfis de cálculo (payroll_calculation_profiles) que o motor
 * lê via rules JSONB (calculate + relatório operacional). Filtro companyId.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelPayroll(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    let query = supabaseAdmin
      .from('payroll_calculation_profiles')
      .select('id, name, description, company_id, rules, is_default, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar perfis de cálculo:', error);
      return NextResponse.json({ success: false, error: 'Erro ao buscar perfis de cálculo' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * PUT /api/payroll/profiles
 * Cria (sem id) ou atualiza (com id) um perfil de cálculo. O rules JSONB
 * segue o formato do seed: { inss: {enabled}, irrf: {enabled},
 * fgts: {enabled}, vale_transporte: {enabled, percentage, max_percentage_salary} }.
 * is_default=true desmarca os demais perfis da mesma empresa.
 */
export async function PUT(request: NextRequest) {
  try {
    const gate = await garantirNivelPayroll(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = (await request.json()) as {
      id?: string;
      name?: string;
      description?: string | null;
      companyId?: string;
      rules?: Record<string, unknown>;
      isDefault?: boolean;
      isActive?: boolean;
    };

    const name = body.name?.trim();
    const companyId = body.companyId?.trim();
    if (!name || !companyId) {
      return NextResponse.json(
        { success: false, error: 'name e companyId são obrigatórios' },
        { status: 400 },
      );
    }
    if (!body.rules || typeof body.rules !== 'object' || Array.isArray(body.rules)) {
      return NextResponse.json(
        { success: false, error: 'rules deve ser um objeto JSON' },
        { status: 400 },
      );
    }

    const registro = {
      name,
      description: body.description?.trim() || null,
      company_id: companyId,
      rules: body.rules,
      is_default: body.isDefault === true,
      is_active: body.isActive !== false,
    };

    if (registro.is_default) {
      // Um único perfil default por empresa: o motor lê is_default=true.
      let limpar = supabaseAdmin
        .from('payroll_calculation_profiles')
        .update({ is_default: false })
        .eq('company_id', companyId);
      if (body.id) limpar = limpar.neq('id', body.id);
      const { error: erroLimpar } = await limpar;
      if (erroLimpar) {
        console.error('Erro ao redefinir perfil default:', erroLimpar);
        return NextResponse.json({ success: false, error: 'Erro ao redefinir perfil padrão' }, { status: 500 });
      }
    }

    const consulta = body.id
      ? supabaseAdmin.from('payroll_calculation_profiles').update(registro).eq('id', body.id).select().single()
      : supabaseAdmin.from('payroll_calculation_profiles').insert(registro).select().single();

    const { data, error } = await consulta;
    if (error) {
      console.error('Erro ao salvar perfil de cálculo:', error);
      return NextResponse.json({ success: false, error: 'Erro ao salvar perfil de cálculo' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: body.id ? 'Perfil atualizado com sucesso' : 'Perfil criado com sucesso',
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
