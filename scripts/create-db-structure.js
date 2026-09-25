/**
 * Script para criar a estrutura do banco de dados Supabase
 */

require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PHONE = process.env.ADMIN_PHONE_NUMBER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const missingEnv = [
  !SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
  !SUPABASE_ANON_KEY && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  !DATABASE_URL && 'DATABASE_URL',
  !ADMIN_EMAIL && 'ADMIN_EMAIL',
  !ADMIN_PHONE && 'ADMIN_PHONE_NUMBER',
  !ADMIN_PASSWORD && 'ADMIN_PASSWORD',
].filter(Boolean);

if (missingEnv.length > 0) {
  console.error(`Erro: variáveis de ambiente obrigatórias ausentes: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Função para executar uma consulta SQL
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
}

// Função para criar a tabela users
async function createUsersTable() {
  console.log('Criando tabela users...');
  
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      phone_number VARCHAR(20) UNIQUE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'USER',
      position VARCHAR(100),
      department VARCHAR(100),
      active BOOLEAN DEFAULT true,
      verification_code VARCHAR(10),
      verification_code_expires TIMESTAMP,
      password_last_changed TIMESTAMP,
      protocol VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await executeQuery(query);
    console.log('Tabela users criada com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao criar tabela users:', error);
    return false;
  }
}

// Função para criar a tabela user_permissions
async function createUserPermissionsTable() {
  console.log('Criando tabela user_permissions...');
  
  const query = `
    CREATE TABLE IF NOT EXISTS user_permissions (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      module VARCHAR(50) NOT NULL,
      feature VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, module, feature)
    );
  `;
  
  try {
    await executeQuery(query);
    console.log('Tabela user_permissions criada com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao criar tabela user_permissions:', error);
    return false;
  }
}

// Função para criar a tabela access_history
async function createAccessHistoryTable() {
  console.log('Criando tabela access_history...');
  
  const query = `
    CREATE TABLE IF NOT EXISTS access_history (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      action VARCHAR(50) NOT NULL,
      details TEXT,
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await executeQuery(query);
    console.log('Tabela access_history criada com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao criar tabela access_history:', error);
    return false;
  }
}

// Função para criar a tabela invite_codes
async function createInviteCodesTable() {
  console.log('Criando tabela invite_codes...');
  
  const query = `
    CREATE TABLE IF NOT EXISTS invite_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(255),
      created_by UUID REFERENCES users(id),
      expires_at TIMESTAMP NOT NULL,
      max_uses INTEGER DEFAULT 1,
      uses INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await executeQuery(query);
    console.log('Tabela invite_codes criada com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao criar tabela invite_codes:', error);
    return false;
  }
}

// Função para criar a tabela password_reset_tokens
async function createPasswordResetTokensTable() {
  console.log('Criando tabela password_reset_tokens...');
  
  const query = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      token VARCHAR(100) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await executeQuery(query);
    console.log('Tabela password_reset_tokens criada com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao criar tabela password_reset_tokens:', error);
    return false;
  }
}

// Função para criar o usuário administrador
async function createAdminUser() {
  console.log('Criando usuário administrador...');
  
  const { data: authUser, error: authError } = await supabase.auth.signUp({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    options: {
      data: {
        first_name: process.env.ADMIN_FIRST_NAME || 'Admin',
        last_name: process.env.ADMIN_LAST_NAME || 'User',
        phone_number: ADMIN_PHONE,
        role: 'ADMIN'
      }
    }
  });
  
  if (authError) {
    console.error('Erro ao criar usuário na autenticação:', authError);
    return false;
  }
  
  if (!authUser.user) {
    console.error('Erro ao criar usuário: nenhum usuário retornado');
    return false;
  }
  
  const userId = authUser.user.id;
  console.log('Usuário criado na autenticação:', userId);
  
  // Inserir o usuário na tabela users
  const insertQuery = `
    INSERT INTO users (
      id, email, phone_number, first_name, last_name, role, position, department, active, password_last_changed, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      phone_number = EXCLUDED.phone_number,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      role = EXCLUDED.role,
      position = EXCLUDED.position,
      department = EXCLUDED.department,
      active = EXCLUDED.active,
      updated_at = EXCLUDED.updated_at
    RETURNING id;
  `;
  
  const now = new Date();
  
  try {
    const result = await executeQuery(insertQuery, [
      userId,
      ADMIN_EMAIL,
      ADMIN_PHONE,
      'Caio',
      'Correia',
      'ADMIN',
      'Administrador do Sistema',
      'TI',
      true,
      now,
      now,
      now
    ]);
    
    console.log('Usuário inserido na tabela users:', result.rows[0].id);
    
    // Adicionar permissões ao usuário
    const modules = [
      'dashboard',
      'manual',
      'procedimentos',
      'politicas',
      'calendario',
      'noticias',
      'reembolso',
      'contracheque',
      'ponto',
      'avaliacao',
      'admin'
    ];
    
    for (const module of modules) {
      const permissionQuery = `
        INSERT INTO user_permissions (user_id, module, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, module, COALESCE(feature, '')) DO NOTHING;
      `;
      
      await executeQuery(permissionQuery, [userId, module, now, now]);
    }
    
    console.log('Permissões adicionadas com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao inserir usuário na tabela users:', error);
    return false;
  }
}

// Função principal
async function main() {
  try {
    console.log('Iniciando criação da estrutura do banco de dados...');
    
    // Criar tabelas
    const usersCreated = await createUsersTable();
    if (!usersCreated) {
      console.error('Falha ao criar tabela users. Abortando...');
      process.exit(1);
    }
    
    await createUserPermissionsTable();
    await createAccessHistoryTable();
    await createInviteCodesTable();
    await createPasswordResetTokensTable();
    
    // Criar usuário administrador
    await createAdminUser();
    
    console.log('Estrutura do banco de dados criada com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar estrutura do banco de dados:', error);
    process.exit(1);
  } finally {
    // Fechar a conexão com o banco de dados
    pool.end();
  }
}

// Executar a função principal
main();
