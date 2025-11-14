-- ============================================
-- MIGRAÇÃO PARA NOVO SISTEMA DE AVALIAÇÃO SEM PESOS
-- EmployeeHub - Avaliação Anual de Desempenho
-- ============================================

-- Este script cria as tabelas e estruturas necessárias para o novo sistema
-- Execute em etapas para garantir integridade dos dados

-- PASSO 1: Criar tabelas principais

-- Ciclos de avaliação
CREATE TABLE IF NOT EXISTS ciclos_avaliacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ano INTEGER NOT NULL,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aberto', 'encerrado')),
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT ciclos_avaliacao_ano_unique UNIQUE (ano)
);

-- Tabela principal de avaliações (atualizada)
ALTER TABLE avaliacoes_desempenho ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES ciclos_avaliacao(id) ON DELETE CASCADE;
ALTER TABLE avaliacoes_desempenho ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pendente' CHECK (
    status IN ('pendente', 'em_andamento', 'aguardando_gerente', 'aprovado', 'devolvido', 'finalizado')
);
ALTER TABLE avaliacoes_desempenho ADD COLUMN IF NOT EXISTS dados_colaborador JSONB;
ALTER TABLE avaliacoes_desempenho ADD COLUMN IF NOT EXISTS dados_gerente JSONB;
ALTER TABLE avaliacoes_desempenho ADD COLUMN IF NOT EXISTS resultado JSONB;
ALTER TABLE avaliacoes_desempenho ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE avaliacoes_desempenho ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Tabela de auditoria de avaliações
CREATE TABLE IF NOT EXISTS auditoria_avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avaliacao_id UUID NOT NULL REFERENCES avaliacoes_desempenho(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
    acao VARCHAR(50) NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET
);

-- Tabela de notificações de avaliação
CREATE TABLE IF NOT EXISTS notificacoes_avaliacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (
        tipo IN ('abertura_ciclo', 'submissao_colaborador', 'revisao_gerente', 'aprovacao', 'devolucao', 'reenvio')
    ),
    titulo VARCHAR(200) NOT NULL,
    mensagem TEXT NOT NULL,
    dados JSONB,
    lida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_notificacoes_usuario_lida (usuario_id, lida),
    INDEX idx_notificacoes_tipo (tipo)
);

-- Tabela de critérios (para gerenciamento dinâmico)
CREATE TABLE IF NOT EXISTS criterios_avaliacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    categoria VARCHAR(100),
    pontuacao_maxima INTEGER DEFAULT 5 CHECK (pontuacao_maxima BETWEEN 1 AND 5),
    ativo BOOLEAN DEFAULT TRUE,
    apenas_lideres BOOLEAN DEFAULT FALSE,
    tipo VARCHAR(20) DEFAULT 'colaborador' CHECK (tipo IN ('colaborador', 'gerente')),
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT criterios_avaliacao_pontuacao_maxima_check CHECK (pontuacao_maxima > 0)
);

-- PASSO 2: Inserir critérios padrão (novo modelo)
INSERT INTO criterios_avaliacao (id, nome, descricao, categoria, apenas_lideres, tipo, ordem) VALUES
-- Questões do colaborador (11-14)
('q11-pontos-fortes', 'Pontos Fortes', 'Questão 11: Pontos fortes - Descrição feita pelo colaborador', 'Autoavaliação', FALSE, 'colaborador', 11),
('q12-areas-melhoria', 'Áreas de Melhoria', 'Questão 12: Áreas de melhoria - Descrição feita pelo colaborador', 'Autoavaliação', FALSE, 'colaborador', 12),
('q13-objetivos-alcancados', 'Objetivos Alcançados', 'Questão 13: Objetivos alcançados - Descrição feita pelo colaborador', 'Autoavaliação', FALSE, 'colaborador', 13),
('q14-planos-desenvolvimento', 'Planos de Desenvolvimento', 'Questão 14: Planos de desenvolvimento - Descrição feita pelo colaborador', 'Autoavaliação', FALSE, 'colaborador', 14),

