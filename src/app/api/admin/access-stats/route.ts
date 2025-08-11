import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

console.log('Inicializando API de estatísticas de acesso');

// GET /api/admin/access-stats
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const tokenPayload = verifyToken(token);
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Se for o token de serviço do Supabase, permitir acesso direto
    if (tokenPayload.userId === 'service-account') {
      console.log('Token de serviço do Supabase detectado, concedendo acesso direto');
    } else {
      // Verificar se o usuário é administrador
      const { data: requestingUser, error: userError } = await supabaseAdmin
        .from('users_unified')
        .select('id, role, email, phone_number')
        .eq('id', tokenPayload.userId)
        .single();

      // Verificar se o usuário é o administrador principal
      const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
      const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
      const isMainAdmin = requestingUser?.email === adminEmail || requestingUser?.phone_number === adminPhone;

      if (userError || !requestingUser || (requestingUser.role !== 'ADMIN' && !isMainAdmin)) {
        // Se for o administrador principal mas o papel não está definido como ADMIN, atualizar
        if (isMainAdmin && requestingUser?.role !== 'ADMIN') {
          console.log('Usuário é o administrador principal mas o papel não está definido como ADMIN. Atualizando...');

          // Atualizar o papel para ADMIN
          await supabaseAdmin
            .from('users_unified')
            .update({ role: 'ADMIN' })
            .eq('id', requestingUser.id);

          // Continuar com a execução
        } else {
          console.error('Acesso negado para usuário:', tokenPayload.userId);
          return NextResponse.json(
            { error: 'Acesso negado. Apenas administradores podem acessar esta API.' },
            { status: 403 }
          );
        }
      }
    }

    // Calcular estatísticas
    const stats = await calculateAccessStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Calcula estatísticas de acesso ao sistema usando Supabase
 * @returns Objeto com estatísticas
 */
async function calculateAccessStats() {
  // Calcular data de 30 dias atrás
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Calcular data de 7 dias atrás
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Estatísticas de usuários
  const { data: usersData, error: usersError } = await supabaseAdmin
    .from('users_unified')
    .select('id, role, active, created_at, department, position');

  if (usersError) {
    console.error('Erro ao buscar usuários:', usersError);
    throw new Error('Erro ao buscar estatísticas de usuários');
  }

  // Estatísticas de autorizações - agora usando a tabela users_unified
  const { data: authData, error: authError } = await supabaseAdmin
    .from('users_unified')
    .select('id, email, phone_number, authorization_domain, invite_code, authorization_status')
    .eq('is_authorized', true);

  if (authError) {
    console.error('Erro ao buscar autorizações:', authError);
    throw new Error('Erro ao buscar estatísticas de autorizações');
  }

  // Processar estatísticas de usuários
  const totalUsers = usersData.length;
  const activeUsers = usersData.filter(user => user.active).length;
  const newUsers = usersData.filter(user => new Date(user.created_at) >= thirtyDaysAgo).length;
  const recentlyActiveUsers = 0; // Não temos a coluna last_login ainda

  // Processar estatísticas de departamentos
  const departments: Record<string, number> = {};
  usersData.forEach(user => {
    if (user.department) {
      departments[user.department] = (departments[user.department] || 0) + 1;
    }
  });

  const departmentStats = Object.entries(departments)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Processar estatísticas de cargos
  const positions: Record<string, number> = {};
  usersData.forEach(user => {
    if (user.position) {
      positions[user.position] = (positions[user.position] || 0) + 1;
    }
  });

  const positionStats = Object.entries(positions)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Processar estatísticas de autorizações
  const emailAuths = authData.filter(auth => auth.email && auth.authorization_status === 'active').length;
  const phoneAuths = authData.filter(auth => auth.phone_number && auth.authorization_status === 'active').length;
  const domainAuths = authData.filter(auth => auth.authorization_domain && auth.authorization_status === 'active').length;
  const inviteAuths = authData.filter(auth => auth.invite_code && auth.authorization_status === 'active').length;
  const pendingAuths = authData.filter(auth => auth.authorization_status === 'pending').length;
  const rejectedAuths = authData.filter(auth => auth.authorization_status === 'rejected').length;

  // Montar resposta
  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      newLast30Days: newUsers,
      activeLast7Days: recentlyActiveUsers
    },
    authorizations: {
      email: emailAuths,
      phone: phoneAuths,
      domain: domainAuths,
      inviteCode: inviteAuths,
      pending: pendingAuths,
      rejected: rejectedAuths
    },
    departments: departmentStats,
    positions: positionStats
  };
}
