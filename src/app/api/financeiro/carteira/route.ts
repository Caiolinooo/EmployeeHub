import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { resolverEmpresaIdFiltro } from '../visao-geral/visao-geral';
import { montarCarteira } from './carteira';
import { finErro, finFail, finOk } from '../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/carteira?empresaId=&moeda=&ref=
 * Carteira de recebimentos: aging por faixas de 30/60/90 dias, percentual de
 * inadimplência e maiores devedores. `ref` (YYYY-MM-DD) fixa a data de
 * referência do aging (padrão: hoje); montagem em `./carteira`.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);

    const empresaFiltro = resolverEmpresaIdFiltro(searchParams.get('empresaId'));
    if (!empresaFiltro.ok) return finFail('empresaId inválido: informe um UUID ou "todas"', 400);

    const ref = searchParams.get('ref');
    if (ref && !/^\d{4}-\d{2}-\d{2}$/.test(ref)) return finFail('ref deve ser YYYY-MM-DD', 400);

    const moeda = (searchParams.get('moeda') || 'BRL').toUpperCase();
    const referencia = ref || new Date().toISOString().slice(0, 10);

    const resultado = await montarCarteira(supabaseAdmin, {
      empresaId: empresaFiltro.empresaId,
      moeda,
      referencia,
    });

    if (!resultado.ok) return finFail(resultado.error, resultado.status);
    return finOk(resultado.carteira);
  } catch (e) {
    return finErro(e);
  }
}
