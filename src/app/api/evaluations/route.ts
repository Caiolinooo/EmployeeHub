/**
 * API principal de avaliações - estrutura unificada
 * Substitui as APIs legadas de /api/avaliacao/ e /api/avaliacao-desempenho/
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { EvaluationService } from '@/lib/services/evaluation-service';
import { EvaluationWorkflowService } from '@/lib/services/evaluation-workflow-service';
import { CreateAvaliacaoData, AvaliacaoFilters, ApiResponse } from '@/lib/schemas/evaluation-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/evaluations
 * Listar avaliações com filtros e paginação
 */
export async function GET(request: NextRequest) {
  try {
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

    // Obter parâmetros da query
    const { searchParams } = new URL(request.url);

    // Filtros
    const filters: AvaliacaoFilters = {
      status: searchParams.get('status')?.split(',') as any,
      funcionario_id: searchParams.get('funcionario_id') || undefined,
      avaliador_id: searchParams.get('avaliador_id') || undefined,
      ciclo_id: searchParams.get('ciclo_id') || undefined,
      periodo: searchParams.get('periodo') || undefined,
      data_inicio: searchParams.get('data_inicio') || undefined,
      data_fim: searchParams.get('data_fim') || undefined
    };

    // Paginação
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Listar avaliações
    const result = await EvaluationService.listEvaluations(filters, { page, limit });

    return NextResponse.json(result, {
      status: result.success ? 200 : 500
    });

  } catch (error) {
    console.error('Erro na API de avaliações (GET):', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/evaluations
 * Criar nova avaliação
 */
export async function POST(request: NextRequest) {
  try {
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

    // Verificar permissões (apenas admin e manager podem criar)
    if (payload.role !== 'ADMIN' && payload.role !== 'MANAGER') {
      return NextResponse.json({
        success: false,
        error: 'Apenas administradores e gerentes podem criar avaliações'
      }, { status: 403 });
    }

    // Obter dados do corpo
    const data: CreateAvaliacaoData = await request.json();

    // Validar campos obrigatórios
    const requiredFields = ['ciclo_id', 'funcionario_id', 'avaliador_id', 'periodo'];
    const missingFields = requiredFields.filter(field => !data[field as keyof CreateAvaliacaoData]);

    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Campos obrigatórios não fornecidos',
        missing_fields: missingFields
      }, { status: 400 });
    }

    // Validar formato dos IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.funcionario_id)) {
      return NextResponse.json({
        success: false,
        error: 'ID do funcionário inválido'
      }, { status: 400 });
    }

    if (!uuidRegex.test(data.avaliador_id)) {
      return NextResponse.json({
        success: false,
        error: 'ID do avaliador inválido'
      }, { status: 400 });
    }

    // Criar avaliação
    const result = await EvaluationService.createEvaluation(data);

    // Enviar notificações se a criação foi bem-sucedida
    if (result.success && result.data) {
      try {
        await EvaluationWorkflowService.sendEvaluationNotifications(
          result.data.id,
          data.funcionario_id,
          data.avaliador_id
        );
        console.log('✅ Notificações de criação de avaliação enviadas');
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificações:', notificationError);
        // Não falhar a criação se as notificações falharem
      }
    }

    return NextResponse.json(result, {
      status: result.success ? 201 : 500
    });

  } catch (error) {
    console.error('Erro na API de avaliações (POST):', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}