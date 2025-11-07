import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

    // Verificar se o usuário específico existe
    const userId = 'c9b1e9a2-3c80-4b3d-9f75-fc7a00d7cdbb';
    console.log(`Verificando se o usuário com ID ${userId} existe...`);
    const { data: specificUser, error: specificUserError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', userId)
      .single();

    if (specificUserError) {
      console.error(`Erro ao buscar usuário específico (${userId}):`, specificUserError);

      // Criar o usuário admin se não existir
      console.log('Tentando criar usuário admin...');
      const { data: newAdmin, error: createError } = await supabaseAdmin
        .from('users_unified')
        .insert({
          id: userId,
          email: 'caio.correia@groupabz.com',
          phone_number: '+5522997847289',
          first_name: 'Caio',
          last_name: 'Correia',
          role: 'ADMIN',
          position: 'Administrador do Sistema',
          department: 'TI',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (createError) {
        console.error('Erro ao criar usuário admin:', createError.message);
      } else {
        console.log('Usuário admin criado com sucesso:', newAdmin);
      }
    } else if (specificUser) {
      console.log('Usuário específico encontrado:', specificUser);

      // Verificar se o usuário é admin
      if (specificUser.role !== 'ADMIN') {
        console.log('Usuário encontrado, mas não é admin. Atualizando papel...');

        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users_unified')
          .update({
            role: 'ADMIN',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select();

        if (updateError) {
          console.error('Erro ao atualizar papel do usuário:', updateError.message);
        } else {
          console.log('Papel do usuário atualizado com sucesso:', updatedUser);
        }
      }
    } else {
      console.log(`Usuário com ID ${userId} não encontrado`);

      // Criar o usuário admin
      console.log('Tentando criar usuário admin...');
      const { data: newAdmin, error: createError } = await supabaseAdmin
        .from('users_unified')
        .insert({
          id: userId,
          email: 'caio.correia@groupabz.com',
          phone_number: '+5522997847289',
          first_name: 'Caio',
          last_name: 'Correia',
          role: 'ADMIN',
          position: 'Administrador do Sistema',
          department: 'TI',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (createError) {
        console.error('Erro ao criar usuário admin:', createError.message);
      } else {
        console.log('Usuário admin criado com sucesso:', newAdmin);
      }
    }

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
