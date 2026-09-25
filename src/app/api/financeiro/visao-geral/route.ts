import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro } from '../_lib/http';
import { montarVisaoGeral } from './visao-geral';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/visao-geral?competencia=YYYY-MM&empresaId=
 * KPIs do hub (§7.1 Aba Visão geral): faturas/NFS-e por status, cobranças
 * abertas, recebido no mês e folhas por status + lista de competências.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const resultado = await montarVisaoGeral(request, supabaseAdmin);
    return NextResponse.json(resultado.body, { status: resultado.status });
  } catch (e) {
    return finErro(e);
  }
}
