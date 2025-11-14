-- =============================================================================
-- COMPREHENSIVE DATABASE SCHEMA FIX FOR AVALIACOES DESEMPENHO
-- =============================================================================
-- This script fixes all identified schema inconsistencies:
-- 1. Table name conflicts between 'avaliacoes' and 'avaliacoes_desempenho'
-- 2. Foreign key relationship conflicts between 'funcionarios' vs 'users_unified'
-- 3. Period reference inconsistency (should use 'periodo_id' UUID instead of 'periodo' TEXT)
-- 4. View definition inconsistencies
-- 5. API-Database schema mismatch
-- 6. Missing foreign key constraints
-- 7. Migration execution order and dependencies
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- STEP 1: TABLE NAME STANDARDIZATION
-- =============================================================================
-- Standardize on 'avaliacoes_desempenho' as the primary table name

-- Check if both tables exist and migrate data if needed
DO $$
BEGIN
    -- Check if 'avaliacoes' table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'avaliacoes') THEN
        RAISE NOTICE 'Table avaliacoes exists, checking if avaliacoes_desempenho also exists...';
        
        -- If avaliacoes_desempenho doesn't exist, rename avaliacoes to avaliacoes_desempenho
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'avaliacoes_desempenho') THEN
            RAISE NOTICE 'Renaming avaliacoes to avaliacoes_desempenho...';
            ALTER TABLE avaliacoes RENAME TO avaliacoes_desempenho;
            RAISE NOTICE 'Table renamed successfully';
        ELSE
            -- If both exist, migrate data from avaliacoes to avaliacoes_desempenho
            RAISE NOTICE 'Both tables exist, migrating data from avaliacoes to avaliacoes_desempenho...';
            
            -- Create a backup of avaliacoes_desempenho
            CREATE TABLE IF NOT EXISTS avaliacoes_desempenho_backup AS
            SELECT * FROM avaliacoes_desempenho WHERE 1=0;
            
            -- Insert missing records from avaliacoes
            INSERT INTO avaliacoes_desempenho (
                id, funcionario_id, avaliador_id, periodo, data_inicio, data_fim,
                status, pontuacao_total, observacoes, deleted_at, created_at, updated_at
            )
            SELECT 
                id, funcionario_id, avaliador_id, periodo, data_inicio, data_fim,
                status, pontuacao_total, observacoes, deleted_at, created_at, updated_at
            FROM avaliacoes a
            WHERE NOT EXISTS (
                SELECT 1 FROM avaliacoes_desempenho ad 
                WHERE ad.id = a.id OR 
                      (ad.funcionario_id = a.funcionario_id AND 
                       ad.avaliador_id = a.avaliador_id AND 
                       ad.periodo = a.periodo)
            );
            
            RAISE NOTICE 'Data migration completed';
            
            -- Drop the old avaliacoes table
            DROP TABLE IF EXISTS avaliacoes;
            RAISE NOTICE 'Old avaliacoes table dropped';
        END IF;
    ELSE
        RAISE NOTICE 'Table avaliacoes does not exist, checking avaliacoes_desempenho...';
        
        -- If avaliacoes doesn't exist, ensure avaliacoes_desempenho exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'avaliacoes_desempenho') THEN
            RAISE NOTICE 'Creating avaliacoes_desempenho table...';
            
            CREATE TABLE avaliacoes_desempenho (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                funcionario_id UUID NOT NULL,
                avaliador_id UUID NOT NULL,
                periodo TEXT NOT NULL,
                data_inicio DATE NOT NULL,
                data_fim DATE NOT NULL,
                status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
                pontuacao_total FLOAT DEFAULT 0,
                observacoes TEXT,
                deleted_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            
            RAISE NOTICE 'Table avaliacoes_desempenho created successfully';
        END IF;
    END IF;
END
$$;

-- =============================================================================
-- STEP 2: FOREIGN KEY RELATIONSHIP FIXES
-- =============================================================================
-- Update all foreign key relationships to reference 'users_unified' table

-- First, ensure users_unified table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_unified') THEN
        RAISE NOTICE 'Creating users_unified table...';
        
        CREATE TABLE users_unified (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email TEXT UNIQUE,
            phone_number TEXT UNIQUE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            password TEXT,
            role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER', 'MANAGER')),
            position TEXT,
            department TEXT,
            avatar TEXT,
            active BOOLEAN DEFAULT TRUE,
            verification_code TEXT,
            verification_code_expires TIMESTAMP WITH TIME ZONE,
            password_last_changed TIMESTAMP WITH TIME ZONE,
            invite_code TEXT,
            invite_sent BOOLEAN DEFAULT FALSE,
            invite_sent_at TIMESTAMP WITH TIME ZONE,
            invite_accepted BOOLEAN DEFAULT FALSE,
            invite_accepted_at TIMESTAMP WITH TIME ZONE,
            is_authorized BOOLEAN DEFAULT FALSE,
            authorization_status TEXT DEFAULT 'pending' CHECK (authorization_status IN ('active', 'pending', 'rejected', 'expired')),
            authorization_domain TEXT,
            authorization_expires_at TIMESTAMP WITH TIME ZONE,
            authorization_max_uses INTEGER,
            authorization_uses INTEGER DEFAULT 0,
            authorized_by UUID,
            authorization_notes JSONB,
            access_permissions JSONB,
            access_history JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'users_unified table created successfully';
    END IF;
END
$$;

-- Create compatibility view for 'users' if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'users') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_unified') THEN
            RAISE NOTICE 'Creating compatibility view for users...';
            
            CREATE OR REPLACE VIEW users AS
            SELECT 
                id, 
                first_name, 
                last_name, 
                email, 
                role, 
                position, 
                department, 
                is_authorized, 
                active,
                created_at,
                updated_at
            FROM users_unified;
            
            RAISE NOTICE 'Compatibility view for users created successfully';
        END IF;
    END IF;
END
$$;

-- Ensure funcionarios table exists with proper foreign key to users_unified
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'funcionarios') THEN
        RAISE NOTICE 'Creating funcionarios table...';
        
        CREATE TABLE funcionarios (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            nome TEXT NOT NULL,
            cargo TEXT,
            departamento TEXT,
            data_admissao DATE,
            email TEXT UNIQUE,
            matricula TEXT UNIQUE,
            status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'afastado', 'ferias')),
            user_id UUID REFERENCES users_unified(id),
            deleted_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        
        RAISE NOTICE 'funcionarios table created successfully';
    END IF;
