import { NextRequest, NextResponse } from 'next/server';
import { buscarAgendamentoPorId } from '@/lib/gestao-tripulantes/aso-agendamento-service';
import { requireAsoAgendamentoAuth } from '@/lib/gestao-tripulantes/aso-agendamento-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;
    const { id } = await context.params;
    const data = await buscarAgendamentoPorId(id);
    if (!data) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[ASO agendamento GET id]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar agendamento' },
      { status: 500 },
    );
  }
}
