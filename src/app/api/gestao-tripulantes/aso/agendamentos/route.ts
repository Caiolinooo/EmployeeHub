import { NextRequest, NextResponse } from 'next/server';
import {
  buscarAgendamentos,
  loadAtorFromUserId,
  solicitarAgendamento,
} from '@/lib/gestao-tripulantes/aso-agendamento-service';
import {
  clientIpFromRequest,
  requireAsoAgendamentoAuth,
  resolveAuthUserId,
} from '@/lib/gestao-tripulantes/aso-agendamento-auth';
import { isAsoAgendamentoStatus } from '@/lib/gestao-tripulantes/aso-agendamento-status';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const colaboradorId = searchParams.get('colaborador_id') || undefined;
    const statusRaw = searchParams.get('status') || '';
    const status = statusRaw
      .split(',')
      .map((s) => s.trim())
      .filter(isAsoAgendamentoStatus);
    const includeCancelados = searchParams.get('include_cancelados') === '1';

    const data = await buscarAgendamentos({
      colaboradorId,
      status: status.length > 0 ? status : undefined,
      includeCancelados,
    });

    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('[ASO agendamentos GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao listar agendamentos de ASO' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;
    const userId = resolveAuthUserId(auth.payload!);
    if (!userId) {
      return NextResponse.json({ error: 'Usuário do token não identificado' }, { status: 401 });
    }

    const body = await request.json();
    const colaboradorId = String(body.colaborador_id || '');
    const dataSolicitada = String(body.data_solicitada || body.data || '');
    if (!colaboradorId || !dataSolicitada) {
      return NextResponse.json(
        { error: 'colaborador_id e data_solicitada são obrigatórios' },
        { status: 400 },
      );
    }

    const ator = await loadAtorFromUserId(userId);
    const row = await solicitarAgendamento({
      colaboradorId,
      documentoAsoId: body.documento_aso_id || null,
      dataValidade: body.data_validade || null,
      dataSolicitada,
      observacoes: body.observacoes || '',
      signatureUrl: body.signature_url || body.assinatura_url || ator.signatureUrl,
      ator,
      ip: clientIpFromRequest(request),
    });

    return NextResponse.json({
      success: true,
      data: row,
      message: 'Solicitação enviada à logística (e-mail e notificação no portal).',
    });
  } catch (error) {
    console.error('[ASO agendamentos POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao solicitar agendamento de ASO' },
      { status: 500 },
    );
  }
}
