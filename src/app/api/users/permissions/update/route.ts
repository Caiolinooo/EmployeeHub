import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PermissionFeatures } from '@/lib/permissions';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, features } = await request.json();

    if (!userId || !features) {
      return NextResponse.json(
        { error: 'userId e features são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar autorização (aceita token JWT próprio ou token do Supabase)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    let requesterUserId: string | null = null;
    const payload = verifyToken(token);
    if (payload?.userId) {
      requesterUserId = payload.userId;
    } else {
      const { data: supaUser, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !supaUser?.user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
      }
      requesterUserId = supaUser.user.id;
    }

    // Buscar dados do usuário que está fazendo a requisição
    const { data: requestingUser, error: requestingUserError } = await supabaseAdmin
      .from('users_unified')
      .select('role, first_name, last_name')
      .eq('id', requesterUserId)
      .single();

    if (requestingUserError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    // Buscar usuário alvo
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email, role, access_permissions, access_history')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Obter permissões atuais
    const currentPermissions = targetUser.access_permissions || {
      modules: {},
      features: {}
    };

    // Garantir que a estrutura features existe
    if (!currentPermissions.features) {
      currentPermissions.features = {};
    }

    // Atualizar apenas as features fornecidas
    const updatedFeatures = {
      ...currentPermissions.features,
      ...features
    };

    const updatedPermissions = {
      ...currentPermissions,
      features: updatedFeatures
    };

    // Registrar no histórico (garantir array)
    const currentHistoryRaw = targetUser.access_history;
    const currentHistory = Array.isArray(currentHistoryRaw) ? currentHistoryRaw : [];
    const historyEntry = {
      timestamp: new Date().toISOString(),
      action: 'PERMISSIONS_UPDATED',
      details: `Permissões atualizadas por ${requestingUser.first_name} ${requestingUser.last_name}`,
      changes: features,
      updated_by: requesterUserId
    };

    // Atualizar no banco de dados
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        access_permissions: updatedPermissions,
        access_history: [...currentHistory, historyEntry],
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, first_name, last_name, email, role, access_permissions')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar permissões:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar permissões' },
        { status: 500 }
      );
    }

    console.log(`✅ Permissões atualizadas para ${targetUser.first_name} ${targetUser.last_name} por ${requestingUser.first_name} ${requestingUser.last_name}`);

    return NextResponse.json({
      success: true,
      message: 'Permissões atualizadas com sucesso',
      user: {
        id: updatedUser.id,
        name: `${updatedUser.first_name} ${updatedUser.last_name}`,
        email: updatedUser.email,
        role: updatedUser.role,
        permissions: updatedUser.access_permissions
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar permissões:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    }, { status: 500 });
  }
}
