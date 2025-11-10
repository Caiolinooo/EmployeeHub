import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obter a senha do corpo da requisição
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Senha não fornecida' }, { status: 400 });
    }

    // Buscar o usuário no Supabase
    const { data: userData, error: userError } = await supabase
      .from('users_unified')
      .select('email')
      .eq('id', payload.userId)
      .single();

    if (userError || !userData) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar a senha usando a API de autenticação do Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: password,
    });

    if (error) {
      console.error('Erro ao verificar senha:', error);
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Senha verificada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao verificar senha:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
