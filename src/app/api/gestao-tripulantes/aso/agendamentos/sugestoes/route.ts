import { NextRequest, NextResponse } from 'next/server';
import {
  gerarSugestoesEmLote,
  sugerirDatasParaColaborador,
  upsertSugestao,
} from '@/lib/gestao-tripulantes/aso-agendamento-service';
import { requireAsoAgendamentoAuth } from '@/lib/gestao-tripulantes/aso-agendamento-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;

    const colaboradorId = new URL(request.url).searchParams.get('colaborador_id');
    const dataValidade = new URL(request.url).searchParams.get('data_validade');
    if (!colaboradorId) {
      return NextResponse.json({ error: 'colaborador_id é obrigatório' }, { status: 400 });
    }

    const result = await sugerirDatasParaColaborador({
      colaboradorId,
      dataValidade,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[ASO sugestões GET]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao sugerir datas de ASO' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const colaboradorId = body.colaborador_id as string | undefined;

    if (colaboradorId) {
      const result = await sugerirDatasParaColaborador({
        colaboradorId,
        dataValidade: body.data_validade,
      });
      const row = await upsertSugestao({
        colaboradorId,
        documentoAsoId: body.documento_aso_id || null,
        dataValidade: body.data_validade || result.data_validade,
        sugestoes: result.sugestoes,
      });
      return NextResponse.json({ success: true, data: row, ...result });
    }

    const stats = await gerarSugestoesEmLote();
    return NextResponse.json({
      success: true,
      message: `Sugestões geradas: ${stats.gerados} novas, ${stats.atualizados} atualizadas, ${stats.ignorados} ignoradas.`,
      ...stats,
    });
  } catch (error) {
    console.error('[ASO sugestões POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar sugestões de ASO' },
      { status: 500 },
    );
  }
}
