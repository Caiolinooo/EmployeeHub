import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Hard Delete - Exclusão permanente de avaliação (APENAS ADMIN)
 * ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL e remove completamente do banco de dados
 */
export async function DELETE(
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

    // APENAS ADMIN pode fazer hard delete
    if (payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem excluir permanentemente avaliações' },
        { status: 403 }
      );
    }

    const { id } = await params;

    console.log(`⚠️ HARD DELETE: Admin ${payload.userId} excluindo permanentemente avaliação ${id}`);

    // Verificar se avaliação existe
    const { data: avaliacao, error: fetchError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('id, funcionario_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !avaliacao) {
      return NextResponse.json(
        { success: false, error: 'Avaliação não encontrada' },
        { status: 404 }
      );
    }

    // HARD DELETE - Remove permanentemente do banco
    const { error: deleteError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao excluir permanentemente avaliação:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Erro ao excluir avaliação' },
        { status: 500 }
      );
    }

    console.log(`✅ Avaliação ${id} excluída permanentemente do banco de dados`);

    return NextResponse.json({
      success: true,
      message: 'Avaliação excluída permanentemente com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir permanentemente avaliação:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
