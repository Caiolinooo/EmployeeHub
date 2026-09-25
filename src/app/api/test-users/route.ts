import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requirePermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission(request, 'admin');
    if (authError) {
      return authError;
    }

    console.log('Teste de API de usuários iniciado');

    // Verificar se o cliente Supabase está inicializado
    if (!supabaseAdmin) {
      console.error('Cliente Supabase não inicializado');
      return NextResponse.json({
        success: false,
        error: 'Cliente Supabase não inicializado'
      }, { status: 500 });
    }

    // Testar conexão com a tabela users_unified
    console.log('Testando conexão com a tabela users_unified...');
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email, phone_number, role')
      .limit(5);

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar usuários',
        details: usersError.message
      }, { status: 500 });
    }

    console.log(`Encontrados ${users?.length || 0} usuários`);

    // Testar conexão com a tabela user_permissions
    console.log('Testando conexão com a tabela user_permissions...');
    const { data: permissions, error: permissionsError } = await supabaseAdmin
      .from('user_permissions')
      .select('id, user_id, module')
      .limit(5);

    if (permissionsError) {
      console.error('Erro ao buscar permissões:', permissionsError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar permissões',
        details: permissionsError.message
      }, { status: 500 });
    }

    console.log(`Encontradas ${permissions?.length || 0} permissões`);

    // Testar conexão com a tabela authorized_users
    console.log('Testando conexão com a tabela authorized_users...');
    const { data: authorizedUsers, error: authorizedUsersError } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .limit(5);

    if (authorizedUsersError) {
      console.error('Erro ao buscar usuários autorizados:', authorizedUsersError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar usuários autorizados',
        details: authorizedUsersError.message
      }, { status: 500 });
    }

    console.log(`Encontrados ${authorizedUsers?.length || 0} usuários autorizados`);

    // Retornar resultados
    return NextResponse.json({
      success: true,
      message: 'Teste de API de usuários concluído com sucesso',
      data: {
        users: users || [],
        permissions: permissions || [],
        authorizedUsers: authorizedUsers || []
      }
    });
  } catch (error) {
    console.error('Erro ao executar teste de API de usuários:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
