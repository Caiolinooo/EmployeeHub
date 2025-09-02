-- SCRIPT DE CORREÇÃO: Adicionar coluna tax_id à tabela users_unified
-- Execute este script no SQL Editor do Supabase para corrigir o erro

-- ========================================
-- CORREÇÃO PARA ERRO: Could not find the 'tax_id' column
-- ========================================

BEGIN;

-- 1. Verificar se a tabela users_unified existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users_unified') THEN
        RAISE EXCEPTION 'Tabela users_unified não encontrada. Execute primeiro as migrações de criação da tabela.';
    END IF;
END $$;

-- 2. Adicionar coluna tax_id se não existir
ALTER TABLE users_unified
  ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- 3. Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_unified_tax_id ON users_unified(tax_id);

-- 4. Adicionar comentário para documentação
COMMENT ON COLUMN users_unified.tax_id IS 'CPF/CNPJ ou outro número de identificação fiscal';

-- 5. Verificar se a coluna foi criada com sucesso
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users_unified' 
        AND column_name = 'tax_id'
    ) THEN
        RAISE NOTICE 'Coluna tax_id adicionada com sucesso à tabela users_unified';
    ELSE
        RAISE EXCEPTION 'Falha ao adicionar coluna tax_id';
    END IF;
END $$;

COMMIT;

-- ========================================
-- VERIFICAÇÃO FINAL
-- ========================================

-- Listar todas as colunas da tabela users_unified para confirmar
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users_unified'
ORDER BY ordinal_position;
