import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Buscar usuário pelo token
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('email_verification_token', token)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Token inválido ou já utilizado' },
        { status: 400 }
      );
    }

    // Verificar expiração (24h) com base no updated_at quando o token foi emitido
    const tokenCreatedAt = new Date(user.updated_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - tokenCreatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      return NextResponse.json(
        { error: 'Token expirado. Solicite um novo link de verificação.' },
        { status: 400 }
      );
    }

    // Gerar hash
    const hashed = await bcrypt.hash(password, 10);

    // Montar histórico de acesso
    const accessHistory = Array.isArray(user.access_history) ? [...user.access_history] : [];
    accessHistory.push({
      timestamp: now.toISOString(),
      action: 'PASSWORD_SET_AFTER_EMAIL_VERIFICATION',
      details: 'Senha definida via link de verificação de email'
    });

    // Atualizar usuário: definir senha e limpar token
    const { error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        password: hashed, // compat
        password_hash: hashed,
        password_last_changed: now.toISOString(),
        email_verified: true,
        active: true,
        authorization_status: 'active',
        email_verification_token: null,
        updated_at: now.toISOString(),
        access_history: accessHistory
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Erro ao definir senha por token:', updateError);
      return NextResponse.json(
        { error: 'Erro ao definir senha' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Senha definida com sucesso' });
  } catch (err) {
    console.error('Erro na API set-password-by-token:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
