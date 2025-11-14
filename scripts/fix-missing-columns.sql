-- Script para adicionar colunas faltantes no banco de dados
-- Correção para erros de schema identificados no sistema de avaliações

-- Adicionar coluna deleted_at à tabela users_unified se não existir
DO $$
BEGIN;
    -- Verificar se a coluna já existe antes de tentar adicionar
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users_unified'
        AND column_name = 'deleted_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users_unified
        ADD COLUMN deleted_at TIMESTAMP NULL;

        COMMENT ON COLUMN users_unified.deleted_at IS 'Data de exclusão suave para usuários (soft delete)';

        RAISE NOTICE 'Coluna deleted_at adicionada à tabela users_unified';
    ELSE
        RAISE NOTICE 'Coluna deleted_at já existe na tabela users_unified';
    END IF;
END $$;

-- Adicionar colunas faltantes à tabela notifications se não existirem
DO $$
BEGIN;
    -- Verificar se a tabela notifications existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'notifications'
        AND table_schema = 'public'
    ) THEN
        -- Adicionar coluna email_sent se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications'
            AND column_name = 'email_sent'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE notifications
            ADD COLUMN email_sent BOOLEAN DEFAULT FALSE;

            COMMENT ON COLUMN notifications.email_sent IS 'Indica se a notificação foi enviada por email';

            RAISE NOTICE 'Coluna email_sent adicionada à tabela notifications';
        ELSE
            RAISE NOTICE 'Coluna email_sent já existe na tabela notifications';
        END IF;

        -- Adicionar coluna push_sent se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications'
            AND column_name = 'push_sent'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE notifications
            ADD COLUMN push_sent BOOLEAN DEFAULT FALSE;

            COMMENT ON COLUMN notifications.push_sent IS 'Indica se a notificação foi enviada via push notification';

            RAISE NOTICE 'Coluna push_sent adicionada à tabela notifications';
        ELSE
            RAISE NOTICE 'Coluna push_sent já existe na tabela notifications';
        END IF;

        -- Verificar outras colunas que possam estar faltando
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications'
            AND column_name = 'read'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE notifications
            ADD COLUMN "read" BOOLEAN DEFAULT FALSE;

            COMMENT ON COLUMN notifications.read IS 'Indica se a notificação foi lida';

            RAISE NOTICE 'Coluna read adicionada à tabela notifications';
        END IF;

        -- Verificar se a coluna type existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications'
            AND column_name = 'type'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE notifications
            ADD COLUMN type VARCHAR(100) DEFAULT 'info';

            COMMENT ON COLUMN notifications.type IS 'Tipo da notificação (info, warning, error, success)';

            RAISE NOTICE 'Coluna type adicionada à tabela notifications';
        END IF;

        -- Verificar se a coluna data existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications'
            AND column_name = 'data'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE notifications
            ADD COLUMN data JSONB NULL;

            COMMENT ON COLUMN notifications.data IS 'Dados adicionais da notificação em formato JSON';

            RAISE NOTICE 'Coluna data adicionada à tabela notifications';
        END IF;

        RAISE NOTICE 'Estrutura da tabela notifications atualizada com sucesso';
    ELSE
        RAISE WARNING 'Tabela notifications não encontrada - isso pode ser normal se o sistema não usa notificações ainda';
    END IF;
END $$;

-- Verificar se as alterações foram aplicadas com sucesso
DO $$
BEGIN
    -- Verificar users_unified
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users_unified'
        AND column_name = 'deleted_at'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE '✅ Coluna deleted_at verificada em users_unified';
    END IF;

    -- Verificar notifications
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'notifications'
        AND table_schema = 'public'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications'
            AND column_name = 'email_sent'
            AND table_schema = 'public'
        ) THEN
            RAISE NOTICE '✅ Coluna email_sent verificada em notifications';
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications'
            AND column_name = 'push_sent'
            AND table_schema = 'public'
        ) THEN
            RAISE NOTICE '✅ Coluna push_sent verificada em notifications';
        END IF;
    END IF;

    RAISE NOTICE '🎉 Verificação final concluída com sucesso!';
END $$;