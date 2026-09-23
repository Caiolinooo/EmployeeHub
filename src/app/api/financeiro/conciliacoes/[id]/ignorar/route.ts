import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { registrarEvento, atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finFail, finOk } from '../../../_lib/http';
import type { FinConciliacao } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

/** POST /api/financeiro/conciliacoes/[id]/ignorar — movimento `ignorado` (§6). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;

    const { data: movimentoRow } = await supabaseAdmin
      .from('fin_conciliacoes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!movimentoRow) return finFail('Movimento não encontrado', 404);
    const movimento = movimentoRow as FinConciliacao;
    if (movimento.status === 'conciliado') {
      return finFail('Movimento conciliado não pode ser ignorado — desvincule a cobrança primeiro', 409);
    }

    const { error } = await supabaseAdmin
      .from('fin_conciliacoes')
      .update({ status: 'ignorado' })
      .eq('id', id);
    if (error) return finFail(error.message, 500);

    await registrarEvento({
      entidade: 'conciliacao',
      entidadeId: id,
      tipo: 'conciliacao.ignorada',
      payload: { conta_bancaria_id: movimento.conta_bancaria_id },
      ator: await atorDeUserId(gate.user.userId),
    });
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
