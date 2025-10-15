import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Extrair o token do cabeçalho
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      const res = NextResponse.json(
        { message: 'Logout realizado com sucesso' },
        { status: 200 }
      );
      res.cookies.set('token', '', { path: '/', maxAge: 0 });
      res.cookies.set('refreshToken', '', { path: '/', maxAge: 0 });
      return res;
    }

    // Verificar o token
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      const res = NextResponse.json(
        { message: 'Logout realizado com sucesso' },
        { status: 200 }
      );
      res.cookies.set('token', '', { path: '/', maxAge: 0 });
      res.cookies.set('refreshToken', '', { path: '/', maxAge: 0 });
      return res;
    }

    // Registrar logout e revogar refresh tokens no Supabase
    console.log('Registrando logout para o usuário:', payload.userId);

    try {
      // 1) Atualizar histórico de acesso em users_unified
      const { data: currentUser } = await supabaseAdmin
        .from('users_unified')
        .select('access_history, first_name')
        .eq('id', payload.userId)
        .single();

      const history = Array.isArray(currentUser?.access_history) ? currentUser!.access_history : [];
      const updatedHistory = [
        ...history,
        {
          timestamp: new Date().toISOString(),
          action: 'LOGOUT',
          details: 'Logout realizado via API'
        }
      ];

      await supabaseAdmin
        .from('users_unified')
        .update({ access_history: updatedHistory, updated_at: new Date().toISOString() })
        .eq('id', payload.userId);

      // 2) Revogar todos os refresh tokens ativos do usuário
      await supabaseAdmin
        .from('refresh_tokens')
        .update({ is_active: false })
        .eq('user_id', payload.userId)
        .eq('is_active', true);

      // 3) Limpar cookies no cliente (se estiverem sendo usados)
      const res = NextResponse.json(
        { message: 'Logout realizado com sucesso' },
        { status: 200 }
      );
      res.cookies.set('token', '', { path: '/', maxAge: 0 });
      res.cookies.set('refreshToken', '', { path: '/', maxAge: 0 });
      return res;
    } catch (error) {
      console.error('Erro ao registrar logout no Supabase:', error);
      const res = NextResponse.json(
        { message: 'Logout realizado com sucesso, mas houve um erro ao registrar' },
        { status: 200 }
      );
      res.cookies.set('token', '', { path: '/', maxAge: 0 });
      res.cookies.set('refreshToken', '', { path: '/', maxAge: 0 });
      return res;
    }
  } catch (error) {
    console.error('Erro ao processar logout:', error);
    return NextResponse.json(
      { message: 'Logout realizado com sucesso, mas houve um erro interno' },
      { status: 200 }
    );
  }
}
