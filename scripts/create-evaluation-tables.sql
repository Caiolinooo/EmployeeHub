-- Script de migração para nova estrutura de avaliações
-- Alinhado com especificações AN-TED-002-R0

-- 1. Criar tabela de ciclos de avaliação
CREATE TABLE IF NOT EXISTS avaliacao_ciclos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ano INTEGER NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
    data_abertura TIMESTAMP WITH TIME ZONE,
    data_fechamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de respostas detalhadas
CREATE TABLE IF NOT EXISTS avaliacao_respostas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    avaliacao_id UUID NOT NULL REFERENCES avaliacoes_desempenho(id) ON DELETE CASCADE,
    pergunta_id INTEGER NOT NULL CHECK (pergunta_id BETWEEN 11 AND 15),
    nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
    comentario TEXT,
    respondente_tipo VARCHAR(20) NOT NULL CHECK (respondente_tipo IN ('collaborator', 'manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint única para evitar respostas duplicadas
    UNIQUE(avaliacao_id, pergunta_id, respondente_tipo)
);

-- 3. Criar tabela de configuração de avaliadores
CREATE TABLE IF NOT EXISTS avaliacao_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('manager', 'leader')),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint única para evitar duplicatas
    UNIQUE(user_id, tipo)
);

-- 4. Adicionar coluna ciclo_id na tabela principal
ALTER TABLE avaliacoes_desempenho
ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES avaliacao_ciclos(id);

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_avaliacao_respostas_avaliacao_id ON avaliacao_respostas(avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_respostas_pergunta_id ON avaliacao_respostas(pergunta_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_config_user_id ON avaliacao_config(user_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_config_tipo ON avaliacao_config(tipo);
CREATE INDEX IF NOT EXISTS idx_avaliacao_config_ativo ON avaliacao_config(ativo);

-- 6. Inserir ciclo padrão (ano atual)
INSERT INTO avaliacao_ciclos (ano, nome, status, data_abertura)
VALUES (
    EXTRACT(YEAR FROM NOW()),
    CONCAT('Avaliação ', EXTRACT(YEAR FROM NOW())),
    'active',
    NOW()
) ON CONFLICT (ano) DO NOTHING;

-- 7. Criar view atualizada com novas informações
CREATE OR REPLACE VIEW vw_avaliacoes_desempenho AS
SELECT
    a.id,
    a.funcionario_id,
    a.avaliador_id,
    a.ciclo_id,
    ac.nome as ciclo_nome,
    ac.ano as ciclo_ano,
    a.periodo,
    a.data_inicio,
    a.data_fim,
    a.status,
    a.observacoes,
    a.created_at,
    a.updated_at,
    a.deleted_at,

    -- Informações do funcionário
    func.first_name || ' ' || func.last_name as funcionario_nome,
    func.position as funcionario_cargo,
    func.department as funcionario_departamento,
    func.email as funcionario_email,

    -- Informações do avaliador
    aval.first_name || ' ' || aval.last_name as avaliador_nome,
    aval.position as avaliador_cargo,
    aval.department as avaliador_departamento,
    aval.email as avaliador_email,

    -- Colunas calculadas
    (
        SELECT COALESCE(AVG(nota), 0)
        FROM avaliacao_respostas ar
        WHERE ar.avaliacao_id = a.id
    ) as media_geral,

    (
        SELECT COUNT(*)
        FROM avaliacao_respostas ar
        WHERE ar.avaliacao_id = a.id
    ) as total_respostas

FROM avaliacoes_desempenho a
LEFT JOIN users_unified func ON a.funcionario_id = func.id
LEFT JOIN users_unified aval ON a.avaliador_id = aval.id
LEFT JOIN avaliacao_ciclos ac ON a.ciclo_id = ac.id;

-- 8. Atualizar RLS policies para as novas tabelas
ALTER TABLE avaliacao_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_config ENABLE ROW LEVEL SECURITY;

-- Policy para ciclos (apenas admin pode criar/editar)
CREATE POLICY "Ciclos - Admin full access" ON avaliacao_ciclos
    FOR ALL USING (auth.jwt() ->> 'role' = 'ADMIN');

-- Policy para respostas (usuário só pode ver/editar as próprias respostas)
CREATE POLICY "Respostas - View own" ON avaliacao_respostas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM avaliacoes_desempenho a
            WHERE a.id = avaliacao_respostas.avaliacao_id
            AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
        )
    );

CREATE POLICY "Respostas - Insert" ON avaliacao_respostas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM avaliacoes_desempenho a
            WHERE a.id = avaliacao_respostas.avaliacao_id
            AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
        )
    );

CREATE POLICY "Respostas - Update" ON avaliacao_respostas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM avaliacoes_desempenho a
            WHERE a.id = avaliacao_respostas.avaliacao_id
            AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
        )
    );

-- Policy para configuração (apenas admin)
CREATE POLICY "Config - Admin full access" ON avaliacao_config
    FOR ALL USING (auth.jwt() ->> 'role' = 'ADMIN');

-- 9. Inserir configurações iniciais de avaliadores baseado em usuários existentes
INSERT INTO avaliacao_config (user_id, tipo)
SELECT
    id,
    CASE
        WHEN role = 'ADMIN' THEN 'manager'
        WHEN role = 'MANAGER' THEN 'manager'
        ELSE 'leader'
    END
FROM users_unified
WHERE role IN ('ADMIN', 'MANAGER')
  AND ativo = true
ON CONFLICT (user_id, tipo) DO NOTHING;

-- 10. Criar função para cálculo de médias
CREATE OR REPLACE FUNCTION calcular_media_avaliacao(avaliacao_id_param UUID)
RETURNS NUMERIC AS $$
DECLARE
    media_result NUMERIC;
BEGIN
    SELECT COALESCE(AVG(nota), 0)
    INTO media_result
    FROM avaliacao_respostas
    WHERE avaliacao_id = avaliacao_id_param;

    RETURN ROUND(media_result, 1);
END;
$$ LANGUAGE plpgsql;

-- 11. Trigger para atualizar médias
CREATE OR REPLACE FUNCTION atualizar_media_avaliacao()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar média quando inserir ou atualizar respostas
    UPDATE avaliacoes_desempenho
    SET updated_at = NOW()
    WHERE id = NEW.avaliacao_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_media
    AFTER INSERT OR UPDATE ON avaliacao_respostas
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_media_avaliacao();

-- Result: Estrutura criada com sucesso
-- Novas tabelas: avaliacao_ciclos, avaliacao_respostas, avaliacao_config
-- View atualizada: vw_avaliacoes_desempenho
-- RLS policies configuradas
-- Índices criados para performance