import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verificar autorização (aceita token JWT próprio ou token do Supabase)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Tentar validar nosso JWT primeiro
    let requesterUserId: string | null = null;
    const payload = verifyToken(token);
    if (payload?.userId) {
      requesterUserId = payload.userId;
    } else {
      // Fallback: tentar validar como token do Supabase
      const { data: supaUser, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !supaUser?.user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
      }
      requesterUserId = supaUser.user.id;
    }

    // Buscar dados do usuário que está fazendo a requisição
    const { data: requestingUser, error: requestingUserError } = await supabaseAdmin
      .from('users_unified')
      .select('role')
      .eq('id', requesterUserId)
      .single();

    if (requestingUserError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    // Buscar todos os usuários com suas permissões
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let usersQuery = supabaseAdmin
      .from('users_unified')
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        active,
        access_permissions,
        created_at,
        updated_at
      `)
      .order('first_name');

    if (activeOnly) {
      usersQuery = usersQuery.eq('active', true);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
    }

    // Processar dados dos usuários
    const processedUsers = users.map(user => {
      const permissions = user.access_permissions || { modules: {}, features: {} };
      const features = permissions.features || {};

      return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        active: user.active,
        access_permissions: permissions,
        permissions_summary: {
          academy_editor: !!features.academy_editor,
          academy_moderator: !!features.academy_moderator,
          social_editor: !!features.social_editor,
          social_moderator: !!features.social_moderator
        },
        created_at: user.created_at,
        updated_at: user.updated_at
      };
    });

    // Estatísticas
    const stats = {
      total_users: processedUsers.length,
      by_role: {
        ADMIN: processedUsers.filter(u => u.role === 'ADMIN').length,
        MANAGER: processedUsers.filter(u => u.role === 'MANAGER').length,
        USER: processedUsers.filter(u => u.role === 'USER').length
      },
      permissions: {
        academy_editors: processedUsers.filter(u => u.permissions_summary.academy_editor).length,
        academy_moderators: processedUsers.filter(u => u.permissions_summary.academy_moderator).length,
        social_editors: processedUsers.filter(u => u.permissions_summary.social_editor).length,
        social_moderators: processedUsers.filter(u => u.permissions_summary.social_moderator).length
      }
    };

    console.log(`📊 Listando ${processedUsers.length} usuários com permissões`);

    return NextResponse.json({
      success: true,
      users: processedUsers,
      stats
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários com permissões:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    }, { status: 500 });
  }
}
