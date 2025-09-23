import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { sendPasswordResetEmail } from '@/lib/auth';

/**
 * API para solicitar reset de senha
 * Gera um token único e envia por email
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 Solicitação de reset de senha para: ${email}`);

    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('id, email, first_name, email_verified')
      .eq('email', email.toLowerCase().trim())
      .single();

    // Por segurança, sempre retornar sucesso mesmo se o usuário não existir
    if (userError || !user) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.'
      });
    }

    // Verificar se o email foi verificado
    if (!user.email_verified) {
      console.log(`❌ Email não verificado: ${email}`);
      return NextResponse.json({
        success: false,
        message: 'Este email não foi verificado. Verifique seu email antes de solicitar a redefinição de senha.'
      });
    }

    // Invalidar tokens anteriores (marcar como expirados)
    await supabase
      .from('password_reset_tokens')
      .update({ expires_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    // Gerar novo token (válido por 1 hora)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { data: tokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        email: user.email,
        expires_at: expiresAt.toISOString()
      })
      .select('token')
      .single();

    if (tokenError || !tokenData) {
      console.error('❌ Erro ao criar token:', tokenError);
      return NextResponse.json(
        { success: false, message: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    // Gerar URL dinâmica baseada no request
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 
                    (host?.includes('localhost') ? 'http' : 'https');
    
    let baseUrl = '';
    if (host) {
      baseUrl = `${protocol}://${host}`;
    } else {
      // Fallback para variáveis de ambiente
      baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                process.env.APP_URL || 
                (process.env.NODE_ENV === 'production' 
                  ? 'https://painelabzgroup.netlify.app' 
                  : 'http://localhost:3000');
    }

    const resetUrl = `${baseUrl}/reset-password?token=${tokenData.token}`;

    console.log(`🔗 URL de reset gerada: ${resetUrl}`);

    // Enviar email
    const emailResult = await sendPasswordResetEmail(user.email, resetUrl);

    if (!emailResult.success) {
      console.error('❌ Erro ao enviar email:', emailResult.message);
      return NextResponse.json(
        { success: false, message: 'Erro ao enviar email de redefinição' },
        { status: 500 }
      );
    }

    console.log(`✅ Email de reset enviado com sucesso para: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Instruções para redefinir sua senha foram enviadas para seu email.'
    });

  } catch (error) {
    console.error('❌ Erro na solicitação de reset:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
