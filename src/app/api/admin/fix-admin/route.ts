import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Obter URLs e chaves para informações de debug
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Verificar se a chave de serviço está presente e tem o formato correto
if (!supabaseServiceKey || supabaseServiceKey.length < 100) {
  console.error('ERRO CRÍTICO: Chave de serviço do Supabase inválida ou ausente!');
  console.error('Comprimento da chave:', supabaseServiceKey ? supabaseServiceKey.length : 0);
  console.error('A chave deve ser um JWT completo, não apenas um prefixo como "sbp_"');
}

console.log('Usando cliente Supabase com URL:', supabaseUrl);
console.log('Chave de serviço presente:', supabaseServiceKey ? 'Sim' : 'Não');

export async function GET(_request: NextRequest) {
  try {
    // Obter informações do administrador das variáveis de ambiente
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Caio';
    const adminLastName = process.env.ADMIN_LAST_NAME || 'Correia';

    console.log('Verificando usuário administrador no Supabase:', { adminEmail, adminPhone });

    // Verificar se o usuário administrador existe na tabela 'users'
    // Primeiro, tentar pelo email
    let existingUser = null;
    let userError = null;

    const { data: userByEmail, error: emailError } = await supabase
      .from('users')
      .select('*')
      .eq('email', adminEmail)
      .single();

    if (userByEmail) {
      console.log('Usuário administrador encontrado pelo email:', userByEmail.id);
      existingUser = userByEmail;
    } else if (emailError) {
      console.log('Usuário não encontrado pelo email, tentando pelo telefone');

      // Tentar pelo telefone
      const { data: userByPhone, error: phoneError } = await supabase
        .from('users')
        .select('*')
        .eq('phone_number', adminPhone)
        .single();

      if (userByPhone) {
        console.log('Usuário administrador encontrado pelo telefone:', userByPhone.id);
        existingUser = userByPhone;
      } else {
        userError = phoneError;
        console.log('Usuário administrador não encontrado pelo telefone:', phoneError);
      }
    }

    if (userError) {
      console.log('Usuário administrador não encontrado, criando...');

      // Criar usuário na autenticação do Supabase
      console.log('Tentando criar usuário na autenticação do Supabase com:', {
        email: adminEmail,
        phone: adminPhone,
        anonKey: supabaseAnonKey ? 'Presente' : 'Ausente'
      });

      // Não vamos mais tentar criar o usuário na autenticação do Supabase
      // Vamos criar diretamente na tabela users
      console.log('Usando chave anônima, não é possível criar usuários diretamente na autenticação');
      console.log('Criando usuário diretamente na tabela users');

      // Simular dados de autenticação
      const authData = {
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: adminEmail,
          phone: adminPhone,
          user_metadata: {
            first_name: adminFirstName,
            last_name: adminLastName,
            role: 'ADMIN'
          }
        }
      };

      console.log('Dados do usuário para criação:', authData.user);

      // Criar perfil do usuário na tabela 'users'
      console.log('Criando perfil do usuário na tabela users com ID:', authData?.user?.id);

      // Se não conseguimos criar o usuário na autenticação, vamos criar diretamente na tabela users
      // com um ID fixo para o administrador
      const userId = authData?.user?.id || '00000000-0000-0000-0000-000000000000';

      const userData = {
        id: userId,
        email: adminEmail,
        phone_number: adminPhone,
        first_name: adminFirstName,
        last_name: adminLastName,
        role: 'ADMIN',
        position: 'Administrador do Sistema',
        department: 'TI',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Dados do usuário a serem inseridos:', userData);

      // Primeiro verificar se o usuário já existe com este ID
      const { data: existingUserById, error: existingUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Verificação de usuário existente por ID:', existingUserById || 'Não encontrado', existingUserError || 'Sem erro');

      let newUser;
      let profileError;

      if (existingUserById) {
        // Atualizar o usuário existente
        console.log('Usuário já existe, atualizando...');
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            email: adminEmail,
            phone_number: adminPhone,
            first_name: adminFirstName,
            last_name: adminLastName,
            role: 'ADMIN',
            position: 'Administrador do Sistema',
            department: 'TI',
            active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();

        newUser = updatedUser;
        profileError = updateError;
      } else {
        // Inserir novo usuário
        console.log('Inserindo novo usuário...');
        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert(userData)
          .select()
          .single();

        newUser = insertedUser;
        profileError = insertError;
      }

      console.log('Resultado da operação na tabela users:', newUser || 'Sem dados', profileError || 'Sem erro');

      if (profileError) {
        console.error('Erro ao criar perfil do usuário administrador:', profileError);
        return NextResponse.json(
          { error: 'Erro ao criar perfil do usuário administrador', details: profileError.message },
          { status: 500 }
        );
      }

      // Adicionar permissões de administrador
      console.log('Adicionando permissões de administrador para o usuário:', newUser?.id);

      // Verificar se a tabela user_permissions existe
      try {
        // Verificar se o usuário já tem permissões
        const { data: existingPermissions, error: permCheckError } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', newUser?.id)
          .eq('module', 'admin');

        console.log('Verificação de permissões existentes:', existingPermissions || 'Nenhuma', permCheckError || 'Sem erro');

        if (permCheckError) {
          console.error('Erro ao verificar permissões existentes:', permCheckError);
        }

        // Se não tiver permissões, adicionar
        if (!existingPermissions || existingPermissions.length === 0) {
          const permissionsData = [
            { user_id: newUser?.id, module: 'admin', feature: null },
            { user_id: newUser?.id, module: 'dashboard', feature: null },
            { user_id: newUser?.id, module: 'users', feature: null },
            { user_id: newUser?.id, module: 'settings', feature: null },
            { user_id: newUser?.id, module: 'avaliacao', feature: null }
          ];

          console.log('Dados de permissões a serem inseridos:', permissionsData);

          const { data: permissionsResult, error: permissionsError } = await supabase
            .from('user_permissions')
            .insert(permissionsData);

          console.log('Resultado da inserção de permissões:', permissionsResult || 'Sem dados', permissionsError || 'Sem erro');

          if (permissionsError) {
            console.error('Erro ao adicionar permissões de administrador:', permissionsError);
          }
        } else {
          console.log('Usuário já possui permissões de administrador');
        }
      } catch (error) {
        console.error('Erro ao verificar ou adicionar permissões:', error);
      }

      return NextResponse.json({
        success: true,
        message: 'Usuário administrador criado com sucesso',
        user: newUser
      });
    } else {
      console.log('Usuário administrador encontrado, verificando permissões:', existingUser);

      // Verificar se o usuário tem o papel de administrador
      if (existingUser.role !== 'ADMIN') {
        console.log('Atualizando papel para ADMIN');

        // Atualizar o papel para ADMIN
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'ADMIN' })
          .eq('id', existingUser.id);

        if (updateError) {
          console.error('Erro ao atualizar papel do usuário:', updateError);
          return NextResponse.json(
            { error: 'Erro ao atualizar papel do usuário', details: updateError.message },
            { status: 500 }
          );
        }
      }

      // Verificar se o usuário tem permissões de administrador
      console.log('Verificando permissões de administrador para o usuário:', existingUser?.id);

      try {
        const { data: permissions, error: permissionsError } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', existingUser?.id)
          .eq('module', 'admin');

        console.log('Permissões encontradas:', permissions || 'Nenhuma', 'Erro:', permissionsError || 'Nenhum');

        if (permissionsError) {
          console.error('Erro ao verificar permissões de administrador:', permissionsError);
        }

        // Se não tiver permissões de administrador, adicionar
        if (!permissions || permissions.length === 0) {
          console.log('Adicionando permissões de administrador para usuário existente');

          const permissionsToAdd = [
            { user_id: existingUser?.id, module: 'admin', feature: null },
            { user_id: existingUser?.id, module: 'dashboard', feature: null },
            { user_id: existingUser?.id, module: 'users', feature: null },
            { user_id: existingUser?.id, module: 'settings', feature: null },
            { user_id: existingUser?.id, module: 'avaliacao', feature: null }
          ];

          console.log('Permissões a serem adicionadas:', permissionsToAdd);

          const { data: insertData, error: insertError } = await supabase
            .from('user_permissions')
            .insert(permissionsToAdd);

          console.log('Resultado da inserção de permissões:', insertData || 'Sem dados', 'Erro:', insertError || 'Nenhum');

          if (insertError) {
            console.error('Erro ao adicionar permissões de administrador:', insertError);
            // Não retornar erro, apenas logar
          }
        } else {
          console.log('Usuário já possui permissões de administrador');
        }
      } catch (error) {
        console.error('Erro ao verificar ou adicionar permissões:', error);
        // Não retornar erro, apenas logar
      }

      return NextResponse.json({
        success: true,
        message: 'Usuário administrador verificado e atualizado com sucesso',
        user: existingUser
      });
    }
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);

    return NextResponse.json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
