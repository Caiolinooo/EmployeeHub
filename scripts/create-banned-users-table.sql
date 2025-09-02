-- Script para criar tabela de usuários banidos
-- Execute este script no Supabase SQL Editor

-- Criar tabela de usuários banidos
CREATE TABLE IF NOT EXISTS banned_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificadores do usuário banido
  email TEXT,
  phone_number TEXT,
  cpf TEXT,
  
  -- Informações do banimento
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  banned_by UUID REFERENCES users_unified(id),
  ban_reason TEXT,
  
  -- Informações do usuário original (para histórico)
  original_user_id UUID,
  first_name TEXT,
  last_name TEXT,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT banned_users_identifier_check CHECK (
    email IS NOT NULL OR phone_number IS NOT NULL OR cpf IS NOT NULL
  )
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_banned_users_email ON banned_users(email);
CREATE INDEX IF NOT EXISTS idx_banned_users_phone ON banned_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_banned_users_cpf ON banned_users(cpf);
CREATE INDEX IF NOT EXISTS idx_banned_users_banned_at ON banned_users(banned_at);

-- Habilitar RLS (Row Level Security)
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;

-- Política para administradores
CREATE POLICY "Administradores podem gerenciar usuários banidos" ON banned_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND (role = 'ADMIN' OR email = 'caio.correia@groupabz.com')
    )
  );

-- Comentários para documentação
COMMENT ON TABLE banned_users IS 'Tabela para armazenar usuários banidos permanentemente';
COMMENT ON COLUMN banned_users.email IS 'Email do usuário banido';
COMMENT ON COLUMN banned_users.phone_number IS 'Telefone do usuário banido';
COMMENT ON COLUMN banned_users.cpf IS 'CPF do usuário banido';
COMMENT ON COLUMN banned_users.banned_at IS 'Data e hora do banimento';
COMMENT ON COLUMN banned_users.banned_by IS 'ID do administrador que aplicou o banimento';
COMMENT ON COLUMN banned_users.ban_reason IS 'Motivo do banimento';
COMMENT ON COLUMN banned_users.original_user_id IS 'ID original do usuário antes do banimento';
