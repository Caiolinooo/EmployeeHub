import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { montarBankContext, importarConciliacoes, FinanceiroHttpError } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finFail, finOk, corpoJson, texto } from '../../_lib/http';
import type { ConciliacaoMovimento } from '@/lib/financeiro/banks/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/conciliacoes/importar {contaBancariaId, de, ate}
 * — adapter.listarConciliacao → fin_conciliacoes + casamento automático
 * txid/nossoNumero/valor+data → cobrança `liquidada` (§6).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const contaBancariaId = texto(body.contaBancariaId ?? body.conta_bancaria_id);
    const de = texto(body.de);
    const ate = texto(body.ate);
    if (!contaBancariaId || !de || !ate) return finFail('contaBancariaId, de e ate são obrigatórios', 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
      return finFail('de/ate devem ser YYYY-MM-DD', 400);
    }

    const { data: conta } = await supabaseAdmin
      .from('fin_contas_bancarias')
      .select('integracao_id')
      .eq('id', contaBancariaId)
      .maybeSingle();
    const integracaoId = (conta as { integracao_id: string | null } | null)?.integracao_id;
    if (!integracaoId) return finFail('Conta bancária sem integração de banco vinculada', 400);

    const { ctx, adapter } = await montarBankContext(integracaoId);
    let movimentos: ConciliacaoMovimento[];
    try {
      movimentos = await adapter.listarConciliacao(ctx, { de, ate });
    } catch (e) {
      if (e instanceof FinanceiroHttpError) throw e;
      throw new FinanceiroHttpError(502, 'banco_indisponivel', `Falha ao listar extrato: ${(e as Error).message}`);
    }

    const resultado = await importarConciliacoes(
      { contaBancariaId, movimentos, origem: 'api' },
      await atorDeUserId(gate.user.userId),
    );
    return finOk(resultado);
  } catch (e) {
    return finErro(e);
  }
}
