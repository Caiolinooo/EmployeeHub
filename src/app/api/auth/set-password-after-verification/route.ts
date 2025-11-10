import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      console.log('Token não fornecido');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = verifyToken(token);

    if (!payload) {
      console.log('Token inválido');
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    console.log('Definindo senha para usuário:', payload.userId);

    // Obter os dados do corpo da requisição
    const body = await req.json();
    const { password, firstName, lastName, phoneNumber } = body;

    console.log('Dados recebidos para definição de senha:', {
      userId: payload.userId,
      hasPassword: !!password,
      hasFirstName: !!firstName,
      hasLastName: !!lastName,
      hasPhoneNumber: !!phoneNumber
    });

    if (!password) {
      console.log('Senha não fornecida');
      return NextResponse.json({ error: 'Senha não fornecida' }, { status: 400 });
    }

    // Validar a senha
    if (password.length < 8) {
      console.log('Senha muito curta');
      return NextResponse.json({
        error: 'A senha deve ter pelo menos 8 caracteres'
      }, { status: 400 });
    }

    // Validar campos adicionais se fornecidos
    if (firstName !== undefined && !firstName.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    if (lastName !== undefined && !lastName.trim()) {
      return NextResponse.json({ error: 'Sobrenome é obrigatório' }, { status: 400 });
    }

    if (phoneNumber !== undefined && !phoneNumber.trim()) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
    }

    // Gerar hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    // Verificar se estamos usando Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      // Usar Supabase
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Verificar se o usuário existe
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('*')
        .eq('id', payload.userId)
        .single();

      if (userError || !userData) {
        console.error('Erro ao buscar usuário:', userError);
        return NextResponse.json({
          error: 'Usuário não encontrado'
        }, { status: 404 });
      }

      // Preparar o histórico de acesso atualizado
      const accessHistory = [
        ...(userData.access_history || []),
        {
          timestamp: now,
          action: 'PASSWORD_SET',
          details: 'Senha definida pelo usuário após verificação'
        }
      ];

      // Preparar os dados para atualização
      const updateData: any = {
        password: hashedPassword, // Manter compatibilidade com código existente
        password_hash: hashedPassword, // Usar nova coluna
        password_last_changed: now,
        updated_at: now,
        access_history: accessHistory
      };

      // Adicionar campos adicionais se fornecidos
      if (firstName !== undefined) {
        updateData.first_name = firstName.trim();
      }

      if (lastName !== undefined) {
        updateData.last_name = lastName.trim();
      }

      if (phoneNumber !== undefined) {
        updateData.phone_number = phoneNumber.trim();
      }

      console.log('Atualizando usuário com dados:', {
        ...updateData,
        password: '[REDACTED]',
        password_hash: '[REDACTED]'
      });

      // Atualizar o usuário
      const { error: updateError } = await supabase
        .from('users_unified')
        .update(updateData)
        .eq('id', payload.userId);

      if (updateError) {
        console.error('Erro ao atualizar senha:', updateError);
        return NextResponse.json({
          error: 'Erro ao definir senha'
        }, { status: 500 });
      }

      // Verificar se o usuário é externo (não tem role definida)
      if (!userData.role || userData.role === '') {
        const { error: roleError } = await supabase
          .from('users_unified')
          .update({
            role: 'USER',
            access_permissions: {
              modules: {
                admin: false,
                dashboard: true,
                manual: true,
                procedimentos: true,
                politicas: true,
                calendario: true,
                noticias: true,
                reembolso: true,
                contracheque: true,
                ponto: true,
                avaliacao: false
              }
            }
          })
          .eq('id', payload.userId);

        if (roleError) {
          console.error('Erro ao atualizar papel do usuário:', roleError);
          // Não retornar erro, pois a senha já foi definida com sucesso
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Senha definida com sucesso'
      });
    } else {
      return NextResponse.json({
        error: 'Configuração de banco de dados não encontrada'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
