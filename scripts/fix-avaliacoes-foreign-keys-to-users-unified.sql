-- ============================================================================
-- Script: Corrigir Foreign Keys de avaliacoes_desempenho para users_unified
-- Data: 2025-11-11
-- Descrição: Remove foreign keys antigas que apontam para tabela 'funcionarios'
--            e cria novas foreign keys apontando para 'users_unified'
-- ============================================================================

-- Etapa 1: Remover foreign keys antigas (se existirem)
DO $$
BEGIN
    -- Remover constraints antigas com prefixo fk_ (apontam para funcionarios)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_avaliacoes_desempenho_funcionario'
        AND table_name = 'avaliacoes_desempenho'
    ) THEN
        ALTER TABLE avaliacoes_desempenho
        DROP CONSTRAINT fk_avaliacoes_desempenho_funcionario;
        RAISE NOTICE 'Constraint fk_avaliacoes_desempenho_funcionario removida';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_avaliacoes_desempenho_avaliador'
        AND table_name = 'avaliacoes_desempenho'
    ) THEN
        ALTER TABLE avaliacoes_desempenho
        DROP CONSTRAINT fk_avaliacoes_desempenho_avaliador;
        RAISE NOTICE 'Constraint fk_avaliacoes_desempenho_avaliador removida';
    END IF;

    -- Remover constraint de funcionario_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'avaliacoes_desempenho_funcionario_id_fkey'
        AND table_name = 'avaliacoes_desempenho'
    ) THEN
        ALTER TABLE avaliacoes_desempenho
        DROP CONSTRAINT avaliacoes_desempenho_funcionario_id_fkey;
        RAISE NOTICE 'Constraint avaliacoes_desempenho_funcionario_id_fkey removida';
    ELSE
        RAISE NOTICE 'Constraint avaliacoes_desempenho_funcionario_id_fkey não existe';
    END IF;

    -- Remover constraint de avaliador_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'avaliacoes_desempenho_avaliador_id_fkey'
        AND table_name = 'avaliacoes_desempenho'
    ) THEN
        ALTER TABLE avaliacoes_desempenho
        DROP CONSTRAINT avaliacoes_desempenho_avaliador_id_fkey;
        RAISE NOTICE 'Constraint avaliacoes_desempenho_avaliador_id_fkey removida';
    ELSE
        RAISE NOTICE 'Constraint avaliacoes_desempenho_avaliador_id_fkey não existe';
    END IF;

    -- Remover constraint de periodo_id (se existir)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'avaliacoes_desempenho_periodo_id_fkey'
        AND table_name = 'avaliacoes_desempenho'
    ) THEN
        ALTER TABLE avaliacoes_desempenho
        DROP CONSTRAINT avaliacoes_desempenho_periodo_id_fkey;
        RAISE NOTICE 'Constraint avaliacoes_desempenho_periodo_id_fkey removida';
    ELSE
        RAISE NOTICE 'Constraint avaliacoes_desempenho_periodo_id_fkey não existe';
    END IF;
END $$;

-- Etapa 2: Criar novas foreign keys apontando para users_unified
DO $$
BEGIN
    -- Criar foreign key para funcionario_id → users_unified
    BEGIN
        ALTER TABLE avaliacoes_desempenho
        ADD CONSTRAINT avaliacoes_desempenho_funcionario_id_fkey
        FOREIGN KEY (funcionario_id)
        REFERENCES users_unified(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
        RAISE NOTICE 'Foreign key funcionario_id → users_unified criada';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Foreign key funcionario_id → users_unified já existe';
    END;

    -- Criar foreign key para avaliador_id → users_unified
    BEGIN
        ALTER TABLE avaliacoes_desempenho
        ADD CONSTRAINT avaliacoes_desempenho_avaliador_id_fkey
        FOREIGN KEY (avaliador_id)
        REFERENCES users_unified(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
        RAISE NOTICE 'Foreign key avaliador_id → users_unified criada';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Foreign key avaliador_id → users_unified já existe';
    END;

    -- Recriar foreign key para periodo_id (se a tabela periodos_avaliacao existir)
    BEGIN
        ALTER TABLE avaliacoes_desempenho
        ADD CONSTRAINT avaliacoes_desempenho_periodo_id_fkey
        FOREIGN KEY (periodo_id)
        REFERENCES periodos_avaliacao(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
        RAISE NOTICE 'Foreign key periodo_id → periodos_avaliacao criada';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Foreign key periodo_id → periodos_avaliacao já existe';
        WHEN undefined_table THEN
            RAISE NOTICE 'Tabela periodos_avaliacao não existe, foreign key não criada';
    END;
END $$;

-- Etapa 3: Verificar foreign keys criadas
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'avaliacoes_desempenho'
ORDER BY tc.constraint_name;

-- Etapa 4: Exibir resumo
DO $$
DECLARE
    fk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE table_name = 'avaliacoes_desempenho'
    AND constraint_type = 'FOREIGN KEY';

    RAISE NOTICE '============================================';
    RAISE NOTICE 'Script executado com sucesso!';
    RAISE NOTICE 'Total de foreign keys em avaliacoes_desempenho: %', fk_count;
    RAISE NOTICE '============================================';
END $$;
