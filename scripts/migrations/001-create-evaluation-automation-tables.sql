-- Migration: Create Evaluation Automation Tables
-- Description: Creates all necessary tables for automatic evaluation creation
-- Date: 2025-11-12
-- Version: 1.0.0

-- =============================================================================
-- 1. TABLE: avaliacao_usuarios_elegiveis
-- Purpose: Store users eligible for evaluations (global or per-period)
-- =============================================================================

CREATE TABLE IF NOT EXISTS avaliacao_usuarios_elegiveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  periodo_id UUID REFERENCES periodos_avaliacao(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT TRUE,
  motivo_exclusao TEXT,
  data_inclusao TIMESTAMP DEFAULT NOW(),
  data_exclusao TIMESTAMP,
  incluido_por UUID REFERENCES users_unified(id),
  excluido_por UUID REFERENCES users_unified(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(usuario_id, periodo_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_elegiveis_usuario ON avaliacao_usuarios_elegiveis(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_elegiveis_periodo ON avaliacao_usuarios_elegiveis(periodo_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_elegiveis_ativo ON avaliacao_usuarios_elegiveis(ativo);

COMMENT ON TABLE avaliacao_usuarios_elegiveis IS 'Stores users eligible for performance evaluations';
COMMENT ON COLUMN avaliacao_usuarios_elegiveis.periodo_id IS 'NULL = eligible for all periods (global), otherwise specific to period';

-- =============================================================================
-- 2. TABLE: avaliacao_colaborador_gerente
-- Purpose: Map employees to their managers (global or per-period)
-- =============================================================================

CREATE TABLE IF NOT EXISTS avaliacao_colaborador_gerente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  gerente_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  periodo_id UUID REFERENCES periodos_avaliacao(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT TRUE,
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacoes TEXT,
  configurado_por UUID REFERENCES users_unified(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(colaborador_id, periodo_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_colaborador_gerente_colaborador ON avaliacao_colaborador_gerente(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_colaborador_gerente_gerente ON avaliacao_colaborador_gerente(gerente_id);
CREATE INDEX IF NOT EXISTS idx_colaborador_gerente_periodo ON avaliacao_colaborador_gerente(periodo_id);
CREATE INDEX IF NOT EXISTS idx_colaborador_gerente_ativo ON avaliacao_colaborador_gerente(ativo);

COMMENT ON TABLE avaliacao_colaborador_gerente IS 'Maps employees to their managers for evaluations';
COMMENT ON COLUMN avaliacao_colaborador_gerente.periodo_id IS 'NULL = global mapping (all periods), otherwise specific to period';

-- =============================================================================
-- 3. TABLE: avaliacao_cron_log
-- Purpose: Log all automatic evaluation creation executions
-- =============================================================================

CREATE TABLE IF NOT EXISTS avaliacao_cron_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID REFERENCES periodos_avaliacao(id) ON DELETE SET NULL,
  periodo_nome TEXT,
  executado_em TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial_success', 'error')),
  total_usuarios_processados INTEGER DEFAULT 0,
  total_avaliacoes_criadas INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  total_notificacoes_enviadas INTEGER DEFAULT 0,
  detalhes JSONB,
  erros JSONB,
  tempo_execucao_ms INTEGER,
  triggered_by TEXT, -- 'vercel_cron', 'supabase_cron', 'manual', 'test'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cron_log_periodo ON avaliacao_cron_log(periodo_id);
CREATE INDEX IF NOT EXISTS idx_cron_log_status ON avaliacao_cron_log(status);
CREATE INDEX IF NOT EXISTS idx_cron_log_executado ON avaliacao_cron_log(executado_em DESC);

COMMENT ON TABLE avaliacao_cron_log IS 'Logs all automatic evaluation creation executions';

-- =============================================================================
-- 4. UPDATE: periodos_avaliacao table
-- Purpose: Add automation tracking fields if they don't exist
-- =============================================================================

DO $$
BEGIN
  -- Add criacao_automatica_executada column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'periodos_avaliacao'
    AND column_name = 'criacao_automatica_executada'
  ) THEN
    ALTER TABLE periodos_avaliacao
    ADD COLUMN criacao_automatica_executada BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add data_criacao_automatica column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'periodos_avaliacao'
    AND column_name = 'data_criacao_automatica'
  ) THEN
    ALTER TABLE periodos_avaliacao
    ADD COLUMN data_criacao_automatica TIMESTAMP;
  END IF;

  -- Add total_avaliacoes_criadas column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'periodos_avaliacao'
    AND column_name = 'total_avaliacoes_criadas'
  ) THEN
    ALTER TABLE periodos_avaliacao
    ADD COLUMN total_avaliacoes_criadas INTEGER DEFAULT 0;
  END IF;

  -- Add usuarios_elegiveis_config column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'periodos_avaliacao'
    AND column_name = 'usuarios_elegiveis_config'
  ) THEN
    ALTER TABLE periodos_avaliacao
    ADD COLUMN usuarios_elegiveis_config JSONB;
  END IF;

  -- Add criterios_personalizados column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'periodos_avaliacao'
    AND column_name = 'criterios_personalizados'
  ) THEN
    ALTER TABLE periodos_avaliacao
    ADD COLUMN criterios_personalizados JSONB;
  END IF;

  -- Add data_limite_autoavaliacao column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'periodos_avaliacao'
    AND column_name = 'data_limite_autoavaliacao'
  ) THEN
    ALTER TABLE periodos_avaliacao
    ADD COLUMN data_limite_autoavaliacao DATE;
  END IF;

  -- Add data_limite_aprovacao column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'periodos_avaliacao'
    AND column_name = 'data_limite_aprovacao'
  ) THEN
    ALTER TABLE periodos_avaliacao
    ADD COLUMN data_limite_aprovacao DATE;
  END IF;
END $$;

-- =============================================================================
-- 5. FUNCTIONS: Helper functions for automation
-- =============================================================================

-- Function to get manager for a user (period-specific or global)
CREATE OR REPLACE FUNCTION get_manager_for_user(
  p_colaborador_id UUID,
  p_periodo_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_gerente_id UUID;
BEGIN
  -- Try to find period-specific manager first
  IF p_periodo_id IS NOT NULL THEN
    SELECT gerente_id INTO v_gerente_id
    FROM avaliacao_colaborador_gerente
    WHERE colaborador_id = p_colaborador_id
      AND periodo_id = p_periodo_id
      AND ativo = TRUE
      AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    LIMIT 1;

    IF v_gerente_id IS NOT NULL THEN
      RETURN v_gerente_id;
    END IF;
  END IF;

  -- Fallback to global manager (periodo_id IS NULL)
  SELECT gerente_id INTO v_gerente_id
  FROM avaliacao_colaborador_gerente
  WHERE colaborador_id = p_colaborador_id
    AND periodo_id IS NULL
    AND ativo = TRUE
    AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
  LIMIT 1;

  RETURN v_gerente_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is eligible for a period
CREATE OR REPLACE FUNCTION is_user_eligible_for_period(
  p_usuario_id UUID,
  p_periodo_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_eligible BOOLEAN;
BEGIN
  -- Check if user is in eligible list for this period
  SELECT EXISTS (
    SELECT 1 FROM avaliacao_usuarios_elegiveis
    WHERE usuario_id = p_usuario_id
      AND (periodo_id = p_periodo_id OR periodo_id IS NULL)
      AND ativo = TRUE
  ) INTO v_is_eligible;

  RETURN v_is_eligible;
END;
$$ LANGUAGE plpgsql;

-- Function to get eligible users for a period
CREATE OR REPLACE FUNCTION get_eligible_users_for_period(
  p_periodo_id UUID
)
RETURNS TABLE (
  usuario_id UUID,
  nome TEXT,
  email TEXT,
  gerente_id UUID,
  gerente_nome TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS usuario_id,
    u.name AS nome,
    u.email AS email,
    get_manager_for_user(u.id, p_periodo_id) AS gerente_id,
    g.name AS gerente_nome
  FROM users_unified u
  LEFT JOIN users_unified g ON g.id = get_manager_for_user(u.id, p_periodo_id)
  WHERE is_user_eligible_for_period(u.id, p_periodo_id) = TRUE
    AND u.is_active = TRUE
    AND u.banned = FALSE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. RLS POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE avaliacao_usuarios_elegiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_colaborador_gerente ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_cron_log ENABLE ROW LEVEL SECURITY;

-- Policies for avaliacao_usuarios_elegiveis
DROP POLICY IF EXISTS "Admins can view all eligible users" ON avaliacao_usuarios_elegiveis;
CREATE POLICY "Admins can view all eligible users" ON avaliacao_usuarios_elegiveis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_super_admin = TRUE)
    )
  );

DROP POLICY IF EXISTS "Admins can manage eligible users" ON avaliacao_usuarios_elegiveis;
CREATE POLICY "Admins can manage eligible users" ON avaliacao_usuarios_elegiveis
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_super_admin = TRUE)
    )
  );

