import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { enviarPagamentoLote } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finOk, corpoJson } from '../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/pagamentos/lote {origemTipo:'payroll_sheet', origemId,
 * contaBancariaId, dataPrevista} — monta líquidos da folha approved|paid e
 * envia via adapter (§6).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const origemTipo = body.origemTipo === 'manual' ? 'manual' : 'payroll_sheet';
    const resultado = await enviarPagamentoLote(
      {
        origemTipo,
        origemId: body.origemId ? String(body.origemId) : undefined,
        contaBancariaId: String((body.contaBancariaId ?? body.conta_bancaria_id) || ''),
        dataPrevista: typeof body.dataPrevista === 'string' ? body.dataPrevista : undefined,
      },
      await atorDeUserId(gate.user.userId),
    );
    return finOk(resultado, 201);
  } catch (e) {
    return finErro(e);
  }
}
