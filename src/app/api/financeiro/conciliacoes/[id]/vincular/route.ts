import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { registrarEvento, atorDeUserId } from '@/lib/financeiro/eventos';
import { aposLiquidacaoVerificarFaturaPaga } from '@/lib/financeiro/service';
import { finErro, finFail, finOk, corpoJson, texto } from '../../../_lib/http';
import type { FinConciliacao } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/conciliacoes/[id]/vincular {cobrancaId} — movimento
 * `conciliado` + cobrança `liquidada` + evento (§6).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const body = await corpoJson(request);
    const cobrancaId = texto(body.cobrancaId ?? body.cobranca_id);
    if (!cobrancaId) return finFail('cobrancaId é obrigatório', 400);

    const { data: movimentoRow } = await supabaseAdmin
      .from('fin_conciliacoes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!movimentoRow) return finFail('Movimento não encontrado', 404);
    const movimento = movimentoRow as FinConciliacao;
    if (movimento.tipo !== 'credito') return finFail('Só crédito pode ser vinculado a cobrança', 409);
    if (movimento.status === 'ignorado') return finFail('Movimento ignorado não pode ser vinculado', 409);
    if (movimento.status === 'conciliado') {
      return finFail('Movimento já conciliado — desvincule antes de vincular a outra cobrança (review P1-7)', 409);
    }

    const { data: cobrancaRow } = await supabaseAdmin
      .from('fin_cobrancas')
      .select('id, status, conta_bancaria_id')
      .eq('id', cobrancaId)
      .maybeSingle();
    if (!cobrancaRow) return finFail('Cobrança não encontrada', 404);
    const cobranca = cobrancaRow as { id: string; status: string; conta_bancaria_id: string };
    if (cobranca.conta_bancaria_id !== movimento.conta_bancaria_id) {
      return finFail('Cobrança pertence a outra conta bancária', 409);
    }
    if (!['pendente', 'gerada'].includes(cobranca.status)) {
      return finFail(`Cobrança em status '${cobranca.status}' não pode ser liquidada`, 409);
    }

    const { error: errMov } = await supabaseAdmin
      .from('fin_conciliacoes')
      .update({ status: 'conciliado', cobranca_id: cobrancaId })
      .eq('id', id);
    if (errMov) return finFail(errMov.message, 500);
    const { error: errCob } = await supabaseAdmin
      .from('fin_cobrancas')
      .update({ status: 'liquidada', updated_at: new Date().toISOString() })
      .eq('id', cobrancaId);
    if (errCob) return finFail(errCob.message, 500);

    await registrarEvento({
      entidade: 'cobranca',
      entidadeId: cobrancaId,
      tipo: 'cobranca.liquidada',
      payload: { via: 'vincular_manual', movimento: id },
      ator: await atorDeUserId(gate.user.userId),
    });
    const { data: faturaIdRow } = await supabaseAdmin
      .from('fin_cobrancas')
      .select('fatura_id')
      .eq('id', cobrancaId)
      .maybeSingle();
    if (faturaIdRow && typeof faturaIdRow.fatura_id === 'string') {
      await aposLiquidacaoVerificarFaturaPaga(
        faturaIdRow.fatura_id,
        await atorDeUserId(gate.user.userId),
      );
    }
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
