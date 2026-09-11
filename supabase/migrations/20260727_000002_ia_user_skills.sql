-- Procedural skills per user (Hermes Agent–like SKILL.md procedural memory)
-- Persists across logins; STM/session clears only on logout — skills do NOT.
-- Cap ~30 active skills per user enforced in application layer.

CREATE TABLE IF NOT EXISTS ia_user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  procedure TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'companion',
  is_active BOOLEAN NOT NULL DEFAULT true,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT ia_user_skills_name_len CHECK (char_length(name) BETWEEN 2 AND 80),
  CONSTRAINT ia_user_skills_procedure_len CHECK (char_length(procedure) BETWEEN 10 AND 8000)
);

-- Unique active skill name per user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ia_user_skills_user_name_active
  ON ia_user_skills (user_id, lower(name))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ia_user_skills_user_active
  ON ia_user_skills (user_id, use_count DESC, updated_at DESC)
  WHERE is_active = true;

ALTER TABLE ia_user_skills ENABLE ROW LEVEL SECURITY;

-- Sem policies para anon/authenticated: acesso só via service_role (API backend)
COMMENT ON TABLE ia_user_skills IS 'Skills procedurais por usuário (Hermes Agent–like). Não limpar no logout.';
