import { NextRequest, NextResponse } from 'next/server';
import {
  cancelarAgendamento,
  buscarAgendamentoPorId,
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
    const { id } = await context.params;
    const atual = await buscarAgendamentoPorId(id);
    if (!atual) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    }
    const isOwner = String((atual as { solicitado_por_id?: string }).solicitado_por_id || '') === userId;
    if (!isOwner && !(await podeAprovarAsoLogistica(userId, auth.payload?.role))) {
      return NextResponse.json(
        { error: mensagemErroAsoLogisticaNegada('cancelar') },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const ator = await loadAtorFromUserId(userId);
    const data = await cancelarAgendamento({
      id,
      motivo: body.motivo || '',
      ator,
      ip: clientIpFromRequest(request),
    });

    return NextResponse.json({ success: true, data, message: 'Agendamento cancelado.' });
  } catch (error) {
    console.error('[ASO agendamento cancelar]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao cancelar agendamento' },
      { status: 500 },
    );
  }
}
