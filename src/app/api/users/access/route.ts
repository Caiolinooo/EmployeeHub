import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET - Obter permissões de acesso de um usuário
export async function GET(request: NextRequest) {
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

    // Obter o ID do usuário da query
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Se não for fornecido um ID, retornar as permissões do usuário atual
    if (!userId) {
      const { data: user, error } = await supabaseAdmin
        .from('users_unified')
        .select('id, role, access_permissions')
        .eq('id', payload.userId)
        .single();

      if (error || !user) {
        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        userId: user.id,
        role: user.role,
        accessPermissions: user.access_permissions || {}
      });
    }

    // Se for fornecido um ID, verificar se o usuário atual é administrador
    const { data: requestingUser, error: requestingUserError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role')
      .eq('id', payload.userId)
      .single();

    if (requestingUserError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem ver permissões de outros usuários.' },
        { status: 403 }
      );
    }

    // Buscar o usuário solicitado
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, role, access_permissions')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      userId: user.id,
      fullName: `${user.first_name} ${user.last_name}`,
      role: user.role,
      accessPermissions: user.access_permissions || {}
    });
  } catch (error) {
    console.error('Erro ao obter permissões de acesso:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Atualizar permissões de acesso de um usuário
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
    const { data: requestingUser, error: requestingUserError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, role, access_history')
      .eq('id', payload.userId)
      .single();

    if (requestingUserError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem atualizar permissões.' },
        { status: 403 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { userId, accessPermissions } = body;

    // Validar os dados
    if (!userId || !accessPermissions) {
      return NextResponse.json(
        { error: 'ID do usuário e permissões de acesso são obrigatórios' },
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
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Obter o histórico de acesso atual do usuário
    const userAccessHistory = user.access_history || [];

    // Atualizar permissões de acesso e registrar no histórico
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        access_permissions: accessPermissions,
        access_history: [
          ...userAccessHistory,
          {
            timestamp: new Date().toISOString(),
            action: 'PERMISSIONS_UPDATED',
            details: `Permissões atualizadas por ${requestingUser.first_name} ${requestingUser.last_name}`
          }
        ],
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao atualizar permissões' },
        { status: 500 }
      );
    }

    // Registrar a ação no histórico do administrador
    const adminAccessHistory = requestingUser.access_history || [];
    await supabaseAdmin
      .from('users_unified')
      .update({
        access_history: [
          ...adminAccessHistory,
          {
            timestamp: new Date().toISOString(),
            action: 'UPDATE_PERMISSIONS',
            details: `Atualizou permissões do usuário ${user.first_name} ${user.last_name}`
          }
        ],
        updated_at: new Date().toISOString()
      })
      .eq('id', requestingUser.id);

    return NextResponse.json({
      success: true,
      message: 'Permissões de acesso atualizadas com sucesso',
      userId: updatedUser.id,
      accessPermissions: updatedUser.access_permissions
    });
  } catch (error) {
    console.error('Erro ao atualizar permissões de acesso:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
