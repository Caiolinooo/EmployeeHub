-- Script simplificado para adicionar colunas faltantes

-- Adicionar coluna deleted_at à tabela users_unified
ALTER TABLE users_unified ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Adicionar colunas à tabela notifications se ela existir
DO $$
BEGIN
    -- Verificar se a tabela notifications existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT FALSE;
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS 'read' BOOLEAN DEFAULT FALSE;
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(100) DEFAULT 'info';
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB NULL;
    END IF;
END $$;