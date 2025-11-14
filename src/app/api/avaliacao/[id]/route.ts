import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { 
  notifyEmployeeEvaluationCompleted,
  notifyManagerSelfEvaluationCompleted,
  notifyManagerEvaluationPending,
  notifyEmployeeEvaluationReturned,
  notifyManagerEvaluationRevised
} from '@/lib/evaluation-notifications';

/**
 * GET /api/avaliacao/[id]
 * Busca uma avaliação específica por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verificar autenticação via cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Usar instância síncrona do supabaseAdmin

    const { data: avaliacao, error } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select(`
        *,
        funcionario:users_unified!avaliacoes_desempenho_funcionario_id_fkey(id, name, email),
        avaliador:users_unified!avaliacoes_desempenho_avaliador_id_fkey(id, name, email),
        periodo:periodos_avaliacao(id, nome, data_inicio, data_fim)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar avaliação:', error);
      return NextResponse.json(
        { success: false, error: 'Avaliação não encontrada' },
        { status: 404 }
      );
    }

    // Verificar permissão: usuário deve ser o colaborador ou o avaliador
    const userId = decoded.userId;
    const isCollaborator = avaliacao.funcionario_id === userId;
    const isManager = avaliacao.avaliador_id === userId;

    if (!isCollaborator && !isManager) {
      return NextResponse.json(
        { success: false, error: 'Você não tem permissão para acessar esta avaliação' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: avaliacao,
      userId: userId // Adicionar userId na resposta
    });

  } catch (error: any) {
    console.error('Erro em GET /api/avaliacao/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/avaliacao/[id]
 * Atualiza uma avaliação (respostas e status)
 * 
 * Body: { respostas?: Record<string, any>, status?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verificar autenticação via cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;
    const body = await request.json();
    const { respostas, notas_gerente, status, solicitar_ajustes } = body;

    // Usar instância síncrona do supabaseAdmin

    // 1. Buscar avaliação atual
    const { data: avaliacaoAtual, error: fetchError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !avaliacaoAtual) {
      return NextResponse.json(
        { success: false, error: 'Avaliação não encontrada' },
        { status: 404 }
      );
    }

    // 2. Verificar permissão
    const isCollaborator = avaliacaoAtual.funcionario_id === userId;
    const isManager = avaliacaoAtual.avaliador_id === userId;

    if (!isCollaborator && !isManager) {
      return NextResponse.json(
        { success: false, error: 'Você não tem permissão para editar esta avaliação' },
        { status: 403 }
      );
    }

    // 2.1. Bloquear edição de avaliações concluídas
    if (avaliacaoAtual.status === 'concluida') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Esta avaliação já foi concluída e não pode mais ser editada',
          hint: 'Apenas administradores podem excluir avaliações concluídas'
        },
        { status: 400 }
      );
    }

    // 3. Validar transições de status
    const statusAtual = avaliacaoAtual.status;
    
    // Colaborador pode editar se status for: pendente, em_andamento, devolvida, aprovada_aguardando_comentario
    const statusEditaveisColaborador = ['pendente', 'em_andamento', 'devolvida', 'aprovada_aguardando_comentario'];
    if (isCollaborator && !isManager && !statusEditaveisColaborador.includes(statusAtual)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Você não pode mais editar esta avaliação',
          hint: 'A avaliação já foi enviada para aprovação do gerente'
        },
        { status: 400 }
      );
    }

    // Gerente só pode editar se status for aguardando_aprovacao ou aguardando_finalizacao
    if (isManager && !isCollaborator && !['aguardando_aprovacao', 'aguardando_finalizacao'].includes(statusAtual)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Esta avaliação ainda não está disponível para revisão gerencial',
          hint: statusAtual === 'pendente' || statusAtual === 'em_andamento'
            ? 'Aguardando o colaborador finalizar a autoavaliação'
            : 'A avaliação já foi concluída'
        },
        { status: 400 }
      );
    }

    // 4. Preparar atualização
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (respostas !== undefined) {
      // Mesclar respostas existentes com novas
      updateData.respostas = {
        ...avaliacaoAtual.respostas,
        ...respostas
      };
    }

    if (notas_gerente !== undefined) {
      // Mesclar notas do gerente existentes com novas
      updateData.notas_gerente = {
        ...avaliacaoAtual.notas_gerente,
        ...notas_gerente
      };
    }

    if (status !== undefined) {
      // Validar transições permitidas (status corretos do banco)
      const transicoesPermitidas: Record<string, string[]> = {
        'pendente': ['em_andamento', 'aguardando_aprovacao', 'cancelada'],
        'em_andamento': ['aguardando_aprovacao', 'cancelada'],
        'aguardando_aprovacao': ['aprovada_aguardando_comentario', 'devolvida', 'cancelada'],
        'aprovada_aguardando_comentario': ['aguardando_finalizacao', 'devolvida', 'cancelada'],
        'aguardando_finalizacao': ['concluida', 'devolvida', 'cancelada'],
        'devolvida': ['aguardando_aprovacao', 'cancelada'],
        'concluida': [], // Status final
        'cancelada': [] // Status final
      };

      if (
        statusAtual !== status &&
        (!transicoesPermitidas[statusAtual] || 
         !transicoesPermitidas[statusAtual].includes(status))
      ) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Transição de status inválida: ${statusAtual} → ${status}`,
            hint: `Transições permitidas: ${transicoesPermitidas[statusAtual]?.join(', ') || 'nenhuma'}`
          },
          { status: 400 }
        );
      }

      updateData.status = status;

      // Se status mudar para concluída, calcular nota final
      if (status === 'concluida') {
        const respostasCompletas = updateData.respostas || avaliacaoAtual.respostas;
        const notasGerenteCompletas = updateData.notas_gerente || avaliacaoAtual.notas_gerente || {};
        
        // Coletar notas das questões do gerente (Q15-Q17)
        const notasQuestoesGerente = Object.values(respostasCompletas)
          .map((r: any) => r.nota)
          .filter((n): n is number => typeof n === 'number' && n > 0);

        // Coletar notas do gerente para questões do colaborador (Q11-Q14)
        const notasAvaliacaoColaborador = Object.values(notasGerenteCompletas)
          .filter((n): n is number => typeof n === 'number' && n > 0);

        const todasNotas = [...notasQuestoesGerente, ...notasAvaliacaoColaborador];

        if (todasNotas.length > 0) {
          updateData.nota_final = (
            todasNotas.reduce((sum, n) => sum + n, 0) / todasNotas.length
          ).toFixed(2);
        }
      }
    }

    // 5. Atualizar avaliação
    const { data: avaliacaoAtualizada, error: updateError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar avaliação:', updateError);
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar avaliação' },
        { status: 500 }
      );
    }

    // 6. Enviar notificações baseadas na mudança de status
    if (status && status !== statusAtual) {
      try {
        // Buscar dados do colaborador e gerente para notificações
        const { data: employee } = await supabaseAdmin
          .from('users_unified')
          .select('id, name')
          .eq('id', avaliacaoAtualizada.funcionario_id)
          .single();

        const { data: manager } = await supabaseAdmin
          .from('users_unified')
          .select('id, name')
          .eq('id', avaliacaoAtualizada.avaliador_id)
          .single();

        // Notificar quando colaborador envia autoavaliação para aprovação
        if (status === 'aguardando_aprovacao' && manager && (statusAtual === 'pendente' || statusAtual === 'em_andamento')) {
          await notifyManagerSelfEvaluationCompleted(
            manager.id,
            avaliacaoAtualizada.id,
            employee?.name || 'Colaborador'
          );
        }

        // Notificar quando gerente devolve para ajustes
        if (status === 'devolvida' && employee) {
          await notifyEmployeeEvaluationReturned(
            employee.id,
            avaliacaoAtualizada.id,
            manager?.name || 'Gestor',
            avaliacaoAtualizada.respostas?.['Q15']?.comentario || ''
          );
        }

        // Notificar quando colaborador reenvia após ajustes
        if (status === 'aguardando_aprovacao' && manager && statusAtual === 'devolvida') {
          await notifyManagerEvaluationRevised(
            manager.id,
            avaliacaoAtualizada.id,
            employee?.name || 'Colaborador'
          );
        }

        // Notificar quando gerente finaliza a avaliação
        if (status === 'concluida' && employee) {
          await notifyEmployeeEvaluationCompleted(
            employee.id,
            avaliacaoAtualizada.id,
            manager?.name || 'Gestor'
          );
        }
      } catch (notificationError) {
        // Não bloquear a operação se notificação falhar
        console.error('Erro ao enviar notificação (não bloqueante):', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Avaliação atualizada com sucesso',
      data: avaliacaoAtualizada
    });

  } catch (error: any) {
    console.error('Erro em PATCH /api/avaliacao/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}
