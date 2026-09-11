-- Memória de longo prazo por usuário (estilo Hermes MEMORY/USER)
-- Sessão de conversa NÃO fica aqui — só fatos/preferências curados.
-- Persiste entre logins; limpeza só sob pedido do usuário ou admin.

CREATE TABLE IF NOT EXISTS ia_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'fact'
    CHECK (kind IN ('preference', 'fact', 'goal', 'correction', 'context', 'skill')),
  content TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  source TEXT NOT NULL DEFAULT 'companion',
  source_ref TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ia_user_memory_user_active
  ON ia_user_memory (user_id, importance DESC)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_ia_user_memory_user_kind
  ON ia_user_memory (user_id, kind)
  WHERE active = true;

ALTER TABLE ia_user_memory ENABLE ROW LEVEL SECURITY;

-- Sem policies para anon/authenticated: acesso só via service_role (API backend)
COMMENT ON TABLE ia_user_memory IS 'LTM curada por usuário (Hermes-like). Não limpar no logout.';
