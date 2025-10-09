import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, handleApiError } from '@/lib/api-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST - Atualizar o papel (role) de um usuário
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação e autorização (apenas administradores)
    const authResult = await verifyAuth(request, true);

    if (authResult.error) {
      return authResult.error;
    }

    const { user: requestingUser } = authResult;

    // Garantir que params seja await antes de acessar suas propriedades
    const resolvedParams = await params;
    const userId = resolvedParams.id;

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { role, accessPermissions } = body;

    // Validar o papel
    if (!role || !['ADMIN', 'MANAGER', 'USER'].includes(role)) {
      return NextResponse.json(
        { error: 'Papel inválido' },
        { status: 400 }
      );
    }

    // Buscar o usuário a ser atualizado
    const { data: userToUpdate, error: findError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', userId)
      .single();

    if (findError || !userToUpdate) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário está tentando alterar seu próprio papel
    if (userToUpdate.id === requestingUser.id && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Você não pode rebaixar seu próprio papel de administrador' },
        { status: 403 }
      );
    }

    // Atualizar o papel e permissões do usuário
    const updateData: any = { role };

    // Se foram fornecidas permissões, atualizá-las
    if (accessPermissions) {
      updateData.accessPermissions = accessPermissions;
    }

    // Obter o histórico de acesso atual do usuário
    const userAccessHistory = userToUpdate.accessHistory || [];

    // Adicionar entrada no histórico de acesso
    const historyEntry = {
      timestamp: new Date(),
      action: 'ROLE_UPDATED',
      details: `Papel alterado de ${userToUpdate.role} para ${role} por ${requestingUser.firstName} ${requestingUser.lastName}`
    };

    // Atualizar o usuário
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        ...updateData,
        access_history: [...userAccessHistory, historyEntry]
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar usuário' },
        { status: 500 }
      );
    }

    // Obter o histórico de acesso atual do administrador
    const adminAccessHistory = requestingUser.access_history || [];

    // Registrar a ação no histórico do administrador
    await supabaseAdmin
      .from('users_unified')
      .update({
        access_history: [
          ...adminAccessHistory,
          {
            timestamp: new Date().toISOString(),
            action: 'UPDATE_USER_ROLE',
            details: `Alterou o papel de ${userToUpdate.first_name} ${userToUpdate.last_name} de ${userToUpdate.role} para ${role}`
          }
        ]
      })
      .eq('id', requestingUser.id);

    // Retornar os dados do usuário atualizado (sem campos sensíveis)
    const userResponse = {
      ...updatedUser,
      password: undefined,
      verificationCode: undefined,
      verificationCodeExpires: undefined
    };

    return NextResponse.json(userResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
