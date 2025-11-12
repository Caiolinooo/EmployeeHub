/**
 * API para decisão do gerente sobre avaliação
 * POST /api/evaluations/[id]/decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { EvaluationService } from '@/lib/services/evaluation-service';
import { EvaluationWorkflowService } from '@/lib/services/evaluation-workflow-service';
import { DecisaoGerenteData } from '@/lib/schemas/evaluation-schemas';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/evaluations/[id]/decision
 * Decisão do gerente (aprovar/rejeitar/devolver)
 */
export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;

    // Validar formato do ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID da avaliação inválido'
      }, { status: 400 });
    }

    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token de autenticação necessário'
      }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Verificar permissões (appenas admin e manager podem tomar decisões)
    if (payload.role !== 'ADMIN' && payload.role !== 'MANAGER') {
      return NextResponse.json({
        success: false,
        error: 'Apenas administradores e gerentes podem tomar decisões sobre avaliações'
      }, { status: 403 });
    }

    // Obter dados do corpo
    const data: DecisaoGerenteData = await request.json();

    // Validar dados obrigatórios
    if (!data.acao) {
      return NextResponse.json({
        success: false,
        error: 'Ação é obrigatória'
      }, { status: 400 });
    }

    // Validar ação
    const validActions = ['approve', 'reject', 'return'];
    if (!validActions.includes(data.acao)) {
      return NextResponse.json({
        success: false,
        error: 'Ação inválida. Deve ser: approve, reject ou return'
      }, { status: 400 });
    }

    // Validar aprovação
    if (data.acao === 'approve' && !data.comentario_avaliador) {
      return NextResponse.json({
        success: false,
        error: 'Comentário do avaliador é obrigatório para aprovar'
      }, { status: 400 });
    }

    // Validar devolução
    if (data.acao === 'return' && !data.motivo_devolucao) {
      return NextResponse.json({
        success: false,
        error: 'Motivo da devolução é obrigatório'
      }, { status: 400 });
    }

    // Validar comentário do avaliador (pergunta 15)
    if (data.comentario_avaliador && data.comentario_avaliador.length > 2000) {
      return NextResponse.json({
        success: false,
        error: 'Comentário do avaliador deve ter no máximo 2000 caracteres'
      }, { status: 400 });
    }

    // Validar motivo da devolução
    if (data.motivo_devolucao && data.motivo_devolucao.length > 500) {
      return NextResponse.json({
        success: false,
        error: 'Motivo da devolução deve ter no máximo 500 caracteres'
      }, { status: 400 });
    }

    // Verificar se o usuário é o avaliador desta avaliação
    // TODO: Implementar validação de permissões específicas
    // if (payload.userId !== avaliacao.avaliador_id && payload.role !== 'ADMIN') {
    //   return NextResponse.json({
    //     success: false,
    //     error: 'Apenas o avaliador designado pode tomar decisões'
    //   }, { status: 403 });
    // }

    // Adicionar ID da avaliação aos dados
    const completeData: DecisaoGerenteData = {
      ...data,
      avaliacao_id: id
    };

    // Processar decisão
    const result = await EvaluationService.managerDecision(completeData);

    // Enviar notificações sobre a decisão do gerente
    if (result.success) {
      try {
        // Buscar informações da avaliação para notificar o funcionário
        const evaluationDetails = await EvaluationService.getEvaluationDetails(evaluationId);

        if (evaluationDetails.success && evaluationDetails.data) {
          const avaliacao = evaluationDetails.data;

          // Enviar notificação ao funcionário sobre a decisão
          await EvaluationWorkflowService.sendDecisionNotifications(
            evaluationId,
            data.decisao,
            data.motivo_devolucao
          );
          console.log(`✅ Notificação de decisão (${data.decisao}) enviada ao funcionário`);
        }
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação de decisão:', notificationError);
        // Não falhar a decisão se a notificação falhar
      }
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 500
    });

  } catch (error) {
    console.error('Erro na API de decisão do gerente (POST):', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}