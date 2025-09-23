/**
 * Script para criar a tabela de refresh tokens no Supabase
 * Execute este script uma vez para criar a estrutura necessária
 */

import { supabaseAdmin } from './supabase';

export async function createRefreshTokensTable() {
  try {
    console.log('Criando tabela refresh_tokens...');

    // SQL para criar a tabela
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        remember_me BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    const { error: createError } = await supabaseAdmin.rpc('exec_sql', {
      sql: createTableSQL
    });

    if (createError) {
      console.error('Erro ao criar tabela:', createError);
      return false;
    }

    // Criar índices para performance
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(is_active);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `;

    const { error: indexError } = await supabaseAdmin.rpc('exec_sql', {
      sql: createIndexesSQL
    });

    if (indexError) {
      console.error('Erro ao criar índices:', indexError);
      return false;
    }

    // Criar trigger para updated_at
    const createTriggerSQL = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_refresh_tokens_updated_at ON refresh_tokens;
      CREATE TRIGGER update_refresh_tokens_updated_at
        BEFORE UPDATE ON refresh_tokens
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    const { error: triggerError } = await supabaseAdmin.rpc('exec_sql', {
      sql: createTriggerSQL
    });

    if (triggerError) {
      console.error('Erro ao criar trigger:', triggerError);
      return false;
    }

    console.log('Tabela refresh_tokens criada com sucesso!');
    return true;

  } catch (error) {
    console.error('Erro geral ao criar tabela:', error);
    return false;
  }
}

// Função alternativa usando SQL direto se a função exec_sql não existir
export async function createRefreshTokensTableDirect() {
  try {
    console.log('Criando tabela refresh_tokens usando SQL direto...');

    // Verificar se a tabela já existe
    const { data: existingTable } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'refresh_tokens')
      .single();

    if (existingTable) {
      console.log('Tabela refresh_tokens já existe');
      return true;
    }

    // Como não podemos executar SQL DDL diretamente via cliente,
    // vamos criar um script SQL que pode ser executado manualmente
    const sqlScript = `
-- Script SQL para criar tabela refresh_tokens
-- Execute este script no SQL Editor do Supabase Dashboard

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  remember_me BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Criar função e trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_refresh_tokens_updated_at ON refresh_tokens;
CREATE TRIGGER update_refresh_tokens_updated_at
  BEFORE UPDATE ON refresh_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security)
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas seus próprios refresh tokens
CREATE POLICY "Users can view own refresh tokens" ON refresh_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Política para permitir que usuários insiram seus próprios refresh tokens
CREATE POLICY "Users can insert own refresh tokens" ON refresh_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para permitir que usuários atualizem seus próprios refresh tokens
CREATE POLICY "Users can update own refresh tokens" ON refresh_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Política para permitir que usuários deletem seus próprios refresh tokens
CREATE POLICY "Users can delete own refresh tokens" ON refresh_tokens
  FOR DELETE USING (auth.uid() = user_id);
`;

    console.log('Script SQL para criar tabela refresh_tokens:');
    console.log(sqlScript);
    
    console.log('\n⚠️  AÇÃO NECESSÁRIA:');
    console.log('1. Acesse o Supabase Dashboard');
    console.log('2. Vá para SQL Editor');
    console.log('3. Execute o script SQL acima');
    console.log('4. A tabela refresh_tokens será criada');

    return true;

  } catch (error) {
    console.error('Erro ao preparar criação da tabela:', error);
    return false;
  }
}
