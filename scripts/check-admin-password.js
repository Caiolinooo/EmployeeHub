/**
 * Script para verificar e corrigir a senha do usuário administrador
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Configurações
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
const adminPassword = process.env.ADMIN_PASSWORD || 'Caio@2122@';

console.log('🔍 Verificação da Senha do Administrador');
console.log('========================================');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar definidos');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAdminPassword() {
  try {
    console.log('📧 Admin Email:', adminEmail);
    console.log('📱 Admin Phone:', adminPhone);
    console.log('🔑 Admin Password (primeiros 3 chars):', adminPassword.substring(0, 3) + '...');

    console.log('\n🔍 1. Buscando usuário administrador...');

    // Buscar por email
    const { data: adminByEmail, error: emailError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('email', adminEmail)
      .single();

    // Buscar por telefone
    const { data: adminByPhone, error: phoneError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('phone_number', adminPhone)
      .single();

    let adminUser = adminByEmail || adminByPhone;

    if (!adminUser) {
      console.log('❌ Usuário administrador não encontrado');
      console.log('🔧 Criando usuário administrador...');
      adminUser = await createAdminUser();
    } else {
      console.log('✅ Usuário administrador encontrado');
      console.log('📧 Email:', adminUser.email);
      console.log('📱 Phone:', adminUser.phone_number);
      console.log('👤 Role:', adminUser.role);
      console.log('✅ Active:', adminUser.active);
    }

    console.log('\n🔍 2. Verificando senha...');

    if (!adminUser.password) {
      console.log('❌ Usuário não tem senha definida');
      console.log('🔧 Definindo senha...');
      await setPassword(adminUser.id);
    } else {
      console.log('✅ Usuário tem senha definida');
      console.log('🔑 Hash da senha (primeiros 20 chars):', adminUser.password.substring(0, 20) + '...');

      // Verificar se a senha está correta
      const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.password);
      console.log('🔍 Verificação da senha:', isPasswordValid ? '✅ VÁLIDA' : '❌ INVÁLIDA');

      if (!isPasswordValid) {
        console.log('🔧 Atualizando senha...');
        await setPassword(adminUser.id);
      }
    }

    console.log('\n🔍 3. Verificando permissões...');

    if (adminUser.role !== 'ADMIN') {
      console.log('❌ Role não é ADMIN, atualizando...');
      await updateRole(adminUser.id);
    } else {
      console.log('✅ Role é ADMIN');
    }

    if (!adminUser.active) {
      console.log('❌ Usuário não está ativo, ativando...');
      await activateUser(adminUser.id);
    } else {
      console.log('✅ Usuário está ativo');
    }

    console.log('\n🔍 4. Teste de login...');
    await testLogin();

    console.log('\n✅ Verificação concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante a verificação:', error);
    process.exit(1);
  }
}

async function createAdminUser() {
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const { data: newAdmin, error } = await supabase
    .from('users_unified')
    .insert({
      email: adminEmail,
      phone_number: adminPhone,
      first_name: 'Caio',
      last_name: 'Correia',
      password: hashedPassword,
      password_hash: hashedPassword, // Para compatibilidade
      role: 'ADMIN',
      position: 'Administrador do Sistema',
      department: 'TI',
      active: true,
      is_authorized: true,
      authorization_status: 'active',
      password_last_changed: new Date().toISOString(),
      access_permissions: {
        modules: {
          dashboard: true,
          manual: true,
          procedimentos: true,
          politicas: true,
          calendario: true,
          noticias: true,
          reembolso: true,
          contracheque: true,
          ponto: true,
          admin: true,
          avaliacao: true
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Erro ao criar usuário administrador:', error);
    throw error;
  }

  console.log('✅ Usuário administrador criado com sucesso');
  return newAdmin;
}

async function setPassword(userId) {
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const { error } = await supabase
    .from('users_unified')
    .update({
      password: hashedPassword,
      password_hash: hashedPassword, // Para compatibilidade
      password_last_changed: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    console.error('❌ Erro ao definir senha:', error);
    throw error;
  }

  console.log('✅ Senha definida com sucesso');
}

async function updateRole(userId) {
  const { error } = await supabase
    .from('users_unified')
    .update({
      role: 'ADMIN',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    console.error('❌ Erro ao atualizar role:', error);
    throw error;
  }

  console.log('✅ Role atualizada para ADMIN');
}

async function activateUser(userId) {
  const { error } = await supabase
    .from('users_unified')
    .update({
      active: true,
      is_authorized: true,
      authorization_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    console.error('❌ Erro ao ativar usuário:', error);
    throw error;
  }

  console.log('✅ Usuário ativado');
}

async function testLogin() {
  try {
    // Buscar usuário
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('email', adminEmail)
      .single();

    if (userError || !user) {
      console.log('❌ Erro ao buscar usuário para teste:', userError?.message);
      return;
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(adminPassword, user.password);
    
    if (isPasswordValid) {
      console.log('✅ Teste de login: SUCESSO');
      console.log('🎉 O administrador pode fazer login com as credenciais fornecidas');
    } else {
      console.log('❌ Teste de login: FALHOU');
      console.log('💥 A senha não confere');
    }

  } catch (error) {
    console.error('❌ Erro no teste de login:', error);
  }
}

// Executar verificação
checkAdminPassword().then(() => {
  console.log('\n🎉 Script concluído!');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Script falhou:', error);
  process.exit(1);
});
