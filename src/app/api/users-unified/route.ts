import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('API de usuários unificados para o painel de administração iniciada (App Router)');

  try {
    // Runtime check to ensure this only runs during actual HTTP requests
    if (typeof window !== 'undefined') {
      return NextResponse.json(
        { error: 'Esta rota só pode ser executada no servidor' },
        { status: 500 }
      );
    }

    // Check if we're in a static generation context
    if (!request || !request.headers) {
      return NextResponse.json(
        { error: 'Rota não disponível durante geração estática' },
        { status: 503 }
      );
    }

    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    console.log('Token recebido:', token.substring(0, 10) + '...');

    // Verificar token
    const tokenResult = await verifyToken(token);
    if (!tokenResult) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
    }

    console.log('Token válido, buscando usuário com ID:', tokenResult.userId);

    // Se for o token de serviço do Supabase, permitir acesso direto
    if (tokenResult.userId === 'service-account') {
      console.log('Token de serviço do Supabase detectado, concedendo acesso direto');
    } else {
      // Verificar se o usuário é administrador
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users_unified')
        .select('role')
        .eq('id', tokenResult.userId)
        .single();

      if (userError || !userData) {
        console.error('Erro ao buscar usuário:', userError);
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
      }

      if (userData.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem acessar esta API.' }, { status: 403 });
      }
    }

    console.log('Usuário é administrador, buscando todos os usuários');

    // Buscar todos os usuários
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
    }

    console.log(`Encontrados ${users?.length || 0} usuários`);

    // Mapear os dados para o formato esperado pelo componente
    const mappedUsers = users?.map(user => ({
      _id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phoneNumber: user.phone_number,
      role: user.role,
      position: user.position,
      department: user.department,
      active: user.active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      accessPermissions: user.access_permissions,
      isAuthorized: user.is_authorized,
      authorizationStatus: user.authorization_status
    })) || [];

    console.log('Dados mapeados com sucesso');

    return NextResponse.json(mappedUsers);
  } catch (error) {
    console.error('Erro na API de usuários unificados:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
