-- EmployeeHub - Avaliação de Desempenho
-- Migração ADITIVA: respostas detalhadas, drafts, ajustes de critérios e configurações
-- Data: 2025-11-12

-- 0) Pré-requisitos gerais
-- Habilitar extensão pgcrypto quando não habilitada (para gen_random_uuid)
DO $$ BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END $$;

-- 1) Tabela de respostas detalhadas (utilizada por src/lib/services/evaluation-service.ts)
CREATE TABLE IF NOT EXISTS avaliacao_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id UUID NOT NULL REFERENCES avaliacoes_desempenho(id) ON DELETE CASCADE,
  pergunta_id INTEGER NOT NULL CHECK (pergunta_id BETWEEN 11 AND 17),
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  respondente_tipo VARCHAR(20) NOT NULL CHECK (respondente_tipo IN ('collaborator','manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(avaliacao_id, pergunta_id, respondente_tipo)
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_respostas_avaliacao_id ON avaliacao_respostas(avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_respostas_pergunta_id ON avaliacao_respostas(pergunta_id);

-- 1.1) Trigger para manter updated_at
CREATE OR REPLACE FUNCTION trg_avaliacao_respostas_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_avaliacao_respostas_updated_at ON avaliacao_respostas;
CREATE TRIGGER trg_avaliacao_respostas_updated_at
  BEFORE UPDATE ON avaliacao_respostas
  FOR EACH ROW EXECUTE FUNCTION trg_avaliacao_respostas_set_updated_at();

-- 2) Tabela de configuração de avaliadores (já referenciada no código como "avaliacao_config")
CREATE TABLE IF NOT EXISTS avaliacao_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('manager','leader')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_config_user_id ON avaliacao_config(user_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_config_tipo ON avaliacao_config(tipo);
CREATE INDEX IF NOT EXISTS idx_avaliacao_config_ativo ON avaliacao_config(ativo);

-- 2.1) Trigger para manter updated_at
CREATE OR REPLACE FUNCTION trg_avaliacao_config_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_avaliacao_config_updated_at ON avaliacao_config;
CREATE TRIGGER trg_avaliacao_config_updated_at
  BEFORE UPDATE ON avaliacao_config
  FOR EACH ROW EXECUTE FUNCTION trg_avaliacao_config_set_updated_at();

-- 3) Tabela de drafts (rascunhos) para permitir salvar progresso antes de enviar
CREATE TABLE IF NOT EXISTS avaliacao_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id UUID NOT NULL REFERENCES avaliacoes_desempenho(id) ON DELETE CASCADE,
  respondente_tipo VARCHAR(20) NOT NULL CHECK (respondente_tipo IN ('collaborator','manager')),
  conteudo JSONB NOT NULL DEFAULT '{}'::jsonb, -- respostas parciais (por pergunta_id)
  progresso NUMERIC(5,2) DEFAULT 0,            -- 0-100
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(avaliacao_id, respondente_tipo)
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_drafts_avaliacao_id ON avaliacao_drafts(avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_drafts_respondente ON avaliacao_drafts(respondente_tipo);

CREATE OR REPLACE FUNCTION trg_avaliacao_drafts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_avaliacao_drafts_updated_at ON avaliacao_drafts;
CREATE TRIGGER trg_avaliacao_drafts_updated_at
  BEFORE UPDATE ON avaliacao_drafts
  FOR EACH ROW EXECUTE FUNCTION trg_avaliacao_drafts_set_updated_at();

-- 4) Ajustes ADITIVOS em tabelas de critérios existentes (criterios ou criterios_avaliacao)
DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  FOR v_tbl IN SELECT unnest(ARRAY['criterios', 'criterios_avaliacao']) LOOP
    -- Verificar se a tabela existe antes de tentar alterar
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_tbl
    ) THEN
      -- Adições seguras (idempotentes)
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS peso NUMERIC(6,2) DEFAULT 1', v_tbl);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS visibilidade_roles TEXT[]', v_tbl);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS obrigatorio_roles TEXT[]', v_tbl);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tipo_calculo TEXT', v_tbl);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE', v_tbl);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_ativo ON %I(ativo)', v_tbl, v_tbl);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_ordem ON %I(ordem)', v_tbl, v_tbl);
    END IF;
  END LOOP;
END $$;