-- Competências do gerente
('pontualidade-comprometimento', 'Pontualidade e Comprometimento', 'Cumpre prazos, horários e demonstra engajamento com as metas e atividades da equipe e empresa.', 'Comportamento', FALSE, 'gerente', 1),
('lideranca-delegar', 'Liderança - Delegar', 'Capacidade de delegar tarefas e responsabilidades de forma eficaz, desenvolvendo a equipe.', 'Liderança', TRUE, 'gerente', 2),
('lideranca-desenvolvimento-equipe', 'Liderança - Desenvolvimento de Equipe', 'Capacidade de desenvolver, orientar e capacitar membros da equipe para alcançar melhores resultados.', 'Liderança', TRUE, 'gerente', 3),

-- Questão 15 - Comentário do avaliador
('q15-comentario-avaliador', 'Comentário do Avaliador', 'Questão 15: Comentário detalhado do gerente sobre o desempenho do colaborador', 'Avaliação do Gerente', FALSE, 'gerente', 15)
ON CONFLICT (id) DO NOTHING;

-- PASSO 3: Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_avaliacoes_ciclo_status ON avaliacoes_desempenho(ciclo_id, status);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_funcionario_status ON avaliacoes_desempenho(funcionario_id, status);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_avaliador_status ON avaliacoes_desempenho(avaliador_id, status);
CREATE INDEX IF NOT EXISTS idx_auditoria_avaliacao_timestamp ON auditoria_avaliacoes(avaliacao_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_timestamp ON auditoria_avaliacoes(usuario_id, timestamp);

-- PASSO 4: Configurar Row Level Security (RLS)

-- Habilitar RLS nas tabelas
ALTER TABLE ciclos_avaliacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_avaliacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE criterios_avaliacao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ciclos_avaliacao
CREATE POLICY "Visualizar ciclos" ON ciclos_avaliacao
    FOR SELECT USING (true);

CREATE POLICY "Admins gerenciam ciclos" ON ciclos_avaliacao
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

-- Políticas RLS para auditoria_avaliacoes
CREATE POLICY "Visualizar própria auditoria" ON auditoria_avaliacoes
    FOR SELECT USING (
        usuario_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

CREATE POLICY "Inserir auditoria" ON auditoria_avaliacoes
    FOR INSERT WITH CHECK (usuario_id = auth.uid());

-- Políticas RLS para notificacoes_avaliacao
CREATE POLICY "Visualizar próprias notificações" ON notificacoes_avaliacao
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "Admin visualiza todas notificações" ON notificacoes_avaliacao
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

CREATE POLICY "Atualizar próprias notificações" ON notificacoes_avaliacao
    FOR UPDATE USING (usuario_id = auth.uid());

CREATE POLICY "Sistema gerencia notificações" ON notificacoes_avaliacao
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

-- Políticas RLS para criterios_avaliacao
CREATE POLICY "Todos visualizam critérios ativos" ON criterios_avaliacao
    FOR SELECT USING (ativo = true);

CREATE POLICY "Admins gerenciam critérios" ON criterios_avaliacao
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users_unified
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

-- PASSO 5: Função de migração de dados antigos
CREATE OR REPLACE FUNCTION migrar_avaliacoes_antigas()
RETURNS TABLE(
    migrados INTEGER,
    erros INTEGER,
    detalhe TEXT
) AS $$
DECLARE
    count_migrados INTEGER := 0;
    count_erros INTEGER := 0;
    detalhe_migracao TEXT := '';
BEGIN
    -- Atualizar avaliações existentes para o novo formato
    UPDATE avaliacoes_desempenho
    SET
        status = CASE
            WHEN status IS NULL OR status = '' THEN 'pendente'
            WHEN status = 'submitted' THEN 'aguardando_gerente'
            WHEN status = 'approved' THEN 'aprovado'
            ELSE 'pendente'
        END,
        updated_at = NOW()
    WHERE status IS NULL OR status NOT IN ('pendente', 'em_andamento', 'aguardando_gerente', 'aprovado', 'devolvido', 'finalizado');

    GET DIAGNOSTICS count_migrados = ROW_COUNT;

    -- Criar ciclo padrão para avaliações sem ciclo
    INSERT INTO ciclos_avaliacao (ano, nome, status, data_inicio, data_fim)
    SELECT
        EXTRACT(YEAR FROM created_at) as ano,
        'Ciclo ' || EXTRACT(YEAR FROM created_at) as nome,
        'encerrado' as status,
        DATE_TRUNC('year', created_at) as data_inicio,
        DATE_TRUNC('year', created_at) + INTERVAL '1 year' - INTERVAL '1 day' as data_fim
    FROM avaliacoes_desempenho
    WHERE ciclo_id IS NULL
    GROUP BY EXTRACT(YEAR FROM created_at), DATE_TRUNC('year', created_at)
    ON CONFLICT (ano) DO NOTHING;

    -- Associar avaliações aos ciclos criados
    UPDATE avaliacoes_desempenho a
    SET ciclo_id = c.id
    FROM ciclos_avaliacao c
    WHERE a.ciclo_id IS NULL
    AND c.ano = EXTRACT(YEAR FROM a.created_at);

    GET DIAGNOSTICS count_migrados = count_migrados + ROW_COUNT;

    detalhe_migracao := format('Migradas %s avaliações para o novo formato', count_migrados);

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- PASSO 6: Gatilhos para atualização automática
CREATE OR REPLACE FUNCTION atualizar_timestamp_avaliacao()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_timestamp_avaliacao
    BEFORE UPDATE ON avaliacoes_desempenho
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp_avaliacao();

CREATE OR REPLACE FUNCTION atualizar_timestamp_ciclo()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_timestamp_ciclo
    BEFORE UPDATE ON ciclos_avaliacao
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp_ciclo();

-- PASSO 7: Views para relatórios
CREATE OR REPLACE VIEW vw_avaliacoes_completas AS
SELECT
    a.*,
    c.ano as ciclo_ano,
    c.nome as ciclo_nome,
    f.first_name || ' ' || f.last_name as funcionario_nome,
    f.email as funcionario_email,
    av.first_name || ' ' || av.last_name as avaliador_nome,
    av.email as avaliador_email
FROM avaliacoes_desempenho a
LEFT JOIN ciclos_avaliacao c ON a.ciclo_id = c.id
LEFT JOIN users_unified f ON a.funcionario_id = f.id
LEFT JOIN users_unified av ON a.avaliador_id = av.id;

-- PASSO 8: Verificação final
DO $$
DECLARE
    table_count INTEGER;
    ciclo_count INTEGER;
    criterio_count INTEGER;
BEGIN
    -- Verificar se as tabelas foram criadas
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('ciclos_avaliacao', 'auditoria_avaliacoes', 'notificacoes_avaliacao', 'criterios_avaliacao');

    IF table_count = 4 THEN
        RAISE NOTICE '✅ Todas as tabelas foram criadas com sucesso';
    ELSE
        RAISE NOTICE '❌ Algumas tabelas não foram criadas: %s', table_count;
    END IF;

    -- Verificar critérios inseridos
    SELECT COUNT(*) INTO criterio_count FROM criterios_avaliacao WHERE ativo = true;
    RAISE NOTICE '📊 Critérios inseridos: %s', criterio_count;

    -- Verificar ciclos
    SELECT COUNT(*) INTO ciclo_count FROM ciclos_avaliacao;
    RAISE NOTICE '🔄 Ciclos criados: %s', ciclo_count;

    IF table_count = 4 AND criterio_count >= 7 THEN
        RAISE NOTICE '🎉 Migração para novo sistema de avaliação concluída com sucesso!';
    ELSE
        RAISE NOTICE '⚠️ Verifique os logs para corrigir problemas na migração';
    END IF;
END $$;