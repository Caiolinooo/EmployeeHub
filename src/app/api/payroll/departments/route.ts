import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payroll/departments?companyId=&isActive=
 * Lista os departamentos (centros de custo) da folha. Espelho dos
 * gt_centros_custo ativos via scripts/sync-payroll-empresas.ts.
 * Resposta { success, data } — sem paginação (volume pequeno por empresa).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelPayroll(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const isActive = searchParams.get('isActive');

    let query = supabaseAdmin
      .from('payroll_departments')
      .select('id, company_id, code, name, description, is_active')
      .order('name', { ascending: true });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar departamentos da folha:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar departamentos'
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
