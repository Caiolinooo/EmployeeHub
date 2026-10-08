import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/supabase';
import { NotificacoesAvaliacaoService } from '@/lib/services/notificacoes-avaliacao';

export const dynamic = 'force-dynamic';

/**
 * Rota para gerente aprovar avaliação
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);

    // Fallback: Tentar pegar do cookie se não vier no header (comum no front-end)
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value || null;
    }

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

    // Nota: A verificação de permissão é feita posteriormente checando avaliador_id

    const { id } = await params;
    const body = await request.json();
    const { comentario_avaliador, respostas } = body;

    console.log(`API approve: Aprovando avaliação ${id} por gerente ${payload.userId}`);

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

    if (
      avaliacao.avaliador_id !== payload.userId &&
      !(await canWithGrant(payload.userId, payload.role, ['avaliacao.approve_any'], 'admin'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Você não é o gerente responsável por esta avaliação' },
        { status: 403 }
      );
    }

    const updateData: any = {
      status: 'aprovada_aguardando_comentario',
      status_aprovacao: 'em_revisao',
      comentario_avaliador: comentario_avaliador || '',
      updated_at: new Date().toISOString()
    };

    // Salvar respostas completas do gerente (Q15-Q24)
    if (respostas) {
      updateData.respostas = {
        ...avaliacao.respostas,
        ...respostas
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Erro ao aprovar avaliação:', updateError);
      return NextResponse.json(
        { success: false, error: 'Erro ao aprovar avaliação' },
        { status: 500 }
      );
    }

    const { data: funcionario } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email')
      .eq('id', avaliacao.funcionario_id)
      .single();

    const { data: gerente } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email')
      .eq('id', payload.userId)
      .single();

    // Notificar funcionário para adicionar comentário final
    if (funcionario && gerente) {
      const { createEvaluationNotification } = await import('@/lib/evaluation-notifications');
      await createEvaluationNotification({
        userId: funcionario.id,
        type: 'evaluation_revised',
        evaluationId: avaliacao.id,
        managerName: `${gerente.first_name} ${gerente.last_name}`,
        employeeName: `${funcionario.first_name} ${funcionario.last_name}`
      });
      console.log(`Notificação enviada para funcionário ${funcionario.id} adicionar comentário final`);
    }

    return NextResponse.json({
      success: true,
      message: 'Avaliação aprovada. Aguardando comentário final do funcionário.',
      data: {
        id: avaliacao.id,
        status: 'aprovada_aguardando_comentario'
      }
    });
  } catch (error) {
    console.error('Erro ao aprovar avaliação:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
