import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk } from '../../_lib/http';
import type { FinMunicipiosResponse } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/nfse/municipios?uf=&busca=&page= — registry de municípios
 * (fin_municipios, seed IBGE + edições admin). {itens, total} (§6).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const uf = searchParams.get('uf');
    const busca = searchParams.get('busca');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('fin_municipios')
      .select('*', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(from, to);
    if (uf) query = query.eq('uf', uf.toUpperCase());
    if (busca) query = query.ilike('nome', `%${busca}%`);

    const { data, error, count } = await query;
    if (error) return finFail(error.message, 500);
    const resposta: FinMunicipiosResponse = { itens: (data || []) as FinMunicipiosResponse['itens'], total: count || 0 };
    return finOk({ ...resposta, page, limit, totalPages: Math.max(1, Math.ceil((count || 0) / limit)) });
  } catch (e) {
    return finErro(e);
  }
}