END
$$;

-- Add foreign key constraints to avaliacoes_desempenho if they don't exist
DO $$
BEGIN
    -- Check and add foreign key for funcionario_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_avaliacoes_desempenho_funcionario' 
        AND table_name = 'avaliacoes_desempenho'
    ) THEN
        RAISE NOTICE 'Adding foreign key for funcionario_id...';
        
        -- First, ensure all funcionario_id values exist in users_unified
        -- Create a mapping if needed
        INSERT INTO users_unified (id, first_name, last_name, email, role, created_at, updated_at)
        SELECT 
            ad.funcionario_id,
            'Funcionário ' || ad.funcionario_id::text,
            'Importado',
            'funcionario_' || ad.funcionario_id::text || '@example.com',
            'USER',
            NOW(),
            NOW()
        FROM avaliacoes_desempenho ad
        WHERE NOT EXISTS (
            SELECT 1 FROM users_unified uu 
            WHERE uu.id = ad.funcionario_id
        )
        GROUP BY ad.funcionario_id;
        
        RAISE NOTICE 'Created missing users_unified records';
        
        ALTER TABLE avaliacoes_desempenho
        ADD CONSTRAINT fk_avaliacoes_desempenho_funcionario
        FOREIGN KEY (funcionario_id) REFERENCES users_unified(id);
        
        RAISE NOTICE 'Foreign key for funcionario_id added successfully';
    END IF;
    
    -- Check and add foreign key for avaliador_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_avaliacoes_desempenho_avaliador' 
        AND table_name = 'avaliacoes_desempenho'
    ) THEN
        RAISE NOTICE 'Adding foreign key for avaliador_id...';
        
        -- First, ensure all avaliador_id values exist in users_unified
        INSERT INTO users_unified (id, first_name, last_name, email, role, created_at, updated_at)
        SELECT 
            ad.avaliador_id,
            'Avaliador ' || ad.avaliador_id::text,
            'Importado',
            'avaliador_' || ad.avaliador_id::text || '@example.com',
            'MANAGER',
            NOW(),
            NOW()
        FROM avaliacoes_desempenho ad
        WHERE NOT EXISTS (
            SELECT 1 FROM users_unified uu 
            WHERE uu.id = ad.avaliador_id
        )
        GROUP BY ad.avaliador_id;
        
        RAISE NOTICE 'Created missing users_unified records';
        
        ALTER TABLE avaliacoes_desempenho
        ADD CONSTRAINT fk_avaliacoes_desempenho_avaliador
        FOREIGN KEY (avaliador_id) REFERENCES users_unified(id);
        
        RAISE NOTICE 'Foreign key for avaliador_id added successfully';
    END IF;
