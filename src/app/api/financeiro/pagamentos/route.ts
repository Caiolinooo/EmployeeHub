import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, paginacao } from '../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/pagamentos?origemTipo=&origemId=&status= (gate view). */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { page, limit, from, to } = paginacao(request.url);
    let query = supabaseAdmin
      .from('fin_pagamentos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    const origemTipo = searchParams.get('origemTipo');
    if (origemTipo) query = query.eq('origem_tipo', origemTipo);
    const origemId = searchParams.get('origemId');
    if (origemId) query = query.eq('origem_id', origemId);
    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);

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
