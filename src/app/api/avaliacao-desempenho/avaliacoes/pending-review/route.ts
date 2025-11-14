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

    console.log(`API pending-review: Buscando avaliações pendentes para gerente ${payload.userId}`);

    // Buscar avaliações aguardando aprovação do gerente (direto da tabela, não da view)
    const { data: avaliacoes, error } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('*')
      .eq('avaliador_id', payload.userId)
      .eq('status', 'aguardando_aprovacao')
      .order('created_at', { ascending: false });

    console.log(`Encontradas ${avaliacoes?.length || 0} avaliações pendentes`);

    if (error) {
      console.error('Erro ao buscar avaliações pendentes:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar avaliações pendentes' },
        { status: 500 }
      );
    }

    const count = avaliacoes?.length || 0;
    console.log(`Retornando ${count} avaliações pendentes`);

    return NextResponse.json({
      success: true,
      data: avaliacoes || [],
      count
    });
  } catch (error) {
    console.error('Erro ao buscar avaliações pendentes:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
