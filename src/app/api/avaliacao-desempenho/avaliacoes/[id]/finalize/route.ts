import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { notifyEmployeeEvaluationCompleted } from '@/lib/evaluation-notifications';

export const dynamic = 'force-dynamic';

/**
 * POST - Gerente finaliza avaliação após comentário final do funcionário
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
        { success: false, error: 'Apenas gerentes podem finalizar avaliações' },
        { status: 403 }
      );
    }

    const { id } = await params;

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
        { success: false, error: 'Você não é o gerente desta avaliação' },
        { status: 403 }
      );
    }

    if (avaliacao.status !== 'aguardando_finalizacao') {
      return NextResponse.json(
        { success: false, error: 'Esta avaliação não está pronta para finalização' },
        { status: 400 }
      );
    }

    // Calcular nota final
    const respostas = avaliacao.respostas || {};
    const notasGerente = avaliacao.notas_gerente || {};
    
    const notasQuestoesGerente = Object.values(respostas)
      .map((r: any) => r?.nota)
      .filter((n): n is number => typeof n === 'number' && n > 0);

    const notasAvaliacaoColaborador = Object.values(notasGerente)
      .filter((n): n is number => typeof n === 'number' && n > 0);

    const todasNotas = [...notasQuestoesGerente, ...notasAvaliacaoColaborador];
    const nota_final = todasNotas.length > 0
      ? (todasNotas.reduce((sum, n) => sum + n, 0) / todasNotas.length).toFixed(2)
      : null;

    const { error: updateError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update({
        status: 'concluida',
        status_aprovacao: 'aprovada',
        nota_final,
        data_aprovacao: new Date().toISOString(),
        aprovado_por: payload.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Erro ao finalizar avaliação:', updateError);
      return NextResponse.json(
        { success: false, error: 'Erro ao finalizar avaliação' },
        { status: 500 }
      );
    }

    const { data: gerente } = await supabaseAdmin
      .from('users_unified')
      .select('first_name, last_name')
      .eq('id', payload.userId)
      .single();

    if (gerente) {
      await notifyEmployeeEvaluationCompleted(
        avaliacao.funcionario_id,
        avaliacao.id,
        `${gerente.first_name} ${gerente.last_name}`
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Avaliação finalizada com sucesso',
      data: {
        id: avaliacao.id,
        status: 'concluida',
        nota_final
      }
    });
  } catch (error) {
    console.error('Erro ao finalizar avaliação:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
