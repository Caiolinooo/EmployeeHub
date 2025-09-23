import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { sendEmailVerificationLink } from '@/lib/email-verification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'E-mail é obrigatório' },
        { status: 400 }
      );
    }

    // Normalizar email
    const normalizedEmail = email.trim().toLowerCase();

    // Buscar usuário pelo email
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o email já foi verificado
    if (user.email_verified) {
      return NextResponse.json(
        { error: 'Este e-mail já foi verificado. Você pode fazer login normalmente.' },
        { status: 400 }
      );
    }

    // Gerar novo token de verificação
    const emailVerificationToken = uuidv4();

    // Atualizar token no banco
    const { error: updateError } = await supabase
      .from('users_unified')
      .update({
        email_verification_token: emailVerificationToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Erro ao atualizar token de verificação:', updateError);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    // Enviar email de verificação
    const sendResult = await sendEmailVerificationLink(
      normalizedEmail,
      user.first_name || 'usuário',
      emailVerificationToken,
      request.headers
    );

    if (!sendResult.success) {
      return NextResponse.json(
        { error: 'Erro ao enviar e-mail de verificação' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'E-mail de verificação enviado com sucesso',
      previewUrl: sendResult.previewUrl // Para desenvolvimento
    });

  } catch (error) {
    console.error('Erro ao reenviar verificação de email:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