-- Policies for avaliacao_colaborador_gerente
DROP POLICY IF EXISTS "Admins can view all manager mappings" ON avaliacao_colaborador_gerente;
CREATE POLICY "Admins can view all manager mappings" ON avaliacao_colaborador_gerente
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_super_admin = TRUE)
    )
  );

DROP POLICY IF EXISTS "Admins can manage manager mappings" ON avaliacao_colaborador_gerente;
CREATE POLICY "Admins can manage manager mappings" ON avaliacao_colaborador_gerente
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_super_admin = TRUE)
    )
  );

-- Policies for avaliacao_cron_log
DROP POLICY IF EXISTS "Admins can view cron logs" ON avaliacao_cron_log;
CREATE POLICY "Admins can view cron logs" ON avaliacao_cron_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_super_admin = TRUE)
    )
  );

-- =============================================================================
-- 7. VIEWS
-- =============================================================================

-- View: Eligible users with manager information
CREATE OR REPLACE VIEW vw_usuarios_elegiveis_completo AS
SELECT
  ue.id,
  ue.usuario_id,
  u.name AS usuario_nome,
  u.email AS usuario_email,
  ue.periodo_id,
  p.nome AS periodo_nome,
  ue.ativo,
  get_manager_for_user(ue.usuario_id, ue.periodo_id) AS gerente_id,
  g.name AS gerente_nome,
  g.email AS gerente_email,
  ue.data_inclusao,
  ue.data_exclusao,
  ue.motivo_exclusao,
  CASE
    WHEN ue.periodo_id IS NULL THEN 'Global'
    ELSE 'Específico'
  END AS tipo_elegibilidade
