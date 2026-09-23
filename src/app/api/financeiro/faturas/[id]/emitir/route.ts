import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { emitirFatura } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finOk } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/faturas/[id]/emitir — fatura `rascunho` → `emitida`:
 * snapshot do cliente, data de emissão, evento fatura.emitida (§6).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const fatura = await emitirFatura(id, await atorDeUserId(gate.user.userId));
    return finOk(fatura);
  } catch (e) {
    return finErro(e);
  }
}
