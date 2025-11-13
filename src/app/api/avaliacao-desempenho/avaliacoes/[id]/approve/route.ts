import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
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

    if (payload.role !== 'MANAGER' && payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Apenas gerentes e administradores podem aprovar avaliações' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { comentario_avaliador } = body;

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

    if (avaliacao.avaliador_id !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Você não é o gerente responsável por esta avaliação' },
        { status: 403 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update({
        status: 'concluida',
        status_aprovacao: 'aprovada',
        comentario_avaliador: comentario_avaliador || '',
        data_aprovacao: new Date().toISOString(),
        aprovado_por: payload.userId,
        updated_at: new Date().toISOString()
      })
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

    if (funcionario && gerente) {
      await NotificacoesAvaliacaoService.notificarAvaliacaoAprovada(
        funcionario.id,
        avaliacao.id,
        `${gerente.first_name} ${gerente.last_name}`,
        comentario_avaliador
      );
      console.log(`Notificação de aprovação enviada para funcionário ${funcionario.id}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Avaliação aprovada com sucesso',
      data: {
        id: avaliacao.id,
        status: 'concluida'
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
