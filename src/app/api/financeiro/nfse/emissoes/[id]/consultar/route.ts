import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { consultarNfse } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finOk } from '../../../../_lib/http';

export const dynamic = 'force-dynamic';

/** POST /api/financeiro/nfse/emissoes/[id]/consultar — estado atualizado no provider (§6). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const emissao = await consultarNfse(id, await atorDeUserId(gate.user.userId));
    return finOk(emissao);
  } catch (e) {
    return finErro(e);
  }
}
