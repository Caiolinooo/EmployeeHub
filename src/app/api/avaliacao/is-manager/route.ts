import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyRequestToken, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Tentar pegar token do header Authorization
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyToken(token);
      if (payload?.userId) {
        userId = payload.userId;
      }
    }

    // Fallback: tentar via cookies
    if (!userId) {
      const authResult = await verifyRequestToken(request);
      if (authResult?.user) {
        userId = authResult.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated', data: null },
        { status: 401 }
      );
    }

    console.log(`🔍 is-manager: Verificando userId ${userId}`);

    const { data, error } = await supabaseAdmin
      .from('avaliacao_colaborador_gerente')
      .select('id')
      .eq('gerente_id', userId)
      .limit(1);

    console.log(`🔍 is-manager: Query result:`, { data, error });

    if (error) {
      console.error('Erro ao verificar se usuário é gerente no módulo de avaliação:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao verificar permissão', data: null },
        { status: 500 }
      );
    }

    const isManager = !!data && data.length > 0;
    console.log(`✅ is-manager: userId ${userId} is manager: ${isManager}`);

    return NextResponse.json({
      success: true,
      error: null,
      data: { isManager },
    });
  } catch (error) {
    console.error('Erro inesperado na verificação de gerente do módulo de avaliação:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao verificar permissão', data: null },
      { status: 500 }
    );
  }
}
