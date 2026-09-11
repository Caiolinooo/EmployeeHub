-- KPI Quadro Branco v1 — boards persistidos (Zod-validated spec JSON)
-- Spec referencia tools allowlisted + widgets React (metric|table|list|chart|markdown).
-- NÃO executa JS/HTML livre no origin do portal.
-- Acesso via service_role (API backend); RLS ligado sem policies anon.

CREATE TABLE IF NOT EXISTS ia_kpi_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Quadro KPI',
  spec JSONB NOT NULL DEFAULT '{"version":1,"widgets":[]}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'team', 'org')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ia_kpi_boards_title_len CHECK (char_length(title) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_ia_kpi_boards_user_updated
  ON ia_kpi_boards (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ia_kpi_boards_user_active
  ON ia_kpi_boards (user_id, is_active)
  WHERE is_active = true;

-- No máximo um board marcado ativo por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_ia_kpi_boards_one_active
  ON ia_kpi_boards (user_id)
  WHERE is_active = true;

ALTER TABLE ia_kpi_boards ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ia_kpi_boards IS 'KPI quadro branco v1: spec Zod-validated, widgets allowlisted. Sem JS/HTML livre.';
COMMENT ON COLUMN ia_kpi_boards.spec IS 'BoardSpec JSON: version, columns, widgets[{id,type,title,data?,dataSource?}]';
COMMENT ON COLUMN ia_kpi_boards.is_active IS 'Board ativo exibido em /kpi para o usuário';
