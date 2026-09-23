import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { atualizarCobranca } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finOk } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

/** POST /api/financeiro/cobrancas/[id]/atualizar — reconsulta adapter → status (§6). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const cobranca = await atualizarCobranca(id, await atorDeUserId(gate.user.userId));
    return finOk(cobranca);
  } catch (e) {
    return finErro(e);
  }
}
