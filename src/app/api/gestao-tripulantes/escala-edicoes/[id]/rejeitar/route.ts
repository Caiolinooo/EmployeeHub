import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { isFechamentoRole } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import {
  carregarAtorEscala,
  reverterEdicaoEscala,
  type ResultadoReversao,
} from '@/lib/gestao-tripulantes/escala-audit-writer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/gestao-tripulantes/escala-edicoes/[id]/rejeitar  { motivo }
 * Gate: isFechamentoRole. Rollback automático da edição auditada +
 * status 'revertida' + nova linha de auditoria (operacao 'rejeicao').
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token =
      extractTokenFromHeader(authHeader) ||
      request.cookies.get('abzToken')?.value ||
      request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    if (!isFechamentoRole(payload.role)) {
      return NextResponse.json(
        { error: 'Apenas gestores/administradores podem rejeitar edições da escala.' },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const motivo = String(body.motivo || '').trim();
    if (!motivo) {
      return NextResponse.json(
        { error: 'motivo é obrigatório para rejeitar uma edição.' },
        { status: 400 },
      );
    }

    const ator = await carregarAtorEscala(payload, request);
    const resultado: ResultadoReversao = await reverterEdicaoEscala({
      edicaoId: id,
      motivo,
      ator,
      operacao: 'rejeicao',
    });

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Edição rejeitada e escala revertida ao estado anterior.',
      edicaoId: resultado.edicao.id,
      embarqueId: resultado.embarqueId,
      colaboradorId: resultado.colaboradorId,
      edicao: resultado.edicao,
    });
  } catch (error) {
    console.error('[API EscalaEdicoes Rejeitar]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao rejeitar edição da escala' },
      { status: 500 },
    );
  }
}
