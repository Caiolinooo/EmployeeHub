import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, paginacao } from '../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/eventos?entidade=&entidadeId=&page= — trilha fin_eventos (gate view). */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { page, limit, from, to } = paginacao(request.url);
    let query = supabaseAdmin
      .from('fin_eventos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    const entidade = searchParams.get('entidade');
    if (entidade) query = query.eq('entidade', entidade);
    const entidadeId = searchParams.get('entidadeId');
    if (entidadeId) query = query.eq('entidade_id', entidadeId);
    const tipo = searchParams.get('tipo');
    if (tipo) query = query.eq('tipo', tipo);

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
