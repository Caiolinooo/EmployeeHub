import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendPasswordResetSMS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    // Validar os dados de entrada
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    // Para email, usamos diretamente o método resetPasswordForEmail do Supabase no cliente
    // Esta API é apenas para SMS, que não é suportado nativamente pelo Supabase

    // Buscar o usuário pelo número de telefone
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('id, phone_number, active, email, access_history')
      .eq('phone_number', phoneNumber)
      .single();

    // Se o usuário não for encontrado, retornar sucesso para evitar enumeração de usuários
    if (userError || !user) {
      console.log('Usuário não encontrado para recuperação de senha:', phoneNumber);
      return NextResponse.json({
        success: true,
        message: 'Se o telefone estiver cadastrado, você receberá instruções para redefinir sua senha.'
      });
    }

    // Verificar se o usuário está ativo
    if (!user.active) {
      console.log('Usuário inativo tentando recuperar senha:', phoneNumber);
      return NextResponse.json({
        success: true,
        message: 'Se o telefone estiver cadastrado, você receberá instruções para redefinir sua senha.'
      });
    }

    // Gerar um link de redefinição de senha usando Supabase
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      user.email, // Precisamos do email do usuário para o Supabase
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      }
    );

    if (error) {
      console.error('Erro ao gerar link de redefinição:', error);
      return NextResponse.json(
        { error: 'Erro ao gerar link de redefinição. Por favor, tente novamente.' },
        { status: 500 }
      );
    }

    // Enviar SMS com o link de redefinição
    // Como o Supabase não suporta SMS diretamente, usamos nossa função personalizada
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`;
    const sendResult = await sendPasswordResetSMS(phoneNumber, resetUrl);

    if (!sendResult.success) {
      console.error('Erro ao enviar instruções de redefinição:', sendResult.message);
      return NextResponse.json(
        { error: 'Erro ao enviar instruções de redefinição. Por favor, tente novamente.' },
        { status: 500 }
      );
    }

    // Registrar no histórico de acesso
    const timestamp = new Date().toISOString();
    const { error: historyError } = await supabase
      .from('users_unified')
      .update({
        access_history: [
          ...(user.access_history || []),
          {
            timestamp,
            action: 'PASSWORD_RESET_REQUEST',
            details: 'Solicitação de redefinição de senha via SMS'
          }
        ]
      })
      .eq('id', user.id);

    if (historyError) {
      console.error('Erro ao registrar histórico de acesso:', historyError);
    }

    return NextResponse.json({
      success: true,
      message: 'Instruções de redefinição de senha enviadas com sucesso.'
    });
  } catch (error) {
    console.error('Erro ao processar solicitação de recuperação de senha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