-- 5) Tabela de configurações de cálculo e visibilidade (escopos: global ou por período)
CREATE TABLE IF NOT EXISTS avaliacao_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global','periodo')),
  periodo_id UUID NULL, -- FK opcional; evitar hard dependency para compatibilidade
  calculo JSONB NOT NULL DEFAULT '{"method":"simple_average"}'::jsonb, -- method: simple_average|weighted; category methods
  obrigatoriedade JSONB NOT NULL DEFAULT '{}'::jsonb, -- required_by_role, visibility_by_role
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_settings_scope ON avaliacao_settings(scope);
CREATE INDEX IF NOT EXISTS idx_avaliacao_settings_periodo ON avaliacao_settings(periodo_id);

CREATE OR REPLACE FUNCTION trg_avaliacao_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_avaliacao_settings_updated_at ON avaliacao_settings;
CREATE TRIGGER trg_avaliacao_settings_updated_at
  BEFORE UPDATE ON avaliacao_settings
  FOR EACH ROW EXECUTE FUNCTION trg_avaliacao_settings_set_updated_at();

-- 6) View de avaliações com agregados de respostas (criada conforme disponibilidade de tabelas de ciclo)
DO $$
DECLARE
  v_has_avaliacao_ciclos BOOLEAN := EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='avaliacao_ciclos'
  );
  v_has_ciclos_avaliacao BOOLEAN := EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ciclos_avaliacao'
  );
  v_sql TEXT;
BEGIN
  IF v_has_avaliacao_ciclos THEN
    v_sql := $$
      CREATE OR REPLACE VIEW vw_avaliacoes_desempenho AS
      SELECT
        a.id,
        a.funcionario_id,
        a.avaliador_id,
        a.ciclo_id,
        ac.nome AS ciclo_nome,
        ac.ano AS ciclo_ano,
        a.periodo,
        a.data_inicio,
        a.data_fim,
        a.status,
        a.observacoes,
        a.created_at,
        a.updated_at,
        a.deleted_at,
        fu.first_name || ' ' || fu.last_name AS funcionario_nome,
        fu.position AS funcionario_cargo,
        fu.department AS funcionario_departamento,
        fu.email AS funcionario_email,
        avu.first_name || ' ' || avu.last_name AS avaliador_nome,
        avu.position AS avaliador_cargo,
        avu.department AS avaliador_departamento,
        avu.email AS avaliador_email,
        (SELECT COALESCE(AVG(nota),0) FROM avaliacao_respostas ar WHERE ar.avaliacao_id = a.id) AS media_geral,
        (SELECT COUNT(*) FROM avaliacao_respostas ar WHERE ar.avaliacao_id = a.id) AS total_respostas
      FROM avaliacoes_desempenho a
      LEFT JOIN users_unified fu ON a.funcionario_id = fu.id
      LEFT JOIN users_unified avu ON a.avaliador_id = avu.id
      LEFT JOIN avaliacao_ciclos ac ON a.ciclo_id = ac.id;
    $$;
  ELSIF v_has_ciclos_avaliacao THEN
    v_sql := $$
      CREATE OR REPLACE VIEW vw_avaliacoes_desempenho AS
      SELECT
        a.id,
        a.funcionario_id,
        a.avaliador_id,
        a.ciclo_id,
        ac.nome AS ciclo_nome,
        ac.ano AS ciclo_ano,
        a.periodo,
        a.data_inicio,
        a.data_fim,
        a.status,
        a.observacoes,
        a.created_at,
        a.updated_at,
        a.deleted_at,
        fu.first_name || ' ' || fu.last_name AS funcionario_nome,
        fu.position AS funcionario_cargo,
        fu.department AS funcionario_departamento,
        fu.email AS funcionario_email,
        avu.first_name || ' ' || avu.last_name AS avaliador_nome,
        avu.position AS avaliador_cargo,
        avu.department AS avaliador_departamento,
        avu.email AS avaliador_email,
        (SELECT COALESCE(AVG(nota),0) FROM avaliacao_respostas ar WHERE ar.avaliacao_id = a.id) AS media_geral,
        (SELECT COUNT(*) FROM avaliacao_respostas ar WHERE ar.avaliacao_id = a.id) AS total_respostas
      FROM avaliacoes_desempenho a
      LEFT JOIN users_unified fu ON a.funcionario_id = fu.id
      LEFT JOIN users_unified avu ON a.avaliador_id = avu.id
      LEFT JOIN ciclos_avaliacao ac ON a.ciclo_id = ac.id;
    $$;
  ELSE
    v_sql := $$
      CREATE OR REPLACE VIEW vw_avaliacoes_desempenho AS
      SELECT
        a.id,
        a.funcionario_id,
        a.avaliador_id,
        a.ciclo_id,
        NULL::text AS ciclo_nome,
        NULL::int AS ciclo_ano,
        a.periodo,
        a.data_inicio,
        a.data_fim,
        a.status,
        a.observacoes,
        a.created_at,
        a.updated_at,
        a.deleted_at,
        fu.first_name || ' ' || fu.last_name AS funcionario_nome,
        fu.position AS funcionario_cargo,
        fu.department AS funcionario_departamento,
        fu.email AS funcionario_email,
        avu.first_name || ' ' || avu.last_name AS avaliador_nome,
        avu.position AS avaliador_cargo,
        avu.department AS avaliador_departamento,
        avu.email AS avaliador_email,
        (SELECT COALESCE(AVG(nota),0) FROM avaliacao_respostas ar WHERE ar.avaliacao_id = a.id) AS media_geral,
        (SELECT COUNT(*) FROM avaliacao_respostas ar WHERE ar.avaliacao_id = a.id) AS total_respostas
      FROM avaliacoes_desempenho a
      LEFT JOIN users_unified fu ON a.funcionario_id = fu.id
      LEFT JOIN users_unified avu ON a.avaliador_id = avu.id;
    $$;
  END IF;
  EXECUTE v_sql;
