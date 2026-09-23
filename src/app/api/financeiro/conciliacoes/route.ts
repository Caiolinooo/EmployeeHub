import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, paginacao } from '../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/conciliacoes?contaBancariaId=&status=&de=&ate= (gate view). */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { page, limit, from, to } = paginacao(request.url);
    let query = supabaseAdmin
      .from('fin_conciliacoes')
      .select('*', { count: 'exact' })
      .order('data_movimento', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);
    const contaBancariaId = searchParams.get('contaBancariaId');
    if (contaBancariaId) query = query.eq('conta_bancaria_id', contaBancariaId);
    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);
    const de = searchParams.get('de');
    if (de) query = query.gte('data_movimento', de);
    const ate = searchParams.get('ate');
    if (ate) query = query.lte('data_movimento', ate);

    const { data, error, count } = await query;
    if (error) return finFail(error.message, 500);
    return finOk({
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    });
  } catch (e) {
    return finErro(e);
  }
}
