import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Iniciando geração de token de administrador para debug');

    // Obter configurações do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    const jwtSecret = process.env.JWT_SECRET || '';

    // Verificar configurações
    if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
      return NextResponse.json({
        success: false,
        message: 'Configurações incompletas',
        config: {
          supabaseUrl: supabaseUrl ? 'Configurado' : 'Não configurado',
          supabaseServiceKey: supabaseServiceKey ? 'Configurado' : 'Não configurado',
          jwtSecret: jwtSecret ? 'Configurado' : 'Não configurado'
        }
      }, { status: 500 });
    }

    // Usando cliente Supabase já inicializado em lib/supabase.ts

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
      .select('id, email, role, phone_number, first_name, last_name')
      .eq('email', adminEmail)
      .single();

    if (adminError || !adminByEmail) {
      console.log('Administrador não encontrado por email, tentando por telefone');

      const { data: adminByPhone, error: phoneError } = await supabase
        .from('users')
        .select('id, email, role, phone_number, first_name, last_name')
        .eq('phone_number', adminPhone)
        .single();

      if (phoneError || !adminByPhone) {
        console.log('Administrador não encontrado, verificando na autenticação...');

        // Verificar se o administrador existe na autenticação
        const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();

        let adminAuthUser = null;
        if (!authError && authUser) {
          adminAuthUser = authUser.users.find(user =>
            user.email === adminEmail || user.phone === adminPhone
          );
        }

        if (adminAuthUser) {
          console.log('Administrador encontrado na autenticação, criando perfil...');

          // Criar perfil para o administrador
          const { data: newAdmin, error: createError } = await supabase
            .from('users')
            .insert({
              id: adminAuthUser.id,
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

            // Tentar criar usuário na autenticação
            console.log('Tentando criar usuário administrador na autenticação...');

            const { data: newAuthUser, error: signUpError } = await supabase.auth.admin.createUser({
              email: adminEmail,
              phone: adminPhone,
              password: process.env.ADMIN_PASSWORD || 'Caio@2122@',
              email_confirm: true,
              user_metadata: {
                first_name: adminFirstName,
                last_name: adminLastName,
                role: 'ADMIN'
              }
            });

            if (signUpError) {
              console.error('Erro ao criar usuário administrador na autenticação:', signUpError);
              return NextResponse.json({
                success: false,
                message: 'Erro ao criar usuário administrador',
                error: signUpError.message
              }, { status: 500 });
            }

            // Criar perfil para o novo usuário
            const { data: newAdminProfile, error: profileError } = await supabase
              .from('users')
              .insert({
                id: newAuthUser.user.id,
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

            if (profileError) {
              console.error('Erro ao criar perfil para o novo usuário:', profileError);
              return NextResponse.json({
                success: false,
                message: 'Erro ao criar perfil para o novo usuário',
                error: profileError.message
              }, { status: 500 });
            }

            adminUser = newAdminProfile;
          } else {
            adminUser = newAdmin;
          }
        } else {
          // Criar usuário administrador do zero
          console.log('Administrador não encontrado na autenticação, criando do zero...');

          const { data: newAuthUser, error: signUpError } = await supabase.auth.admin.createUser({
            email: adminEmail,
            phone: adminPhone,
            password: process.env.ADMIN_PASSWORD || 'Caio@2122@',
            email_confirm: true,
            user_metadata: {
              first_name: adminFirstName,
              last_name: adminLastName,
              role: 'ADMIN'
            }
          });

          if (signUpError) {
            console.error('Erro ao criar usuário administrador na autenticação:', signUpError);
            return NextResponse.json({
              success: false,
              message: 'Erro ao criar usuário administrador',
              error: signUpError.message
            }, { status: 500 });
          }

          // Criar perfil para o novo usuário
          const { data: newAdminProfile, error: profileError } = await supabase
            .from('users')
            .insert({
              id: newAuthUser.user.id,
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

          if (profileError) {
            console.error('Erro ao criar perfil para o novo usuário:', profileError);
            return NextResponse.json({
              success: false,
              message: 'Erro ao criar perfil para o novo usuário',
              error: profileError.message
            }, { status: 500 });
          }

          adminUser = newAdminProfile;
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
      message: 'Token de administrador gerado com sucesso',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        phoneNumber: adminUser.phone_number,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        role: adminUser.role
      },
      token
    });
  } catch (error) {
    console.error('Erro ao gerar token de administrador:', error);
    return NextResponse.json({
      success: false,
      message: 'Erro ao gerar token de administrador',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