END $$;

-- 7) RLS: habilitar e políticas mínimas nas novas tabelas
ALTER TABLE avaliacao_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_settings ENABLE ROW LEVEL SECURITY;

-- Respostas: funcionário ou avaliador da avaliação podem ler/escrever suas respostas
DROP POLICY IF EXISTS avaliacao_respostas_select ON avaliacao_respostas;
CREATE POLICY avaliacao_respostas_select ON avaliacao_respostas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM avaliacoes_desempenho a
      WHERE a.id = avaliacao_respostas.avaliacao_id
        AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS avaliacao_respostas_insert ON avaliacao_respostas;
CREATE POLICY avaliacao_respostas_insert ON avaliacao_respostas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM avaliacoes_desempenho a
      WHERE a.id = avaliacao_respostas.avaliacao_id
        AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS avaliacao_respostas_update ON avaliacao_respostas;
CREATE POLICY avaliacao_respostas_update ON avaliacao_respostas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM avaliacoes_desempenho a
      WHERE a.id = avaliacao_respostas.avaliacao_id
        AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
    )
  );

-- Config de avaliadores: apenas admin gerencia; todos podem consultar ativo
DROP POLICY IF EXISTS avaliacao_config_select ON avaliacao_config;
CREATE POLICY avaliacao_config_select ON avaliacao_config
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS avaliacao_config_all_admin ON avaliacao_config;
CREATE POLICY avaliacao_config_all_admin ON avaliacao_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Drafts: somente envolvidos
DROP POLICY IF EXISTS avaliacao_drafts_rw ON avaliacao_drafts;
CREATE POLICY avaliacao_drafts_rw ON avaliacao_drafts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM avaliacoes_desempenho a
      WHERE a.id = avaliacao_drafts.avaliacao_id
        AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
    )
  );

-- Settings: leitura pública; admins gerenciam
DROP POLICY IF EXISTS avaliacao_settings_select ON avaliacao_settings;
CREATE POLICY avaliacao_settings_select ON avaliacao_settings
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS avaliacao_settings_all_admin ON avaliacao_settings;
CREATE POLICY avaliacao_settings_all_admin ON avaliacao_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 8) Funções utilitárias
CREATE OR REPLACE FUNCTION calcular_media_avaliacao(p_avaliacao_id UUID)
RETURNS NUMERIC AS $$
DECLARE v_media NUMERIC; BEGIN
  SELECT COALESCE(AVG(nota),0) INTO v_media
  FROM avaliacao_respostas WHERE avaliacao_id = p_avaliacao_id;
  RETURN ROUND(v_media, 1);
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION atualizar_media_avaliacao()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE avaliacoes_desempenho SET updated_at = NOW() WHERE id = NEW.avaliacao_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_media ON avaliacao_respostas;
CREATE TRIGGER trigger_atualizar_media
  AFTER INSERT OR UPDATE ON avaliacao_respostas
  FOR EACH ROW EXECUTE FUNCTION atualizar_media_avaliacao();

-- 9) Seed inicial de avaliadores configurados (baseado em roles)
INSERT INTO avaliacao_config (user_id, tipo)
SELECT id,
       CASE WHEN role IN ('ADMIN','MANAGER') THEN 'manager' ELSE 'leader' END
FROM users_unified u
WHERE u.role IN ('ADMIN','MANAGER')
ON CONFLICT (user_id, tipo) DO NOTHING;

-- FIM: Migração aditiva concluída
