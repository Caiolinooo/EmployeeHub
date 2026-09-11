import { NextRequest, NextResponse } from 'next/server';
import {
  decidirAgendamento,
  loadAtorFromUserId,
} from '@/lib/gestao-tripulantes/aso-agendamento-service';
import {
  clientIpFromRequest,
  mensagemErroAsoLogisticaNegada,
  podeAprovarAsoLogistica,
  requireAsoAgendamentoAuth,
  resolveAuthUserId,
} from '@/lib/gestao-tripulantes/aso-agendamento-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;
    const userId = resolveAuthUserId(auth.payload!);
    if (!(await podeAprovarAsoLogistica(userId, auth.payload?.role))) {
      return NextResponse.json(
        { error: mensagemErroAsoLogisticaNegada('aprovar') },
        { status: 403 },
      );
    }
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const ator = await loadAtorFromUserId(userId);
    const data = await decidirAgendamento({
      id,
      acao: 'aprovar',
      signatureUrl: body.signature_url || body.assinatura_url || ator.signatureUrl,
      ator,
      ip: clientIpFromRequest(request),
    });
    return NextResponse.json({
      success: true,
      data,
      signatureHash: (data as { assinatura_hash?: string }).assinatura_hash,
      message: 'ASO aprovado e marcado na escala de controles DP e logística.',
    });
  } catch (error) {
    console.error('[ASO agendamento aprovar]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao aprovar agendamento' },
      { status: 500 },
    );
  }
}
