import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * API para validar token e redefinir senha
 */
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { success: false, message: 'Token e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: 'A senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    console.log(`🔄 Validando token de reset: ${token.substring(0, 8)}...`);

    // Buscar o token no banco
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select(`
        id,
        user_id,
        email,
        expires_at,
        used_at,
        created_at,
        users_unified (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('token', token)
      .single();

    if (tokenError || !resetToken) {
      console.log(`❌ Token não encontrado: ${token.substring(0, 8)}...`);
      return NextResponse.json(
        { success: false, message: 'Token inválido ou expirado' },
        { status: 400 }
      );
    }

    // Verificar se o token já foi usado
    if (resetToken.used_at) {
      console.log(`❌ Token já foi usado: ${token.substring(0, 8)}...`);
      return NextResponse.json(
        { success: false, message: 'Este link de redefinição já foi utilizado' },
        { status: 400 }
      );
    }

    // Verificar se o token expirou
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    
    if (now > expiresAt) {
      console.log(`❌ Token expirado: ${token.substring(0, 8)}... (expirou em ${expiresAt})`);
      return NextResponse.json(
        { success: false, message: 'Este link de redefinição expirou. Solicite um novo link.' },
        { status: 400 }
      );
    }

    const user = resetToken.users_unified as any;
    if (!user) {
      console.log(`❌ Usuário não encontrado para o token: ${token.substring(0, 8)}...`);
      return NextResponse.json(
        { success: false, message: 'Usuário não encontrado' },
        { status: 400 }
      );
    }

    console.log(`✅ Token válido para usuário: ${user.email}`);

    // Gerar hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Atualizar a senha do usuário
    const { error: updateError } = await supabase
      .from('users_unified')
      .update({
        password_hash: hashedPassword,
        password: hashedPassword, // Manter compatibilidade
        password_last_changed: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar senha:', updateError);
      return NextResponse.json(
        { success: false, message: 'Erro ao atualizar senha' },
        { status: 500 }
      );
    }

    // Marcar o token como usado
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({
        used_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', resetToken.id);

    if (markUsedError) {
      console.error('❌ Erro ao marcar token como usado:', markUsedError);
      // Não falhar a operação por causa disso
    }

    // Registrar no histórico de acesso
    const { data: currentUser } = await supabase
      .from('users_unified')
      .select('access_history')
      .eq('id', user.id)
      .single();

    const accessHistory = currentUser?.access_history || [];
    
    await supabase
      .from('users_unified')
      .update({
        access_history: [
          ...accessHistory,
          {
            timestamp: now.toISOString(),
            action: 'PASSWORD_RESET_COMPLETED',
            details: 'Senha redefinida via link de email',
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown'
          }
        ]
      })
      .eq('id', user.id);

    console.log(`✅ Senha redefinida com sucesso para: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso! Você pode fazer login com sua nova senha.'
    });

  } catch (error) {
    console.error('❌ Erro no reset de senha:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * API para validar se um token é válido (GET)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { valid: false, message: 'Token não fornecido' },
        { status: 400 }
      );
    }

    console.log(`🔄 Validando token: ${token.substring(0, 8)}...`);

    // Buscar o token no banco
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select(`
        id,
        email,
        expires_at,
        used_at,
        created_at,
        users_unified (
          email,
          first_name
        )
      `)
      .eq('token', token)
      .single();

    if (tokenError || !resetToken) {
      return NextResponse.json({
        valid: false,
        message: 'Token inválido'
      });
    }

    // Verificar se já foi usado
    if (resetToken.used_at) {
      return NextResponse.json({
        valid: false,
        message: 'Este link já foi utilizado'
      });
    }

    // Verificar se expirou
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    
    if (now > expiresAt) {
      return NextResponse.json({
        valid: false,
        message: 'Este link expirou'
      });
    }

    const user = resetToken.users_unified as any;

    return NextResponse.json({
      valid: true,
      email: resetToken.email,
      userName: user?.first_name || 'Usuário'
    });

  } catch (error) {
    console.error('❌ Erro na validação do token:', error);
    return NextResponse.json(
      { valid: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
