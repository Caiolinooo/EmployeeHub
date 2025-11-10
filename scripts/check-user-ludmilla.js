/**
 * Script para verificar o estado do usuário ludmilla.oliveira@groupabz.com
 */

const { Pool } = require('pg');
require('dotenv').config();

async function checkUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 Buscando usuário ludmilla.oliveira@groupabz.com...\n');

    const result = await pool.query(`
      SELECT
        id,
        email,
        phone_number,
        first_name,
        last_name,
        role,
        active,
        email_verified,
        password IS NOT NULL as has_password,
        password_hash IS NOT NULL as has_password_hash,
        LENGTH(password) as password_length,
        LENGTH(password_hash) as password_hash_length,
        SUBSTRING(password, 1, 30) as password_preview,
        SUBSTRING(password_hash, 1, 30) as password_hash_preview,
        authorization_status,
        created_at,
        updated_at
      FROM users_unified
      WHERE email = 'ludmilla.oliveira@groupabz.com'
    `);

    if (result.rows.length === 0) {
      console.log('❌ Usuário não encontrado!');
      return;
    }

    const user = result.rows[0];
    console.log('✅ Usuário encontrado:\n');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Telefone:', user.phone_number);
    console.log('Nome:', user.first_name, user.last_name);
    console.log('Role:', user.role);
    console.log('Ativo:', user.active);
    console.log('Email verificado:', user.email_verified);
    console.log('Status autorização:', user.authorization_status);
    console.log('\n📝 Informações de Senha:');
    console.log('Tem password?', user.has_password);
    console.log('Tem password_hash?', user.has_password_hash);
    console.log('Tamanho password:', user.password_length);
    console.log('Tamanho password_hash:', user.password_hash_length);
    console.log('Preview password:', user.password_preview);
    console.log('Preview password_hash:', user.password_hash_preview);

    // Verificar se a senha está em formato bcrypt
    if (user.has_password) {
      const isBcrypt = user.password_preview && user.password_preview.startsWith('$2');
      console.log('\n🔐 Formato da senha no campo "password":', isBcrypt ? 'BCRYPT ✅' : 'TEXTO PLANO ❌');
    }

    if (user.has_password_hash) {
      const isBcrypt = user.password_hash_preview && user.password_hash_preview.startsWith('$2');
      console.log('🔐 Formato da senha no campo "password_hash":', isBcrypt ? 'BCRYPT ✅' : 'TEXTO PLANO ❌');
    }

    console.log('\nCriado em:', user.created_at);
    console.log('Atualizado em:', user.updated_at);

  } catch (error) {
    console.error('❌ Erro ao verificar usuário:', error.message);
  } finally {
    await pool.end();
  }
}

checkUser();
