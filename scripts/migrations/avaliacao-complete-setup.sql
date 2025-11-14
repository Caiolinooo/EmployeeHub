-- =====================================================
-- MIGRATIONS COMPLETAS - SISTEMA DE AVALIAÇÃO DE DESEMPENHO
-- Especificação AN-TED-002-R0
-- =====================================================

-- =====================================================
-- 1. CRIAR TABELA DE USUÁRIOS ELEGÍVEIS
-- =====================================================
CREATE TABLE IF NOT EXISTS avaliacao_usuarios_elegiveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users_unified(id),
  CONSTRAINT uk_usuario_elegiveis UNIQUE(usuario_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_elegiveis_usuario ON avaliacao_usuarios_elegiveis(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_elegiveis_ativo ON avaliacao_usuarios_elegiveis(ativo);

-- Comentários
COMMENT ON TABLE avaliacao_usuarios_elegiveis IS 'Usuários elegíveis para receber avaliações automáticas';
COMMENT ON COLUMN avaliacao_usuarios_elegiveis.usuario_id IS 'Referência ao usuário do sistema';
COMMENT ON COLUMN avaliacao_usuarios_elegiveis.ativo IS 'Se o usuário está ativo para receber avaliações';

-- =====================================================
-- 2. CRIAR TABELA DE LOG DE CRON JOBS
-- =====================================================
CREATE TABLE IF NOT EXISTS avaliacao_cron_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  descricao TEXT,
  executado_em TIMESTAMP DEFAULT NOW(),
  resultado JSONB,
  sucesso BOOLEAN DEFAULT false,
  tempo_execucao_ms INTEGER,
  erro TEXT,
  created_by TEXT DEFAULT 'SYSTEM'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cron_log_tipo ON avaliacao_cron_log(tipo);
CREATE INDEX IF NOT EXISTS idx_cron_log_executado ON avaliacao_cron_log(executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_cron_log_sucesso ON avaliacao_cron_log(sucesso);

-- Comentários
COMMENT ON TABLE avaliacao_cron_log IS 'Log de execução de tarefas automáticas do sistema de avaliação';
COMMENT ON COLUMN avaliacao_cron_log.tipo IS 'Tipo de tarefa: criacao_automatica, lembrete_autoavaliacao, lembrete_aprovacao, limpeza_lixeira';
COMMENT ON COLUMN avaliacao_cron_log.resultado IS 'Dados do resultado da execução em formato JSON';

-- =====================================================
-- 3. ATUALIZAR TABELA DE PERÍODOS DE AVALIAÇÃO
-- =====================================================
-- Adicionar colunas se não existirem
ALTER TABLE periodos_avaliacao
  ADD COLUMN IF NOT EXISTS criterios_personalizados JSONB,
  ADD COLUMN IF NOT EXISTS usuarios_elegiveis_config JSONB,
  ADD COLUMN IF NOT EXISTS criacao_automatica_executada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_criacao_automatica TIMESTAMP,
  ADD COLUMN IF NOT EXISTS total_avaliacoes_criadas INTEGER DEFAULT 0;

-- Comentários
COMMENT ON COLUMN periodos_avaliacao.criterios_personalizados IS 'Critérios personalizados para este período específico (opcional)';
COMMENT ON COLUMN periodos_avaliacao.usuarios_elegiveis_config IS 'Configuração específica de usuários para este período (sobrescreve config global)';
COMMENT ON COLUMN periodos_avaliacao.criacao_automatica_executada IS 'Flag indicando se as avaliações já foram criadas automaticamente';
COMMENT ON COLUMN periodos_avaliacao.data_criacao_automatica IS 'Data em que as avaliações foram criadas automaticamente';
COMMENT ON COLUMN periodos_avaliacao.total_avaliacoes_criadas IS 'Contador de avaliações criadas neste período';

-- =====================================================
-- 4. CRIAR TABELA DE CONFIGURAÇÃO DE GERENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS gerentes_avaliacao_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  pode_avaliar_lideranca BOOLEAN DEFAULT true,
  departamentos TEXT[], -- Departamentos que este gerente pode avaliar
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users_unified(id),
  CONSTRAINT uk_gerente_config UNIQUE(usuario_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gerentes_config_usuario ON gerentes_avaliacao_config(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gerentes_config_ativo ON gerentes_avaliacao_config(ativo);

-- Comentários
COMMENT ON TABLE gerentes_avaliacao_config IS 'Configuração de gerentes/avaliadores do sistema de avaliação';
COMMENT ON COLUMN gerentes_avaliacao_config.pode_avaliar_lideranca IS 'Se este gerente pode avaliar competências de liderança';
COMMENT ON COLUMN gerentes_avaliacao_config.departamentos IS 'Lista de departamentos que este gerente pode avaliar';

-- =====================================================
-- 5. CRIAR TABELA DE MAPEAMENTO COLABORADOR -> GERENTE
-- =====================================================
CREATE TABLE IF NOT EXISTS avaliacao_colaborador_gerente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  gerente_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  periodo_id UUID REFERENCES periodos_avaliacao(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users_unified(id),
  CONSTRAINT uk_colaborador_gerente_periodo UNIQUE(colaborador_id, periodo_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_colab_gerente_colaborador ON avaliacao_colaborador_gerente(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_colab_gerente_gerente ON avaliacao_colaborador_gerente(gerente_id);
CREATE INDEX IF NOT EXISTS idx_colab_gerente_periodo ON avaliacao_colaborador_gerente(periodo_id);

-- Comentários
COMMENT ON TABLE avaliacao_colaborador_gerente IS 'Mapeamento entre colaboradores e seus gerentes avaliadores';
COMMENT ON COLUMN avaliacao_colaborador_gerente.periodo_id IS 'Período específico (NULL = configuração padrão)';

-- =====================================================
-- 6. ADICIONAR COLUNA APENAS_LIDERES NA TABELA CRITERIOS
-- =====================================================
-- A coluna apenas_lideres já foi adicionada anteriormente
-- Os critérios de liderança (Q16 e Q17) estão definidos em src/data/criterios-avaliacao.ts
-- e serão gerenciados via aplicação

COMMENT ON COLUMN criterios.apenas_lideres IS 'Se true, este critério aplica-se apenas a líderes (perguntas 16-17)';

-- =====================================================
-- 7. CRIAR FUNÇÃO DE TRIGGER PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers nas tabelas novas
DROP TRIGGER IF EXISTS update_usuarios_elegiveis_updated_at ON avaliacao_usuarios_elegiveis;
CREATE TRIGGER update_usuarios_elegiveis_updated_at
    BEFORE UPDATE ON avaliacao_usuarios_elegiveis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gerentes_config_updated_at ON gerentes_avaliacao_config;
CREATE TRIGGER update_gerentes_config_updated_at
    BEFORE UPDATE ON gerentes_avaliacao_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_colab_gerente_updated_at ON avaliacao_colaborador_gerente;
CREATE TRIGGER update_colab_gerente_updated_at
    BEFORE UPDATE ON avaliacao_colaborador_gerente
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. CRIAR VIEWS ÚTEIS
-- =====================================================

-- View de usuários elegíveis com informações completas
CREATE OR REPLACE VIEW vw_usuarios_elegiveis AS
SELECT
  ue.id,
  ue.usuario_id,
  ue.ativo,
  ue.observacoes,
  ue.created_at,
  u.first_name || ' ' || u.last_name AS nome_completo,
  u.email,
  u.phone_number,
  u.position AS cargo,
  u.department AS departamento,
  u.role
FROM avaliacao_usuarios_elegiveis ue
INNER JOIN users_unified u ON ue.usuario_id = u.id
WHERE ue.ativo = true;

-- View de gerentes configurados
CREATE OR REPLACE VIEW vw_gerentes_avaliacao AS
SELECT
  gc.id,
  gc.usuario_id,
  gc.ativo,
  gc.pode_avaliar_lideranca,
  gc.departamentos,
  gc.observacoes,
  u.first_name || ' ' || u.last_name AS nome_completo,
  u.email,
  u.position AS cargo,
  u.department AS departamento
FROM gerentes_avaliacao_config gc
INNER JOIN users_unified u ON gc.usuario_id = u.id
WHERE gc.ativo = true;

-- View de mapeamento colaborador-gerente
CREATE OR REPLACE VIEW vw_colaborador_gerente AS
SELECT
  cg.id,
  cg.colaborador_id,
  cg.gerente_id,
  cg.periodo_id,
  cg.ativo,
  colab.first_name || ' ' || colab.last_name AS colaborador_nome,
  colab.email AS colaborador_email,
  colab.position AS colaborador_cargo,
  gerente.first_name || ' ' || gerente.last_name AS gerente_nome,
  gerente.email AS gerente_email,
  gerente.position AS gerente_cargo,
  p.nome AS periodo_nome,
  EXTRACT(YEAR FROM p.data_inicio) AS periodo_ano
FROM avaliacao_colaborador_gerente cg
INNER JOIN users_unified colab ON cg.colaborador_id = colab.id
INNER JOIN users_unified gerente ON cg.gerente_id = gerente.id
LEFT JOIN periodos_avaliacao p ON cg.periodo_id = p.id
WHERE cg.ativo = true;

-- =====================================================
-- 9. CRIAR FUNÇÃO PARA OBTER GERENTE DE UM COLABORADOR
-- =====================================================
CREATE OR REPLACE FUNCTION get_gerente_colaborador(
  p_colaborador_id UUID,
  p_periodo_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_gerente_id UUID;
BEGIN
  -- Tentar encontrar gerente específico do período
  IF p_periodo_id IS NOT NULL THEN
    SELECT gerente_id INTO v_gerente_id
    FROM avaliacao_colaborador_gerente
    WHERE colaborador_id = p_colaborador_id
      AND periodo_id = p_periodo_id
      AND ativo = true
    LIMIT 1;

    IF v_gerente_id IS NOT NULL THEN
      RETURN v_gerente_id;
    END IF;
  END IF;

  -- Buscar gerente padrão (sem período específico)
  SELECT gerente_id INTO v_gerente_id
  FROM avaliacao_colaborador_gerente
  WHERE colaborador_id = p_colaborador_id
    AND periodo_id IS NULL
    AND ativo = true
  LIMIT 1;

  RETURN v_gerente_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. CRIAR FUNÇÃO PARA VERIFICAR SE USUÁRIO É LÍDER
-- =====================================================
CREATE OR REPLACE FUNCTION is_usuario_lider(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_lider BOOLEAN;
BEGIN
  -- Verificar se o usuário está na tabela de gerentes
  SELECT EXISTS(
    SELECT 1
    FROM gerentes_avaliacao_config
    WHERE usuario_id = p_usuario_id
      AND ativo = true
  ) INTO v_is_lider;

  -- Se não estiver, verificar se tem role de MANAGER ou ADMIN
  IF NOT v_is_lider THEN
    SELECT EXISTS(
      SELECT 1
      FROM users_unified
      WHERE id = p_usuario_id
        AND role IN ('MANAGER', 'ADMIN')
    ) INTO v_is_lider;
  END IF;

  RETURN v_is_lider;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE avaliacao_usuarios_elegiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE gerentes_avaliacao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_colaborador_gerente ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_cron_log ENABLE ROW LEVEL SECURITY;

-- Política para usuários elegíveis (apenas admins podem modificar)
DROP POLICY IF EXISTS usuarios_elegiveis_select_policy ON avaliacao_usuarios_elegiveis;
CREATE POLICY usuarios_elegiveis_select_policy ON avaliacao_usuarios_elegiveis
  FOR SELECT USING (true);

DROP POLICY IF EXISTS usuarios_elegiveis_insert_policy ON avaliacao_usuarios_elegiveis;
CREATE POLICY usuarios_elegiveis_insert_policy ON avaliacao_usuarios_elegiveis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

DROP POLICY IF EXISTS usuarios_elegiveis_update_policy ON avaliacao_usuarios_elegiveis;
CREATE POLICY usuarios_elegiveis_update_policy ON avaliacao_usuarios_elegiveis
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Política para gerentes (apenas admins podem modificar)
DROP POLICY IF EXISTS gerentes_config_select_policy ON gerentes_avaliacao_config;
CREATE POLICY gerentes_config_select_policy ON gerentes_avaliacao_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS gerentes_config_insert_policy ON gerentes_avaliacao_config;
CREATE POLICY gerentes_config_insert_policy ON gerentes_avaliacao_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

DROP POLICY IF EXISTS gerentes_config_update_policy ON gerentes_avaliacao_config;
CREATE POLICY gerentes_config_update_policy ON gerentes_avaliacao_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Política para mapeamento colaborador-gerente
DROP POLICY IF EXISTS colab_gerente_select_policy ON avaliacao_colaborador_gerente;
CREATE POLICY colab_gerente_select_policy ON avaliacao_colaborador_gerente
  FOR SELECT USING (
    colaborador_id = auth.uid() OR
    gerente_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );

DROP POLICY IF EXISTS colab_gerente_insert_policy ON avaliacao_colaborador_gerente;
CREATE POLICY colab_gerente_insert_policy ON avaliacao_colaborador_gerente
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Política para cron log (apenas leitura para admins, sistema pode inserir)
DROP POLICY IF EXISTS cron_log_select_policy ON avaliacao_cron_log;
CREATE POLICY cron_log_select_policy ON avaliacao_cron_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

DROP POLICY IF EXISTS cron_log_insert_policy ON avaliacao_cron_log;
CREATE POLICY cron_log_insert_policy ON avaliacao_cron_log
  FOR INSERT WITH CHECK (true); -- Sistema pode sempre inserir

-- =====================================================
-- FIM DAS MIGRATIONS
-- =====================================================

-- Log de execução
INSERT INTO avaliacao_cron_log (tipo, descricao, resultado, sucesso)
VALUES (
  'migration',
  'Execução de migrations completas do sistema de avaliação',
  jsonb_build_object(
    'timestamp', NOW(),
    'versao', 'AN-TED-002-R0',
    'tabelas_criadas', ARRAY[
      'avaliacao_usuarios_elegiveis',
      'gerentes_avaliacao_config',
      'avaliacao_colaborador_gerente',
      'avaliacao_cron_log'
    ]
  ),
  true
);