FROM avaliacao_usuarios_elegiveis ue
JOIN users_unified u ON u.id = ue.usuario_id
LEFT JOIN periodos_avaliacao p ON p.id = ue.periodo_id
LEFT JOIN users_unified g ON g.id = get_manager_for_user(ue.usuario_id, ue.periodo_id);

-- View: Manager mappings with user information
CREATE OR REPLACE VIEW vw_mapeamento_gerentes_completo AS
SELECT
  cg.id,
  cg.colaborador_id,
  c.name AS colaborador_nome,
  c.email AS colaborador_email,
  cg.gerente_id,
  g.name AS gerente_nome,
  g.email AS gerente_email,
  cg.periodo_id,
  p.nome AS periodo_nome,
  cg.ativo,
  cg.data_inicio,
  cg.data_fim,
  cg.observacoes,
  CASE
    WHEN cg.periodo_id IS NULL THEN 'Global'
    ELSE 'Específico'
  END AS tipo_mapeamento,
  CASE
    WHEN cg.data_fim IS NULL OR cg.data_fim >= CURRENT_DATE THEN TRUE
    ELSE FALSE
  END AS vigente
FROM avaliacao_colaborador_gerente cg
JOIN users_unified c ON c.id = cg.colaborador_id
JOIN users_unified g ON g.id = cg.gerente_id
LEFT JOIN periodos_avaliacao p ON p.id = cg.periodo_id;

-- View: Cron execution summary
CREATE OR REPLACE VIEW vw_cron_execucoes_resumo AS
SELECT
  cl.id,
  cl.periodo_id,
  cl.periodo_nome,
  cl.executado_em,
  cl.status,
  cl.total_usuarios_processados,
  cl.total_avaliacoes_criadas,
  cl.total_erros,
  cl.total_notificacoes_enviadas,
  cl.tempo_execucao_ms,
  cl.triggered_by,
  CASE
    WHEN cl.total_erros = 0 THEN 'Sucesso completo'
    WHEN cl.total_avaliacoes_criadas > 0 THEN 'Sucesso parcial'
    ELSE 'Falha'
  END AS resultado,
  ROUND(
    (cl.total_avaliacoes_criadas::DECIMAL / NULLIF(cl.total_usuarios_processados, 0)) * 100,
    2
  ) AS taxa_sucesso_pct
FROM avaliacao_cron_log cl;

-- =============================================================================
-- 8. TRIGGER: Update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
DROP TRIGGER IF EXISTS update_usuarios_elegiveis_updated_at ON avaliacao_usuarios_elegiveis;
CREATE TRIGGER update_usuarios_elegiveis_updated_at
  BEFORE UPDATE ON avaliacao_usuarios_elegiveis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_colaborador_gerente_updated_at ON avaliacao_colaborador_gerente;
CREATE TRIGGER update_colaborador_gerente_updated_at
  BEFORE UPDATE ON avaliacao_colaborador_gerente
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 001-create-evaluation-automation-tables.sql completed successfully';
  RAISE NOTICE 'Created tables: avaliacao_usuarios_elegiveis, avaliacao_colaborador_gerente, avaliacao_cron_log';
  RAISE NOTICE 'Updated table: periodos_avaliacao (added automation fields)';
  RAISE NOTICE 'Created functions: get_manager_for_user, is_user_eligible_for_period, get_eligible_users_for_period';
  RAISE NOTICE 'Created views: vw_usuarios_elegiveis_completo, vw_mapeamento_gerentes_completo, vw_cron_execucoes_resumo';
  RAISE NOTICE 'Applied RLS policies to all tables';
END $$;
