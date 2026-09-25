/**
 * Script para configurar o usuário administrador no Supabase
 * Este script cria ou atualiza o usuário administrador e gera um token JWT
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Configurações (somente process.env, sem default)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PHONE = process.env.ADMIN_PHONE_NUMBER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TOKEN_NAME = process.env.NEXT_PUBLIC_TOKEN_NAME || 'token';
const TOKEN_FILE_NAME = process.env.TOKEN_FILE_NAME || '.token';

const missingEnv = [
  !SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
  !SUPABASE_ANON_KEY && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  !JWT_SECRET && 'JWT_SECRET',
  !ADMIN_EMAIL && 'ADMIN_EMAIL',
  !ADMIN_PHONE && 'ADMIN_PHONE_NUMBER',
  !ADMIN_PASSWORD && 'ADMIN_PASSWORD',
].filter(Boolean);

if (missingEnv.length > 0) {
  console.error(`Erro: variáveis de ambiente obrigatórias ausentes: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Criar cliente Supabase
console.log('Criando cliente Supabase...');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupAdmin() {
  try {
    console.log('Verificando usuário administrador...');

    // Tentar fazer login com o usuário administrador
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    let userId;

    if (signInError) {
      console.log('Erro ao fazer login:', signInError.message);
      console.log('Tentando criar usuário administrador...');

      // Criar usuário administrador
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        phone: ADMIN_PHONE,
        options: {
          data: {
            role: 'ADMIN'
          }
        }
      });

      if (signUpError) {
        console.error('Erro ao criar usuário administrador:', signUpError.message);
        return null;
      }

      console.log('Usuário administrador criado com sucesso!');
      userId = signUpData.user.id;
    } else {
      console.log('Login com usuário administrador bem-sucedido!');
      userId = signInData.user.id;
    }

    // Verificar se o perfil do usuário existe
    console.log('Verificando perfil do usuário...');
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.log('Perfil não encontrado, verificando se existe por email...');

      // Verificar se existe um perfil com o mesmo email
      const { data: existingProfile, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', ADMIN_EMAIL)
        .single();

      if (emailError) {
        console.log('Perfil não encontrado por email, criando novo perfil...');

        // Criar perfil para o usuário
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: ADMIN_EMAIL,
            phone_number: ADMIN_PHONE,
            first_name: 'Caio',
            last_name: 'Correia',
            role: 'ADMIN',
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            access_permissions: { modules: { admin: true } }
          })
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao criar perfil:', insertError.message);

          if (insertError.message.includes('duplicate key')) {
            console.log('Tentando atualizar perfil existente...');

            // Atualizar o perfil existente (sem alterar o ID para evitar problemas com chaves estrangeiras)
            const { error: updateError } = await supabase
              .from('users')
              .update({
                phone_number: ADMIN_PHONE,
                first_name: 'Caio',
                last_name: 'Correia',
                role: 'ADMIN',
                active: true,
                updated_at: new Date().toISOString(),
                access_permissions: { modules: { admin: true } }
              })
              .eq('email', ADMIN_EMAIL);

            if (updateError) {
              console.error('Erro ao atualizar perfil existente:', updateError.message);
              return null;
            }

            console.log('Perfil existente atualizado com sucesso!');
          } else {
            return null;
          }
        } else {
          console.log('Perfil criado com sucesso!');
        }
      } else {
        console.log('Perfil encontrado por email, atualizando...');

        // Atualizar o perfil existente (sem alterar o ID para evitar problemas com chaves estrangeiras)
        const { error: updateError } = await supabase
          .from('users')
          .update({
            phone_number: ADMIN_PHONE,
            first_name: 'Caio',
            last_name: 'Correia',
            role: 'ADMIN',
            active: true,
            updated_at: new Date().toISOString(),
            access_permissions: { modules: { admin: true } }
          })
          .eq('email', ADMIN_EMAIL);

        if (updateError) {
          console.error('Erro ao atualizar perfil existente:', updateError.message);
          return null;
        }

        console.log('Perfil existente atualizado com sucesso!');
      }
    } else {
      console.log('Perfil encontrado, verificando permissões...');

      // Verificar se o usuário tem papel de administrador
      if (profile.role !== 'ADMIN') {
        console.log('Atualizando papel para ADMIN...');

        // Atualizar o papel para ADMIN
        const { error: updateError } = await supabase
          .from('users')
          .update({
            role: 'ADMIN',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Erro ao atualizar papel:', updateError.message);
        }
      }

      // Verificar se o usuário tem permissões de administrador
      if (!profile.access_permissions ||
          !profile.access_permissions.modules ||
          !profile.access_permissions.modules.admin) {

        console.log('Atualizando permissões...');

        // Atualizar permissões
        const { error: updateError } = await supabase
          .from('users')
          .update({
            access_permissions: {
              ...(profile.access_permissions || {}),
              modules: {
                ...(profile.access_permissions?.modules || {}),
                admin: true
              }
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Erro ao atualizar permissões:', updateError.message);
        }
      }
    }

    // Gerar token JWT
    console.log('Gerando token JWT...');
    const payload = {
      userId: userId,
      email: ADMIN_EMAIL,
      phoneNumber: ADMIN_PHONE,
      role: 'ADMIN',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 dias
    };

    const token = jwt.sign(payload, JWT_SECRET);

    // Salvar token em um arquivo
    fs.writeFileSync(TOKEN_FILE_NAME, token);

    console.log(`Token JWT gerado e salvo em ${TOKEN_FILE_NAME}`);

    return {
      userId,
      token
    };
  } catch (error) {
    console.error('Erro não tratado:', error);
    return null;
  }
}

// Executar a função principal
setupAdmin()
  .then(result => {
    if (result) {
      console.log('\nConfiguração do administrador concluída com sucesso!');
      console.log('ID do usuário:', result.userId);
      console.log('\nToken JWT:');
      console.log(result.token);

      console.log('\nPara usar o token:');
      console.log('1. No localStorage do navegador:');
      console.log(`localStorage.setItem('${TOKEN_NAME}', '${result.token}');`);

      process.exit(0);
    } else {
      console.error('Falha na configuração do administrador');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
