import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Rota para listar avaliações pendentes de revisão do gerente
 */
export async function GET(request: NextRequest) {
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
        { success: false, error: 'Apenas gerentes e administradores podem acessar esta rota' },
        { status: 403 }
      );
    }

    console.log(`API pending-review: Buscando avaliações pendentes para gerente ${payload.userId}`);

    // Buscar avaliações aguardando aprovação do gerente
    const { data: avaliacoes, error } = await supabaseAdmin
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .eq('avaliador_id', payload.userId)
      .eq('status', 'aguardando_aprovacao')
      .order('data_autoavaliacao', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avaliações pendentes:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar avaliações pendentes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: avaliacoes || [],
      count: avaliacoes?.length || 0
    });
  } catch (error) {
    console.error('Erro ao buscar avaliações pendentes:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