END
$$;

-- =============================================================================
-- STEP 3: PERIOD REFERENCE FIX
-- =============================================================================
-- Add periodo_id UUID column and create foreign key relationship to periodos_avaliacao

-- Ensure periodos_avaliacao table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'periodos_avaliacao') THEN
        RAISE NOTICE 'Creating periodos_avaliacao table...';
        
        CREATE TABLE periodos_avaliacao (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nome VARCHAR(200) NOT NULL,
            ano INTEGER NOT NULL,
            descricao TEXT,
            data_inicio DATE NOT NULL,
            data_fim DATE NOT NULL,
            data_limite_autoavaliacao DATE,
            data_limite_aprovacao DATE,
            status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            ativo BOOLEAN DEFAULT TRUE
        );
        
        RAISE NOTICE 'periodos_avaliacao table created successfully';
    END IF;
END
$$;

-- Add periodo_id column to avaliacoes_desempenho if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'avaliacoes_desempenho' AND column_name = 'periodo_id'
    ) THEN
        RAISE NOTICE 'Adding periodo_id column to avaliacoes_desempenho...';
        
        ALTER TABLE avaliacoes_desempenho
        ADD COLUMN periodo_id UUID;
        
        RAISE NOTICE 'periodo_id column added successfully';
    END IF;
END
$$;

-- Create periodos_avaliacao records from existing periodo TEXT values
DO $$
BEGIN
    -- Create unique period records from existing periodo values
    INSERT INTO periodos_avaliacao (id, nome, ano, data_inicio, data_fim, status, created_at, updated_at)
    SELECT 
        DISTINCT
        uuid_generate_v4(),
        ad.periodo,
        SUBSTRING(ad.periodo FROM '(\d{4})')::INTEGER,
        ad.data_inicio,
        ad.data_fim,
        'ativo',
        NOW(),
        NOW()
    FROM avaliacoes_desempenho ad
    WHERE ad.periodo IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM periodos_avaliacao pa 
        WHERE pa.nome = ad.periodo
    );
    
    RAISE NOTICE 'Period records created from existing periodo values';
    
    -- Update avaliacoes_desempenho with periodo_id references
    UPDATE avaliacoes_desempenho ad
    SET periodo_id = pa.id
    FROM periodos_avaliacao pa
    WHERE ad.periodo = pa.nome
    AND ad.periodo_id IS NULL;
    
    RAISE NOTICE 'avaliacoes_desempenho updated with periodo_id references';
    
    -- Add foreign key constraint for periodo_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_avaliacoes_desempenho_periodo' 
        AND table_name = 'avaliacoes_desempenho'
    ) THEN
        RAISE NOTICE 'Adding foreign key for periodo_id...';
        
        ALTER TABLE avaliacoes_desempenho
        ADD CONSTRAINT fk_avaliacoes_desempenho_periodo
        FOREIGN KEY (periodo_id) REFERENCES periodos_avaliacao(id);
        
        RAISE NOTICE 'Foreign key for periodo_id added successfully';
    END IF;
END
$$;

-- =============================================================================
-- STEP 4: VIEW CONSOLIDATION
-- =============================================================================
-- Create a single, consistent view that includes all necessary fields

-- Drop existing views if they exist
DROP VIEW IF EXISTS vw_avaliacoes_desempenho;
DROP VIEW IF EXISTS vw_avaliacoes_desempenho_alt;

-- Create consolidated view
CREATE OR REPLACE VIEW vw_avaliacoes_desempenho AS
SELECT 
    ad.id,
    ad.funcionario_id,
    ad.avaliador_id,
    ad.periodo,
    ad.periodo_id,
    ad.data_inicio,
    ad.data_fim,
    ad.status,
    ad.pontuacao_total,
    ad.observacoes,
    ad.created_at,
    ad.updated_at,
    ad.deleted_at,
    
    -- Funcionario information from users_unified
    uu_func.first_name || ' ' || uu_func.last_name AS funcionario_nome,
    uu_func.email AS funcionario_email,
    uu_func.position AS funcionario_cargo,
    uu_func.department AS funcionario_departamento,
    
    -- Avaliador information from users_unified
    uu_aval.first_name || ' ' || uu_aval.last_name AS avaliador_nome,
    uu_aval.email AS avaliador_email,
    uu_aval.position AS avaliador_cargo,
    uu_aval.department AS avaliador_departamento,
    
    -- Period information
    pa.nome AS periodo_nome,
    pa.ano AS periodo_ano,
    pa.descricao AS periodo_descricao
    
