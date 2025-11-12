/**
 * API de métricas das avaliações
 * GET /api/evaluations/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { EvaluationService } from '@/lib/services/evaluation-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/evaluations/metrics
 * Obter métricas e estatísticas das avaliações
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

    // Verificar permissões (apenas admin e manager podem ver métricas)
    if (payload.role !== 'ADMIN' && payload.role !== 'MANAGER') {
      return NextResponse.json({
        success: false,
        error: 'Apenas administradores e gerentes podem acessar métricas'
      }, { status: 403 });
    }

    // Obter parâmetros da query
    const { searchParams } = new URL(request.url);

    // Filtros para métricas
    const filters = {
      status: searchParams.get('status')?.split(',') || undefined,
      funcionario_id: searchParams.get('funcionario_id') || undefined,
      avaliador_id: searchParams.get('avaliador_id') || undefined,
      ciclo_id: searchParams.get('ciclo_id') || undefined,
      periodo: searchParams.get('periodo') || undefined,
      data_inicio: searchParams.get('data_inicio') || undefined,
      data_fim: searchParams.get('data_fim') || undefined
    };

    // Obter métricas
    const result = await EvaluationService.getMetrics(filters);

    return NextResponse.json(result, {
      status: result.success ? 200 : 500
    });

  } catch (error) {
    console.error('Erro na API de métricas (GET):', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
