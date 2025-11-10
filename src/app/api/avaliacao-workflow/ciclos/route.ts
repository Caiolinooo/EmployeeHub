import { NextRequest, NextResponse } from 'next/server';
import { AvaliacaoWorkflowService } from '@/lib/services/avaliacao-workflow-service';

export const dynamic = 'force-dynamic';

/**
 * Listar ciclos de avaliação
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get('ano');
    const status = searchParams.get('status');

    let query = 'SELECT * FROM ciclos_avaliacao';
    const params: any[] = [];
    const conditions: string[] = [];

    if (ano) {
      conditions.push('ano = ?');
      params.push(parseInt(ano));
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY ano DESC, created_at DESC';

    // Aqui usaria o cliente Supabase para executar a query
    // Por enquanto, retorna dados de exemplo
    const ciclosExemplo = [
      {
        id: '1',
        ano: 2025,
        nome: 'Ciclo de Avaliação 2025',
        descricao: 'Avaliação de desempenho anual - 2025',
        status: 'aberto',
        data_inicio: '2025-01-01T00:00:00.000Z',
        data_fim: '2025-03-31T23:59:59.999Z',
        created_at: '2025-01-01T00:00:00.000Z'
      }
    ];

    return NextResponse.json({
      success: true,
      data: ciclosExemplo
    });

  } catch (error: any) {
    console.error('❌ Erro ao listar ciclos:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Criar novo ciclo de avaliação
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ano, nome, descricao, dataInicio, dataFim } = body;

    if (!ano) {
      return NextResponse.json({
        success: false,
        error: 'Ano é obrigatório'
      }, { status: 400 });
    }

    // Criar ciclo através do serviço
    const cicloId = await AvaliacaoWorkflowService.abrirCicloAnual(ano, {
      nome,
      descricao,
      data_inicio: dataInicio,
      data_fim: dataFim
    });

    return NextResponse.json({
      success: true,
      data: {
        id: cicloId,
        message: 'Ciclo criado com sucesso'
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar ciclo:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}