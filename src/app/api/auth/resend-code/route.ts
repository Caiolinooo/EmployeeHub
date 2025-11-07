import { NextRequest, NextResponse } from 'next/server';
import { resendVerificationCode } from '@/lib/verification';
import { findUserByQuery } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Obter dados da requisição
    const body = await request.json();
    const { identifier, method } = body;

    if (!identifier) {
      return NextResponse.json(
        { error: 'Email ou telefone é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o método é válido
    if (method && method !== 'email' && method !== 'sms') {
      return NextResponse.json(
        { error: 'Método inválido. Use "email" ou "sms"' },
        { status: 400 }
      );
    }

    // Determinar se o identificador é um email ou telefone
    const isEmail = identifier.includes('@');

    // Buscar o usuário
    let user;

    try {
      // Buscar o usuário pelo identificador
      console.log(`Buscando usuário por ${isEmail ? 'email' : 'telefone'}: ${identifier}`);

      if (isEmail) {
        const { data, error } = await supabaseAdmin
          .from('users_unified')
          .select('*')
          .eq('email', identifier)
          .single();

        if (error) {
          console.error('Erro ao buscar usuário pelo email:', error);
        } else if (data) {
          user = {
            id: data.id,
            email: data.email,
            phoneNumber: data.phone_number,
            firstName: data.first_name,
            lastName: data.last_name
          };
          console.log('Usuário encontrado:', user.id);
        }
      } else {
        const { data, error } = await supabaseAdmin
          .from('users_unified')
          .select('*')
          .eq('phone_number', identifier)
          .single();

        if (error) {
          console.error('Erro ao buscar usuário pelo telefone:', error);
        } else if (data) {
          user = {
            id: data.id,
            email: data.email,
            phoneNumber: data.phone_number,
            firstName: data.first_name,
            lastName: data.last_name
          };
          console.log('Usuário encontrado:', user.id);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Determinar o método de envio
    // Se o método não foi especificado, usar o padrão com base no identificador
    const sendMethod = method || (isEmail ? 'email' : 'sms');

    // Verificar se o usuário tem o método de contato escolhido
    if (sendMethod === 'email' && !user.email) {
      return NextResponse.json(
        { error: 'Usuário não tem email cadastrado' },
        { status: 400 }
      );
    }

    if (sendMethod === 'sms' && !user.phoneNumber) {
      return NextResponse.json(
        { error: 'Usuário não tem telefone cadastrado' },
        { status: 400 }
      );
    }

    // Reenviar o código
    const sendTo = sendMethod === 'email' ? user.email : user.phoneNumber;
    const result = await resendVerificationCode(user.id, sendMethod);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    // Retornar resposta de sucesso
    const response: any = {
      success: true,
      message: result.message,
      method: sendMethod
    };

    // Em ambiente de desenvolvimento, incluir o código e URL de preview
    if (process.env.NODE_ENV !== 'production') {
      if (result.code) response.code = result.code;
      if (result.previewUrl) response.previewUrl = result.previewUrl;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao reenviar código de verificação:', error);

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
