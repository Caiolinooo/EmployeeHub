/**
 * API para responder questionário de avaliação
 * POST /api/evaluations/[id]/questionnaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { EvaluationService } from '@/lib/services/evaluation-service';
import { EvaluationWorkflowService } from '@/lib/services/evaluation-workflow-service';
import { ResponderQuestionarioData } from '@/lib/schemas/evaluation-schemas';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/evaluations/[id]/questionnaire
 * Responder ao questionário (perguntas 11-15)
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

    // Obter dados do corpo
    const data: ResponderQuestionarioData = await request.json();

    // Validar dados obrigatórios
    if (!data.respostas || !Array.isArray(data.respostas)) {
      return NextResponse.json({
        success: false,
        error: 'Respostas são obrigatórias e devem ser um array'
      }, { status: 400 });
    }

    if (!data.respondente_tipo) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de respondente é obrigatório'
      }, { status: 400 });
    }

    // Validar respostas
    for (const resposta of data.respostas) {
      // Validar ID da pergunta (11-15)
      if (resposta.pergunta_id < 11 || resposta.pergunta_id > 15) {
        return NextResponse.json({
          success: false,
          error: 'ID da pergunta inválido. Deve estar entre 11 e 15'
        }, { status: 400 });
      }

      // Validar nota (1-5)
      if (resposta.nota < 1 || resposta.nota > 5) {
        return NextResponse.json({
          success: false,
          error: 'Nota deve estar entre 1 e 5'
        }, { status: 400 });
      }

      // Validar comentário (opcional)
      if (resposta.comentario && resposta.comentario.length > 2000) {
        return NextResponse.json({
          success: false,
          error: 'Comentário deve ter no máximo 2000 caracteres'
        }, { status: 400 });
      }
    }

    // Verificar se o usuário tem permissão para responder esta avaliação
    if (data.respondente_tipo === 'collaborator') {
      // TODO: Verificar se o usuário é o funcionário da avaliação
      // Implementar validação de permissões
    } else if (data.respondente_tipo === 'manager') {
      // TODO: Verificar se o usuário é o avaliador da avaliação
      // Implementar validação de permissões
    }

    // Adicionar ID da avaliação aos dados
    const completeData: ResponderQuestionarioData = {
      ...data,
      avaliacao_id: id
    };

    // Enviar respostas
    const result = await EvaluationService.submitQuestionnaire(completeData);

    // Enviar notificação ao gerente quando o colaborador responde o questionário
    if (result.success) {
      try {
        // Buscar informações da avaliação para notificar o gerente
        const evaluationDetails = await EvaluationService.getEvaluationDetails(evaluationId);

        if (evaluationDetails.success && evaluationDetails.data) {
          const avaliacao = evaluationDetails.data;

          // Se for resposta do colaborador, notificar o gerente
          if (completeData.respondente_tipo === 'collaborator') {
            await EvaluationWorkflowService.notifyManager(
              evaluationId,
              avaliacao.funcionario_id,
              avaliacao.avaliador_id
            );
            console.log('✅ Notificação enviada ao gerente sobre questionário respondido');
          }
        }
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação ao gerente:', notificationError);
        // Não falhar o envio do questionário se a notificação falhar
      }
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 500
    });

  } catch (error) {
    console.error('Erro na API de questionário (POST):', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}