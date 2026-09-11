import { NextRequest, NextResponse } from 'next/server';
import {
  getAsoAgendamentoConfig,
  saveAsoAgendamentoConfig,
  type AsoAgendamentoConfig,
} from '@/lib/gestao-tripulantes/aso-agendamento-config';
import {
  isLogisticaRole,
  requireAsoAgendamentoAuth,
} from '@/lib/gestao-tripulantes/aso-agendamento-auth';
import { listarGestoresPortal } from '@/lib/gestao-tripulantes/fechamento-gestores';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;

    const config = await getAsoAgendamentoConfig();
    const availableManagers = await listarGestoresPortal();

    return NextResponse.json({
      success: true,
      config,
      availableManagers,
    });
  } catch (error) {
    console.error('[ASO agendamento config GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar configuração de ASO' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;
    if (!isLogisticaRole(auth.payload?.role)) {
      return NextResponse.json(
        { error: 'Apenas administradores e gestores podem alterar a antecedência de ASO.' },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Partial<AsoAgendamentoConfig>;
    const config = await saveAsoAgendamentoConfig(body);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('[ASO agendamento config PUT]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao salvar configuração de ASO' },
      { status: 500 },
    );
  }
}
