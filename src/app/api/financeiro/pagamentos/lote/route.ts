import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { enviarPagamentoLote } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finFail, finOk, corpoJson, texto } from '../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/pagamentos/lote {origemId, contaBancariaId,
 * dataPrevista} — monta líquidos da folha approved|paid e envia via adapter (§6).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const origemId = texto(body.origemId ?? body.origem_id);
    const contaBancariaId = texto(body.contaBancariaId ?? body.conta_bancaria_id);
    if (!origemId || !contaBancariaId) return finFail('origemId e contaBancariaId são obrigatórios', 400);
    const resultado = await enviarPagamentoLote(
      {
        origemId,
        contaBancariaId,
        dataPrevista: typeof body.dataPrevista === 'string' ? body.dataPrevista : undefined,
      },
      await atorDeUserId(gate.user.userId),
    );
    return finOk(resultado, 201);
  } catch (e) {
    return finErro(e);
  }
}
