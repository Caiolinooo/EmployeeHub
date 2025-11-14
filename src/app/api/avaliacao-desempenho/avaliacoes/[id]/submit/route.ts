import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { NotificacoesAvaliacaoService } from '@/lib/services/notificacoes-avaliacao';

export const dynamic = 'force-dynamic';

/**
 * Rota para submeter avaliação do colaborador para revisão do gerente
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
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
    const { respostas } = body;

    console.log(`API submit: Submetendo avaliação ${id} por usuário ${payload.userId}`);

    // Buscar a avaliação
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

    // Verificar se o usuário é o funcionário da avaliação
    if (avaliacao.funcionario_id !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Você não tem permissão para submeter esta avaliação' },
        { status: 403 }
      );
    }

    // Preparar dados de atualização
    const updateData: any = {
      status: 'aguardando_aprovacao',
      data_autoavaliacao: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Se respostas foram fornecidas, salvar
    if (respostas) {
      updateData.respostas = {
        ...avaliacao.respostas,
        ...respostas
      };
    }

    // Atualizar status e respostas
    const { error: updateError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Erro ao atualizar status da avaliação:', updateError);
      return NextResponse.json(
        { success: false, error: 'Erro ao submeter avaliação' },
        { status: 500 }
      );
    }

    // Buscar informações do funcionário e gerente para notificação
    const { data: funcionario } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email')
      .eq('id', avaliacao.funcionario_id)
      .single();

    const { data: gerente } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email')
      .eq('id', avaliacao.avaliador_id)
      .single();

    // Enviar notificação para o gerente
    if (gerente && funcionario) {
      await NotificacoesAvaliacaoService.notificarAutoavaliacaoRecebida(
        gerente.id,
        avaliacao.id,
        `${funcionario.first_name} ${funcionario.last_name}`
      );
      console.log(`Notificação enviada para gerente ${gerente.id}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Avaliação submetida com sucesso para revisão do gerente',
      data: {
        id: avaliacao.id,
        status: 'aguardando_aprovacao'
      }
    });
  } catch (error) {
    console.error('Erro ao submeter avaliação:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
