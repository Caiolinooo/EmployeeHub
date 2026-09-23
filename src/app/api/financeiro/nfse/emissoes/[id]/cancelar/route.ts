import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { cancelarNfse } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finOk, corpoJson } from '../../../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/nfse/emissoes/[id]/cancelar {motivo, codigoCancelamento?}
 * Só emissão `autorizado` (§5.2); volta fatura para `emitida`; grava
 * xml_cancelamento; evento nfse.cancelada.
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
    const motivo = typeof body.motivo === 'string' ? body.motivo : '';
    const codigoCancelamento = typeof body.codigoCancelamento === 'string' ? body.codigoCancelamento : undefined;
    const emissao = await cancelarNfse(id, motivo, codigoCancelamento, await atorDeUserId(gate.user.userId));
    return finOk(emissao);
  } catch (e) {
    return finErro(e);
  }
}
