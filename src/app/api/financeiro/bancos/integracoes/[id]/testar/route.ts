import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { montarBankContext, FinanceiroHttpError } from '@/lib/financeiro/service';
import { registrarEvento, atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finOk } from '../../../../_lib/http';
import { CapacidadeNaoSuportadaError } from '@/lib/financeiro/banks/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/bancos/integracoes/[id]/testar (gate admin) — chama
 * adapter.status(BankContext) e grava ultima_testagem. Resposta BankStatusResultado.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;
    const { id } = await params;

    const { ctx, adapter } = await montarBankContext(id);
    let resultado;
    try {
      resultado = await adapter.status(ctx);
    } catch (e) {
      const detalhe =
        e instanceof CapacidadeNaoSuportadaError || e instanceof FinanceiroHttpError
          ? e.message
          : `Falha no adapter: ${(e as Error).message}`;
      resultado = { ok: false, detalhe };
    }

    await supabaseAdmin
      .from('fin_integracoes_banco')
      .update({
        ultima_testagem: { em: new Date().toISOString(), ok: resultado.ok, detalhe: resultado.detalhe || null },
        status: resultado.ok ? 'ativa' : 'erro',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    await registrarEvento({
      entidade: 'integracao',
      entidadeId: id,
      tipo: resultado.ok ? 'integracao.teste_ok' : 'integracao.teste_erro',
      payload: { detalhe: resultado.detalhe || null },
      ator: await atorDeUserId(gate.user.userId),
    });
    return finOk(resultado);
  } catch (e) {
    return finErro(e);
  }
}
