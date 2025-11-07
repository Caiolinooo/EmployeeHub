import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Iniciando verificação e criação do perfil de administrador');

    // Obter configurações do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const jwtSecret = process.env.JWT_SECRET || '';

    // Verificar configurações
    if (!supabaseUrl || !supabaseAnonKey || !jwtSecret) {
      return NextResponse.json({
        success: false,
        message: 'Configurações incompletas',
        config: {
          supabaseUrl: supabaseUrl ? 'Configurado' : 'Não configurado',
          supabaseAnonKey: supabaseAnonKey ? 'Configurado' : 'Não configurado',
          jwtSecret: jwtSecret ? 'Configurado' : 'Não configurado'
        }
      }, { status: 500 });
    }

    // Usando cliente Supabase já inicializado em lib/supabase.ts
    console.log('Usando cliente Supabase pré-inicializado com URL:', supabaseUrl);

    // Definir informações do administrador
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Caio';
    const adminLastName = process.env.ADMIN_LAST_NAME || 'Correia';

    console.log('Buscando administrador com email:', adminEmail);

    // Buscar o usuário administrador
    let adminUser;
    const { data: adminByEmail, error: adminError } = await supabase
      .from('users')
      .select('id, email, role, phone_number, first_name, last_name, access_permissions')
      .eq('email', adminEmail)
      .single();

    if (adminError || !adminByEmail) {
      console.log('Administrador não encontrado por email, tentando por telefone');

      const { data: adminByPhone, error: phoneError } = await supabase
        .from('users')
        .select('id, email, role, phone_number, first_name, last_name, access_permissions')
        .eq('phone_number', adminPhone)
        .single();

      if (phoneError || !adminByPhone) {
        console.log('Administrador não encontrado, tentando criar...');

        // Tentar criar usuário administrador
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: adminEmail,
          password: process.env.ADMIN_PASSWORD || 'Caio@2122@',
          options: {
            data: {
              first_name: adminFirstName,
              last_name: adminLastName,
              role: 'ADMIN'
            }
          }
        });

        if (signUpError) {
          console.error('Erro ao criar usuário administrador:', signUpError);

          // Tentar fazer login com o usuário administrador
          console.log('Tentando fazer login com o usuário administrador...');

          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: adminEmail,
            password: process.env.ADMIN_PASSWORD || 'Caio@2122@'
          });

          if (signInError) {
            console.error('Erro ao fazer login com o usuário administrador:', signInError);

            // Gerar um ID para o administrador
            const adminId = crypto.randomUUID();

            // Criar perfil para o administrador sem autenticação
            const { data: newAdmin, error: createError } = await supabase
              .from('users')
              .insert({
                id: adminId,
                email: adminEmail,
                phone_number: adminPhone,
                first_name: adminFirstName,
                last_name: adminLastName,
                role: 'ADMIN',
                active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                access_permissions: { modules: { admin: true } }
              })
              .select('*')
              .single();

            if (createError) {
              console.error('Erro ao criar perfil de administrador:', createError);
              return NextResponse.json({
                success: false,
                message: 'Erro ao criar perfil de administrador',
                error: createError.message
              }, { status: 500 });
            }

            adminUser = newAdmin;
          } else {
            console.log('Login com o usuário administrador bem-sucedido');

            // Verificar se o usuário já tem um perfil
            const { data: existingProfile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', signInData.user.id)
              .single();

            if (profileError || !existingProfile) {
              // Criar perfil para o usuário
              const { data: newProfile, error: createError } = await supabase
                .from('users')
                .insert({
                  id: signInData.user.id,
                  email: adminEmail,
                  phone_number: adminPhone,
                  first_name: adminFirstName,
                  last_name: adminLastName,
                  role: 'ADMIN',
                  active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  access_permissions: { modules: { admin: true } }
                })
                .select('*')
                .single();

              if (createError) {
                console.error('Erro ao criar perfil para o usuário:', createError);
                return NextResponse.json({
                  success: false,
                  message: 'Erro ao criar perfil para o usuário',
                  error: createError.message
                }, { status: 500 });
              }

              adminUser = newProfile;
            } else {
              adminUser = existingProfile;
            }
          }
        } else {
          console.log('Usuário administrador criado com sucesso:', signUpData.user?.id);

          // Criar perfil para o usuário
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert({
              id: signUpData.user?.id || '',
              email: adminEmail,
              phone_number: adminPhone,
              first_name: adminFirstName,
              last_name: adminLastName,
              role: 'ADMIN',
              active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              access_permissions: { modules: { admin: true } }
            })
            .select('*')
            .single();

          if (createError) {
            console.error('Erro ao criar perfil para o usuário:', createError);
            return NextResponse.json({
              success: false,
              message: 'Erro ao criar perfil para o usuário',
              error: createError.message
            }, { status: 500 });
          }

          adminUser = newProfile;
        }
      } else {
        // Usar o administrador encontrado por telefone
        adminUser = adminByPhone;
      }
    } else {
      // Usar o administrador encontrado por email
      adminUser = adminByEmail;
    }

    // Verificar se temos um usuário administrador
    if (!adminUser) {
      return NextResponse.json({
        success: false,
        message: 'Não foi possível encontrar ou criar o usuário administrador'
      }, { status: 500 });
    }

    // Verificar se o usuário tem papel de administrador
    if (adminUser.role !== 'ADMIN') {
      console.log('Usuário encontrado não é administrador, atualizando papel...');

      // Atualizar o papel para ADMIN
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: 'ADMIN',
          access_permissions: { modules: { admin: true } }
        })
        .eq('id', adminUser.id);

      if (updateError) {
        console.error('Erro ao atualizar papel do usuário para ADMIN:', updateError);
      } else {
        // Atualizar o objeto do usuário
        adminUser.role = 'ADMIN';
        adminUser.access_permissions = { modules: { admin: true } };
      }
    }

    // Verificar se o usuário tem permissões de administrador
    if (!adminUser.access_permissions ||
        !adminUser.access_permissions.modules ||
        !adminUser.access_permissions.modules.admin) {

      console.log('Atualizando permissões de administrador...');

      // Atualizar permissões
      const { error: updateError } = await supabase
        .from('users')
        .update({
          access_permissions: {
            ...(adminUser.access_permissions || {}),
            modules: {
              ...(adminUser.access_permissions?.modules || {}),
              admin: true
            }
          }
        })
        .eq('id', adminUser.id);

      if (updateError) {
        console.error('Erro ao atualizar permissões de administrador:', updateError);
      } else {
        // Atualizar o objeto do usuário
        adminUser.access_permissions = {
          ...(adminUser.access_permissions || {}),
          modules: {
            ...(adminUser.access_permissions?.modules || {}),
            admin: true
          }
        };
      }
    }

    // Gerar token JWT
    const payload = {
      userId: adminUser.id,
      email: adminUser.email,
      phoneNumber: adminUser.phone_number,
      role: 'ADMIN',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 dias
    };

    const token = jwt.sign(payload, jwtSecret);

    return NextResponse.json({
      success: true,
      message: 'Perfil de administrador verificado e configurado com sucesso',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        phoneNumber: adminUser.phone_number,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        role: adminUser.role,
        accessPermissions: adminUser.access_permissions
      },
      token
    });
  } catch (error) {
    console.error('Erro ao verificar perfil de administrador:', error);
    return NextResponse.json({
      success: false,
      message: 'Erro ao verificar perfil de administrador',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
