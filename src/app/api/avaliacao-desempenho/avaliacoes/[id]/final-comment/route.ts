import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createEvaluationNotification } from '@/lib/evaluation-notifications';

export const dynamic = 'force-dynamic';

/**
 * POST - Funcionário adiciona comentário final após aprovação do gerente
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { comentario_final } = body;

    if (!comentario_final || comentario_final.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comentário final é obrigatório' },
        { status: 400 }
      );
    }

    const { data: avaliacao, error: fetchError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !avaliacao) {
      return NextResponse.json(
        { success: false, error: 'Avaliação não encontrada' },
        { status: 404 }
      );
    }

    if (avaliacao.funcionario_id !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Você não é o funcionário desta avaliação' },
        { status: 403 }
      );
    }

    if (avaliacao.status !== 'aprovada_aguardando_comentario') {
      return NextResponse.json(
        { success: false, error: 'Esta avaliação não está aguardando seu comentário final' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update({
        comentario_final_funcionario: comentario_final,
        status: 'aguardando_finalizacao',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Erro ao salvar comentário final:', updateError);
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar comentário final' },
        { status: 500 }
      );
    }

    const { data: funcionario } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name')
      .eq('id', avaliacao.funcionario_id)
      .single();

    if (avaliacao.avaliador_id && funcionario) {
      await createEvaluationNotification({
        userId: avaliacao.avaliador_id,
        type: 'evaluation_revised',
        evaluationId: avaliacao.id,
        employeeName: `${funcionario.first_name} ${funcionario.last_name}`
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Comentário final enviado com sucesso',
      data: {
        id: avaliacao.id,
        status: 'aguardando_finalizacao'
      }
    });
  } catch (error) {
    console.error('Erro ao processar comentário final:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
