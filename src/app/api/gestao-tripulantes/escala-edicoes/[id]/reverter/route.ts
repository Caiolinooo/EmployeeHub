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
 * POST /api/gestao-tripulantes/escala-edicoes/[id]/reverter  { motivo }
 * Gate: isFechamentoRole. Reversão manual de qualquer edição aplicada +
 * status 'revertida' + nova linha de auditoria (operacao 'reversao').
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
        { error: 'Apenas gestores/administradores podem reverter edições da escala.' },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const motivo = String(body.motivo || '').trim();
    if (!motivo) {
      return NextResponse.json(
        { error: 'motivo é obrigatório para reverter uma edição.' },
        { status: 400 },
      );
    }

    const ator = await carregarAtorEscala(payload, request);
    const resultado: ResultadoReversao = await reverterEdicaoEscala({
      edicaoId: id,
      motivo,
      ator,
      operacao: 'reversao',
    });

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Edição revertida — escala devolvida ao estado anterior.',
      edicaoId: resultado.edicao.id,
      embarqueId: resultado.embarqueId,
      colaboradorId: resultado.colaboradorId,
      edicao: resultado.edicao,
    });
  } catch (error) {
    console.error('[API EscalaEdicoes Reverter]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reverter edição da escala' },
      { status: 500 },
    );
  }
}
