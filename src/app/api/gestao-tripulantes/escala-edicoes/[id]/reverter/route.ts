import { NextRequest, NextResponse } from 'next/server';
import { checkAclPermission, extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { resolveAuthUserId } from '@/lib/gestao-tripulantes/aso-agendamento-auth';
import { isFechamentoRole } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import {
  carregarAtorEscala,
  edicaoEhDoProprioAutorAplicada,
  reverterEdicaoEscala,
  type ResultadoReversao,
} from '@/lib/gestao-tripulantes/escala-audit-writer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/gestao-tripulantes/escala-edicoes/[id]/reverter  { motivo }
 *
 * Gates (v5.80):
 * - GESTOR (isFechamentoRole || ACL gestao-tripulantes:fechamento.revisao):
 *   reversão manual de qualquer edição aplicada;
 *   motivo obrigatório (400 sem ele).
 * - AUTODESFAZER: fora dos gestores, o AUTOR da edição (ator_id == usuário do
 *   JWT) pode desfazer a PRÓPRIA edição ainda 'aplicada' — motivo default
 *   'Desfazer pelo próprio autor' quando vazio. A exigência de "edição mais
 *   recente ainda 'aplicada' do embarque" é garantida pela guarda de
 *   SUPERSESSÃO dentro de reverterEdicaoEscala (409 se houver edição posterior
 *   aplicada — fail-closed, nada é sobrescrito).
 *
 * Efeito: rollback mecânico + status 'revertida' + revisada_* + nova linha de
 * auditoria (operacao 'reversao'). Guardas 409 existentes intactas.
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

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    let motivo = String(body.motivo || '').trim();

    const userId = resolveAuthUserId(payload);
    const liberado =
      isFechamentoRole(payload.role) ||
      (userId
        ? await checkAclPermission(
            userId,
            String(payload.role || '').toUpperCase(),
            'gestao-tripulantes',
            'fechamento.revisao',
          )
        : false);
    let autodesfazer = false;
    if (!liberado) {
      // Fora dos gestores: só o AUTOR desfaz a própria edição aplicada.
      const propria = await edicaoEhDoProprioAutorAplicada(id, userId);
      if (!propria) {
        return NextResponse.json(
          {
            error:
              'Apenas gestores/administradores podem reverter edições da escala — o autor só pode desfazer a própria edição mais recente.',
          },
          { status: 403 },
        );
      }
      autodesfazer = true;
      if (!motivo) motivo = 'Desfazer pelo próprio autor';
    } else if (!motivo) {
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
      message: autodesfazer
        ? 'Edição desfeita pelo próprio autor — escala devolvida ao estado anterior.'
        : 'Edição revertida — escala devolvida ao estado anterior.',
      autodesfazer,
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
