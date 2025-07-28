import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/lib/password';
import { generateToken } from '@/lib/jwt';
import { sendNewUserWelcomeEmail } from '@/lib/notifications';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, name, email, password, role = 'USER', department } = body;

    // Validar os dados de entrada
    if (!username || !name || !email || !password) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o usuário já existe
    const { data: existingUser, error: searchError } = await supabase
      .from('users_unified')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser && !searchError) {
      return NextResponse.json(
        { error: 'E-mail já está em uso' },
        { status: 409 }
      );
    }

    // Hash da senha
    const hashedPassword = await hashPassword(password);

    // Definir permissões padrão para usuários
    const defaultPermissions = {
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
    };

    // Separar nome em primeiro e último nome
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Criar o usuário (sempre com papel USER, exceto se for o admin principal)
    const { data: user, error: createError } = await supabase
      .from('users_unified')
      .insert({
        id: uuidv4(),
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: username, // Usando username como phone_number temporariamente
        password: hashedPassword,
        password_hash: hashedPassword,
        // Apenas o admin principal pode ser criado como ADMIN
        role: (role === 'ADMIN' && email === process.env.ADMIN_EMAIL) ? 'ADMIN' : 'USER',
        department,
        access_permissions: defaultPermissions,
        active: false, // Usuário inativo por padrão, aguardando aprovação
        password_last_changed: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Erro ao criar usuário:', createError);
      return NextResponse.json(
        { error: 'Erro ao criar usuário' },
        { status: 500 }
      );
    }

    // Gerar o token JWT
    const token = generateToken(user);

    // Enviar email de boas-vindas
    try {
      console.log(`Enviando email de boas-vindas para ${email}`);
      const emailResult = await sendNewUserWelcomeEmail(email, name);
      console.log(`Resultado do envio de email: ${emailResult.success ? 'Sucesso' : 'Falha'}`);
    } catch (emailError) {
      console.error('Erro ao enviar email de boas-vindas:', emailError);
      // Não interromper o fluxo se o email falhar
    }

    // Retornar o token e os dados do usuário (sem a senha)
    const { password: userPassword, password_hash, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso. Aguarde a aprovação do administrador para acessar o sistema.',
      user: userWithoutPassword,
      requiresApproval: true
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
