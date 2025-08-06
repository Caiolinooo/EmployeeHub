-- Script para adicionar colunas de verificação de email na tabela users_unified

-- Adicionar coluna para token de verificação de email
ALTER TABLE users_unified 
ADD COLUMN IF NOT EXISTS email_verification_token TEXT;

-- Adicionar coluna para status de verificação de email
ALTER TABLE users_unified 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Adicionar coluna para status de verificação de telefone
ALTER TABLE users_unified 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Criar índice para melhorar performance na busca por token
CREATE INDEX IF NOT EXISTS idx_users_unified_email_verification_token 
ON users_unified(email_verification_token);

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users_unified' 
AND column_name IN ('email_verification_token', 'email_verified', 'phone_verified')
ORDER BY column_name;
