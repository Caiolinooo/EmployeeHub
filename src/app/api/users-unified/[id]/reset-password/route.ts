import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { data: requestingUser, error: requestingUserError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, role, access_history')
      .eq('id', payload.userId)
      .single();

    if (requestingUserError || !requestingUser || requestingUser.role !== 'ADMIN') {
      console.error('Erro ao verificar usuário solicitante:', requestingUserError);
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem redefinir senhas.' },
        { status: 403 }
      );
    }

    // Obter o ID do usuário dos parâmetros da rota
    // Garantir que params seja await antes de acessar suas propriedades
    const resolvedParams = await params;
    const userId = resolvedParams.id;

    // Obter a nova senha do corpo da requisição
    const body = await request.json();
    const { password } = body;

    // Validar os dados
    if (!userId || !password) {
      return NextResponse.json(
        { error: 'ID do usuário e nova senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar o usuário
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, access_history')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Gerar hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Obter o histórico de acesso atual do usuário
    const userAccessHistory = user.access_history || [];

    // Atualizar a senha e registrar no histórico
    const { error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        password: hashedPassword,
        password_last_changed: new Date().toISOString(),
        access_history: [
          ...userAccessHistory,
          {
            timestamp: new Date().toISOString(),
            action: 'PASSWORD_RESET',
            details: `Senha redefinida por ${requestingUser.first_name} ${requestingUser.last_name}`
          }
        ],
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar senha' },
        { status: 500 }
      );
    }

    // Registrar a ação no histórico do administrador
    const adminAccessHistory = requestingUser.access_history || [];
    const { error: adminUpdateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        access_history: [
          ...adminAccessHistory,
          {
            timestamp: new Date().toISOString(),
            action: 'RESET_USER_PASSWORD',
            details: `Redefiniu a senha do usuário ${user.first_name} ${user.last_name}`
          }
        ],
        updated_at: new Date().toISOString()
      })
      .eq('id', requestingUser.id);

    if (adminUpdateError) {
      console.error('Erro ao atualizar histórico do administrador:', adminUpdateError);
      // Não falhar a operação se apenas o histórico do admin falhar
    }

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