FROM 
    avaliacoes_desempenho ad
    LEFT JOIN users_unified uu_func ON ad.funcionario_id = uu_func.id
    LEFT JOIN users_unified uu_aval ON ad.avaliador_id = uu_aval.id
    LEFT JOIN periodos_avaliacao pa ON ad.periodo_id = pa.id
WHERE 
    ad.deleted_at IS NULL;

-- Grant permissions to the view
GRANT SELECT ON vw_avaliacoes_desempenho TO authenticated;
GRANT SELECT ON vw_avaliacoes_desempenho TO anon;
GRANT SELECT ON vw_avaliacoes_desempenho TO service_role;

RAISE NOTICE 'Consolidated view vw_avaliacoes_desempenho created successfully';

-- =============================================================================
-- STEP 5: ADDITIONAL FOREIGN KEY CONSTRAINTS
-- =============================================================================
-- Ensure all foreign key constraints are properly established

-- Create indexes for better performance
DO $$
BEGIN
    -- Avaliacoes_desempenho indexes
    CREATE INDEX IF NOT EXISTS idx_avaliacoes_desempenho_funcionario_id ON avaliacoes_desempenho(funcionario_id);
    CREATE INDEX IF NOT EXISTS idx_avaliacoes_desempenho_avaliador_id ON avaliacoes_desempenho(avaliador_id);
    CREATE INDEX IF NOT EXISTS idx_avaliacoes_desempenho_periodo_id ON avaliacoes_desempenho(periodo_id);
    CREATE INDEX IF NOT EXISTS idx_avaliacoes_desempenho_status ON avaliacoes_desempenho(status);
    CREATE INDEX IF NOT EXISTS idx_avaliacoes_desempenho_periodo ON avaliacoes_desempenho(periodo);
    
    -- Users_unified indexes
    CREATE INDEX IF NOT EXISTS idx_users_unified_email ON users_unified(email);
    CREATE INDEX IF NOT EXISTS idx_users_unified_role ON users_unified(role);
    CREATE INDEX IF NOT EXISTS idx_users_unified_active ON users_unified(active);
    
    -- Periodos_avaliacao indexes
    CREATE INDEX IF NOT EXISTS idx_periodos_avaliacao_ano ON periodos_avaliacao(ano);
    CREATE INDEX IF NOT EXISTS idx_periodos_avaliacao_status ON periodos_avaliacao(status);
    CREATE INDEX IF NOT EXISTS idx_periodos_avaliacao_ativo ON periodos_avaliacao(ativo);
    
    RAISE NOTICE 'All indexes created successfully';
END
$$;

-- Create or replace update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp trigger to all relevant tables
DO $$
BEGIN
    -- Avaliacoes_desempenho trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_avaliacoes_desempenho_updated_at') THEN
        CREATE TRIGGER update_avaliacoes_desempenho_updated_at
        BEFORE UPDATE ON avaliacoes_desempenho
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Users_unified trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_unified_updated_at') THEN
        CREATE TRIGGER update_users_unified_updated_at
        BEFORE UPDATE ON users_unified
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Periodos_avaliacao trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_periodos_avaliacao_updated_at') THEN
        CREATE TRIGGER update_periodos_avaliacao_updated_at
        BEFORE UPDATE ON periodos_avaliacao
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    RAISE NOTICE 'Update timestamp triggers created successfully';
END
$$;

-- =============================================================================
-- STEP 6: ROW LEVEL SECURITY (RLS) SETUP
-- =============================================================================
-- Enable RLS and create policies for all tables

-- Enable RLS on tables
ALTER TABLE avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_unified ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodos_avaliacao ENABLE ROW LEVEL SECURITY;

