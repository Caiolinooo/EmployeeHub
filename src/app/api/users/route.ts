import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendNewUserWelcomeEmail } from '@/lib/notifications';

// GET - Chamar diretamente a API do Supabase
export async function GET(request: NextRequest) {
  console.log('Chamando diretamente a API do Supabase de /api/users');

  // Obter a URL da requisição
  const url = new URL(request.url);

  // Construir a nova URL para a chamada direta
  const apiUrl = new URL('/api/users/supabase', url.origin);

  // Adicionar os parâmetros de consulta
  url.searchParams.forEach((value, key) => {
    apiUrl.searchParams.append(key, value);
  });

  // Adicionar timestamp para evitar cache
  apiUrl.searchParams.append('_', Date.now().toString());

  // Criar uma nova requisição com os mesmos cabeçalhos
  const headers = new Headers(request.headers);

  // Fazer a requisição para a nova URL
  try {
    const response = await fetch(apiUrl.toString(), {
      method: request.method,
      headers: headers,
      cache: 'no-store'
    });

    // Ler o corpo da resposta
    const data = await response.json();

    // Retornar a resposta
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Erro ao redirecionar para /api/users/supabase:', error);
    return NextResponse.json(
      { error: 'Erro ao redirecionar para a API do Supabase' },
      { status: 500 }
    );
  }
}

// POST - Criar um novo usuário
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, first_name, last_name, email, phone_number')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem criar usuários.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      phoneNumber,
      firstName,
      lastName,
      email,
      password,
      role,
      position,
      department
    } = body;

    // Validar os dados de entrada
    if (!phoneNumber || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Número de telefone, nome e sobrenome são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a senha foi fornecida, caso contrário, gerar uma senha aleatória temporária
    let userPassword = password;
    if (!userPassword) {
      // Gerar uma senha aleatória de 10 caracteres
      userPassword = crypto.randomBytes(5).toString('hex');
      console.log(`Senha aleatória gerada para o usuário ${firstName} ${lastName}: ${userPassword}`);
    }

    // Verificar se o usuário já existe
    const { data: existingUserByPhone, error: phoneError } = await supabaseAdmin
      .from('users_unified')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single();

    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'Número de telefone já está em uso' },
        { status: 409 }
      );
    }

    // Verificar se o email já existe (se fornecido)
    if (email) {
      const { data: existingUserByEmail } = await supabaseAdmin
        .from('users_unified')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUserByEmail) {
        return NextResponse.json(
          { error: 'Email já está em uso' },
          { status: 409 }
        );
      }
    }

    // Definir permissões padrão com base no papel
    const defaultPermissions = {
      ADMIN: {
        modules: {
          dashboard: true,
          manual: true,
          procedimentos: true,
          politicas: true,
          calendario: true,
          noticias: true,
          reembolso: true,
          contracheque: true,
          ponto: true,
          admin: true
        }
      },
      MANAGER: {
        modules: {
          dashboard: true,
          manual: true,
          procedimentos: true,
          politicas: true,
          calendario: true,
          noticias: true,
          reembolso: true,
          contracheque: true,
          ponto: true,
          admin: false
        }
      },
      USER: {
        modules: {
          dashboard: true,
          manual: true,
          procedimentos: true,
          politicas: true,
          calendario: true,
          noticias: true,
          reembolso: true,
          contracheque: true,
          ponto: true,
          admin: false
        }
      }
    };

    // Determinar o papel do usuário
    const userRole = ['ADMIN', 'USER', 'MANAGER'].includes(role) ? role : 'USER';

    // Gerar hash da senha
    const hashedPassword = await bcrypt.hash(userPassword, 10);

    // Criar o usuário usando SQL direto para evitar o erro de tipo
    const userId = crypto.randomUUID();
    const now = new Date();

    // Criar usuário no Supabase
    try {
      // Criar objeto de histórico de acesso
      const accessHistory = [{
        timestamp: now.toISOString(),
        action: 'CREATED',
        details: `Usuário criado por ${requestingUser.first_name} ${requestingUser.last_name}`
      }];

      // Criar usuário na tabela users_unified
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users_unified')
        .insert({
          id: userId,
          phone_number: phoneNumber,
          first_name: firstName,
          last_name: lastName,
          email,
          password: hashedPassword,
          role: userRole,
          position,
          department,
          active: true,
          password_last_changed: now.toISOString(),
          access_permissions: defaultPermissions[userRole as 'ADMIN' | 'MANAGER' | 'USER'],
          access_history: accessHistory,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Erro ao criar usuário: ${createError.message}`);
      }

      // Armazenar o usuário criado para uso posterior
      const createdUserData = newUser;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }

    // Registrar a ação no histórico do administrador
    try {
      // Primeiro, buscar o histórico atual do administrador
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('users_unified')
        .select('access_history')
        .eq('id', requestingUser.id)
        .single();

      if (adminError) {
        console.error('Erro ao buscar histórico do administrador:', adminError);
      } else {
        // Criar novo histórico
        const adminAccessHistory = adminData.access_history || [];
        const updatedHistory = [
          ...adminAccessHistory,
          {
            timestamp: new Date().toISOString(),
            action: 'CREATE_USER',
            details: `Criou o usuário ${firstName} ${lastName} (${phoneNumber})`
          }
        ];

        // Atualizar o histórico do administrador
        const { error: updateError } = await supabaseAdmin
          .from('users_unified')
          .update({
            access_history: updatedHistory,
            updated_at: new Date().toISOString()
          })
          .eq('id', requestingUser.id);

        if (updateError) {
          console.error('Erro ao atualizar histórico do administrador:', updateError);
        }
      }
    } catch (error) {
      console.error('Erro ao registrar ação no histórico do administrador:', error);
    }

    // Enviar email de boas-vindas se o usuário tiver email
    if (email) {
      try {
        console.log(`Enviando email de boas-vindas para ${email}`);
        // Se uma senha foi gerada automaticamente, incluí-la no email
        const passwordInfo = password ? undefined : userPassword;
        const emailResult = await sendNewUserWelcomeEmail(email, `${firstName} ${lastName}`, passwordInfo);
        console.log(`Resultado do envio de email: ${emailResult.success ? 'Sucesso' : 'Falha'}`);
      } catch (emailError) {
        console.error('Erro ao enviar email de boas-vindas:', emailError);
        // Não interromper o fluxo se o email falhar
      }
    }

    // Obter o usuário criado para garantir que temos os dados mais recentes
    const { data: createdUser, error: fetchError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !createdUser) {
      throw new Error('Erro ao recuperar usuário após criação');
    }

    // Retornar os dados do usuário (sem campos sensíveis)
    const userResponse = {
      ...createdUser,
      password: undefined,
      verification_code: undefined,
      verification_code_expires: undefined
    };

    // Se uma senha foi gerada automaticamente, incluí-la na resposta para o administrador
    if (!password && userPassword) {
      console.log(`Senha temporária para o usuário ${firstName} ${lastName}: ${userPassword}`);
      userResponse.temporaryPassword = userPassword;
    }

    return NextResponse.json(userResponse, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
