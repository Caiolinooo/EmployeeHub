import { NextRequest, NextResponse } from 'next/server';
import { AvaliacaoWorkflowService } from '@/lib/services/avaliacao-workflow-service';
import { getCurrentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Obter detalhes de uma avaliação específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const avaliacaoId = params.id;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: 'Usuário não autenticado'
      }, { status: 401 });
    }

    // Buscar avaliação no banco
    const { data: avaliacao, error } = await (await import('@/lib/supabase')).supabase
      .from('avaliacoes_desempenho')
      .select(`
        *,
        ciclos_avaliacao (*),
        users_unified!avaliacoes_desempenho_funcionario_id_fkey (*),
        avaliador_users:users_unified!avaliacoes_desempenho_avaliador_id_fkey (*)
      `)
      .eq('id', avaliacaoId)
      .single();

    if (error || !avaliacao) {
      return NextResponse.json({
        success: false,
        error: 'Avaliação não encontrada'
      }, { status: 404 });
    }

    // Verificar permissão
    const isOwner = avaliacao.funcionario_id === currentUser.userId;
    const isEvaluator = avaliacao.avaliador_id === currentUser.userId;
    const isAdmin = currentUser.role === 'ADMIN';

    if (!isOwner && !isEvaluator && !isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para acessar esta avaliação'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: avaliacao
    });

  } catch (error: any) {
    console.error('❌ Erro ao obter avaliação:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Atualizar avaliação (salvar rascunho)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const avaliacaoId = params.id;
    const body = await request.json();
    const { acao, dados } = body;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: 'Usuário não autenticado'
      }, { status: 401 });
    }

    // Buscar avaliação para verificar permissão
    const { data: avaliacao, error } = await (await import('@/lib/supabase')).supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', avaliacaoId)
      .single();

    if (error || !avaliacao) {
      return NextResponse.json({
        success: false,
        error: 'Avaliação não encontrada'
      }, { status: 404 });
    }

    let success = false;

    switch (acao) {
      case 'salvar_autoavaliacao':
        // Verificar se é o dono da avaliação
        if (avaliacao.funcionario_id !== currentUser.userId && currentUser.role !== 'ADMIN') {
          return NextResponse.json({
            success: false,
            error: 'Sem permissão para salvar esta avaliação'
          }, { status: 403 });
        }

        success = await AvaliacaoWorkflowService.salvarAutoavaliacao(
          avaliacaoId,
          currentUser.userId,
          dados
        );
        break;

      case 'salvar_avaliacao_gerente':
        // Verificar se é o avaliador
        if (avaliacao.avaliador_id !== currentUser.userId && currentUser.role !== 'ADMIN') {
          return NextResponse.json({
            success: false,
            error: 'Sem permissão para salvar esta avaliação'
          }, { status: 403 });
        }

        success = await AvaliacaoWorkflowService.salvarAvaliacaoGerente(
          avaliacaoId,
          currentUser.userId,
          dados
        );
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação inválida'
        }, { status: 400 });
    }

    return NextResponse.json({
      success,
      message: success ? 'Avaliação salva com sucesso' : 'Erro ao salvar avaliação'
    });

  } catch (error: any) {
    console.error('❌ Erro ao atualizar avaliação:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Submeter, aprovar ou devolver avaliação
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const avaliacaoId = params.id;
    const body = await request.json();
    const { acao, dados } = body;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: 'Usuário não autenticado'
      }, { status: 401 });
    }

    // Buscar avaliação para verificar permissão
    const { data: avaliacao, error } = await (await import('@/lib/supabase')).supabase
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', avaliacaoId)
      .single();

    if (error || !avaliacao) {
      return NextResponse.json({
        success: false,
        error: 'Avaliação não encontrada'
      }, { status: 404 });
    }

    let success = false;

    switch (acao) {
      case 'submeter_colaborador':
        // Verificar se é o dono da avaliação
        if (avaliacao.funcionario_id !== currentUser.userId) {
          return NextResponse.json({
            success: false,
            error: 'Apenas o colaborador pode submeter sua própria avaliação'
          }, { status: 403 });
        }

        success = await AvaliacaoWorkflowService.submeterAvaliacaoColaborador(
          avaliacaoId,
          currentUser.userId,
          dados
        );
        break;

      case 'aprovar':
        // Verificar se é o avaliador
        if (avaliacao.avaliador_id !== currentUser.userId) {
          return NextResponse.json({
            success: false,
            error: 'Apenas o avaliador pode aprovar esta avaliação'
          }, { status: 403 });
        }

        success = await AvaliacaoWorkflowService.aprovarAvaliacao(
          avaliacaoId,
          currentUser.userId,
          dados
        );
        break;

      case 'devolver':
        // Verificar se é o avaliador
        if (avaliacao.avaliador_id !== currentUser.userId) {
          return NextResponse.json({
            success: false,
            error: 'Apenas o avaliador pode devolver esta avaliação'
          }, { status: 403 });
        }

        success = await AvaliacaoWorkflowService.devolverAvaliacao(
          avaliacaoId,
          currentUser.userId,
          dados
        );
        break;

      case 'reenviar':
        // Verificar se é o dono da avaliação
        if (avaliacao.funcionario_id !== currentUser.userId) {
          return NextResponse.json({
            success: false,
            error: 'Apenas o colaborador pode reenviar sua avaliação'
          }, { status: 403 });
        }

        success = await AvaliacaoWorkflowService.reenviarAvaliacao(
          avaliacaoId,
          currentUser.userId
        );
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação inválida'
        }, { status: 400 });
    }

    return NextResponse.json({
      success,
      message: success ? 'Operação realizada com sucesso' : 'Erro ao realizar operação'
    });

  } catch (error: any) {
    console.error('❌ Erro ao processar avaliação:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}