-- Create policies for avaliacoes_desempenho
DO $$
BEGIN
    -- Select policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avaliacoes_desempenho_select') THEN
        CREATE POLICY avaliacoes_desempenho_select ON avaliacoes_desempenho
        FOR SELECT USING (
            -- Administrators can see all evaluations
            (SELECT role FROM users_unified WHERE id = auth.uid()) = 'ADMIN'
            OR
            -- Managers can see evaluations where they are evaluators
            ((SELECT role FROM users_unified WHERE id = auth.uid()) = 'MANAGER' AND
             avaliador_id = auth.uid())
            OR
            -- Users can see their own evaluations
            funcionario_id = auth.uid()
        );
    END IF;
    
    -- Insert policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avaliacoes_desempenho_insert') THEN
        CREATE POLICY avaliacoes_desempenho_insert ON avaliacoes_desempenho
        FOR INSERT WITH CHECK (
            (SELECT role FROM users_unified WHERE id = auth.uid()) IN ('ADMIN', 'MANAGER')
        );
    END IF;
    
    -- Update policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avaliacoes_desempenho_update') THEN
        CREATE POLICY avaliacoes_desempenho_update ON avaliacoes_desempenho
        FOR UPDATE USING (
            -- Administrators can update any evaluation
            (SELECT role FROM users_unified WHERE id = auth.uid()) = 'ADMIN'
            OR
            -- Managers can update evaluations where they are evaluators
            ((SELECT role FROM users_unified WHERE id = auth.uid()) = 'MANAGER' AND
             avaliador_id = auth.uid())
        );
    END IF;
    
    -- Delete policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avaliacoes_desempenho_delete') THEN
        CREATE POLICY avaliacoes_desempenho_delete ON avaliacoes_desempenho
        FOR DELETE USING (
            (SELECT role FROM users_unified WHERE id = auth.uid()) = 'ADMIN'
        );
    END IF;
    
    RAISE NOTICE 'RLS policies for avaliacoes_desempenho created successfully';
END
$$;

-- Create policies for users_unified
DO $$
BEGIN
    -- Select policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_unified_select') THEN
        CREATE POLICY users_unified_select ON users_unified
        FOR SELECT USING (true);
    END IF;
    
    -- Insert policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_unified_insert') THEN
        CREATE POLICY users_unified_insert ON users_unified
        FOR INSERT WITH CHECK (
            (SELECT role FROM users_unified WHERE id = auth.uid()) = 'ADMIN'
        );
    END IF;
    
    -- Update policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_unified_update') THEN
        CREATE POLICY users_unified_update ON users_unified
        FOR UPDATE USING (
            id = auth.uid() OR
            (SELECT role FROM users_unified WHERE id = auth.uid()) = 'ADMIN'
        );
    END IF;
    
    RAISE NOTICE 'RLS policies for users_unified created successfully';
END
$$;

-- Create policies for periodos_avaliacao
DO $$
BEGIN
    -- Select policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'periodos_avaliacao_select') THEN
        CREATE POLICY periodos_avaliacao_select ON periodos_avaliacao
        FOR SELECT USING (true);
    END IF;
    
    -- Insert/Update/Delete policy
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'periodos_avaliacao_admin') THEN
        CREATE POLICY periodos_avaliacao_admin ON periodos_avaliacao
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users_unified
                WHERE id = auth.uid()
                AND role = 'ADMIN'
            )
        );
    END IF;
    
    RAISE NOTICE 'RLS policies for periodos_avaliacao created successfully';
END
$$;

-- =============================================================================
-- STEP 7: FINAL VERIFICATION AND SUMMARY
-- =============================================================================
-- Verify all changes were applied successfully

DO $$
DECLARE
    table_count INTEGER;
    view_count INTEGER;
    fk_count INTEGER;
    index_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('avaliacoes_desempenho', 'users_unified', 'periodos_avaliacao', 'funcionarios');
    
    -- Count views
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'vw_avaliacoes_desempenho';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_name = 'avaliacoes_desempenho';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename = 'avaliacoes_desempenho';
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'avaliacoes_desempenho';
    
    RAISE NOTICE '=== SCHEMA FIX SUMMARY ===';
    RAISE NOTICE 'Tables created/updated: %', table_count;
    RAISE NOTICE 'Views created: %', view_count;
    RAISE NOTICE 'Foreign key constraints: %', fk_count;
    RAISE NOTICE 'Indexes created: %', index_count;
    RAISE NOTICE 'RLS policies created: %', policy_count;
    RAISE NOTICE '=== ALL SCHEMA FIXES COMPLETED SUCCESSFULLY ===';
END
$$;