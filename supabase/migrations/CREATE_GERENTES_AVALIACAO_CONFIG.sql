-- ============================================
-- CRIAÇÃO DA TABELA DE CONFIGURAÇÃO DE GERENTES DE AVALIAÇÃO
-- Esta tabela define quem pode ser gerente de avaliação independentemente da role do usuário
-- ============================================

-- Criar tabela de configuração de gerentes de avaliação
CREATE TABLE IF NOT EXISTS gerentes_avaliacao_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
    ativo BOOLEAN DEFAULT TRUE,
    criado_por UUID REFERENCES users_unified(id) ON DELETE SET NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_por UUID REFERENCES users_unified(id) ON DELETE SET NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT gerentes_avaliacao_config_usuario_unique UNIQUE (usuario_id)
);

-- Habilitar RLS
ALTER TABLE gerentes_avaliacao_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Visualizar gerentes ativos" ON gerentes_avaliacao_config
    FOR SELECT USING (ativo = true);

CREATE POLICY "Admins gerenciam gerentes" ON gerentes_avaliacao_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gerentes_avaliacao_usuario ON gerentes_avaliacao_config(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gerentes_avaliacao_ativo ON gerentes_avaliacao_config(ativo);

-- Gatilho para atualizar timestamp
CREATE OR REPLACE FUNCTION atualizar_timestamp_gerentes_config()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_timestamp_gerentes_config
    BEFORE UPDATE ON gerentes_avaliacao_config
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp_gerentes_config();

-- Função para adicionar/remover gerente de avaliação
CREATE OR REPLACE FUNCTION toggle_gerente_avaliacao(
    usuario_id_param UUID,
    ativo_param BOOLEAN DEFAULT TRUE,
    usuario_operacao UUID DEFAULT auth.uid()
)
RETURNS TABLE(
    sucesso BOOLEAN,
    mensagem TEXT
) AS $$
DECLARE
    usuario_existe BOOLEAN;
    config_existe BOOLEAN;
BEGIN
    -- Verificar se o usuário existe e está ativo
    SELECT EXISTS(
        SELECT 1 FROM users_unified
        WHERE id = usuario_id_param
        AND is_authorized = true
        AND active = true
    ) INTO usuario_existe;

    IF NOT usuario_existe THEN
        RETURN NEXT SELECT false, 'Usuário não encontrado ou inativo'::TEXT;
        RETURN;
    END IF;

    -- Verificar se já existe configuração
    SELECT EXISTS(
        SELECT 1 FROM gerentes_avaliacao_config
        WHERE usuario_id = usuario_id_param
    ) INTO config_existe;

    IF config_existe THEN
        -- Atualizar configuração existente
        UPDATE gerentes_avaliacao_config
        SET
            ativo = ativo_param,
            atualizado_por = usuario_operacao
        WHERE usuario_id = usuario_id_param;

        IF ativo_param THEN
            RETURN NEXT SELECT true, 'Usuário configurado como gerente de avaliação'::TEXT;
        ELSE
            RETURN NEXT SELECT true, 'Usuário removido como gerente de avaliação'::TEXT;
        END IF;
    ELSE
        -- Criar nova configuração
        INSERT INTO gerentes_avaliacao_config (
            usuario_id,
            ativo,
            criado_por,
            atualizado_por
        ) VALUES (
            usuario_id_param,
            ativo_param,
            usuario_operacao,
            usuario_operacao
        );

        RETURN NEXT SELECT true, 'Usuário adicionado como gerente de avaliação'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View para listar gerentes de avaliação ativos
CREATE OR REPLACE VIEW vw_gerentes_avaliacao_ativos AS
SELECT
    g.id as config_id,
    u.id as usuario_id,
    u.first_name,
    u.last_name,
    u.email,
    u.position,
    u.department,
    u.role as sistema_role,
    g.ativo,
    g.criado_em,
    g.criado_por,
    g.atualizado_em,
    g.atualizado_por,
    -- Campo para facilitar no frontend
    (u.first_name || ' ' || u.last_name) as nome_completo
FROM gerentes_avaliacao_config g
JOIN users_unified u ON g.usuario_id = u.id
WHERE g.ativo = true
ORDER BY u.first_name, u.last_name;

-- Função para obter gerentes de avaliação
CREATE OR REPLACE FUNCTION obter_gerentes_avaliacao()
RETURNS TABLE(
    usuario_id UUID,
    nome_completo TEXT,
    email TEXT,
    position TEXT,
    sistema_role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.first_name || ' ' || u.last_name,
        u.email,
        u.position,
        u.role
    FROM gerentes_avaliacao_config g
    JOIN users_unified u ON g.usuario_id = u.id
    WHERE g.ativo = true
    ORDER BY u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificação final
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'gerentes_avaliacao_config'
    ) INTO table_exists;

    IF table_exists THEN
        RAISE NOTICE '✅ Tabela gerentes_avaliacao_config criada com sucesso';
        RAISE NOTICE '📋 Funções disponíveis:';
        RAISE NOTICE '   - toggle_gerente_avaliacao(usuario_id, ativo)';
        RAISE NOTICE '   - obter_gerentes_avaliacao()';
        RAISE NOTICE '📊 View disponível:';
        RAISE NOTICE '   - vw_gerentes_avaliacao_ativos';
    ELSE
        RAISE NOTICE '❌ Erro ao criar tabela gerentes_avaliacao_config';
    END IF;
END $$;