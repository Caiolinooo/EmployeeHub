-- Fase 3 — ACL por empresa para documentos/colaboradores GT
-- Se o usuário tem 0 linhas aqui, ele vê TODAS as empresas (comportamento atual).
-- Se tem 1+ linhas, só acessa colaboradores/documentos dessas empresas
-- (colaborador sem empresa vinculada continua visível a todos).
-- ADMIN/MANAGER/SUPERADMIN fazem bypass no código.

CREATE TABLE IF NOT EXISTS public.gt_user_empresa_acesso (
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES gt_empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, empresa_id)
);

ALTER TABLE public.gt_user_empresa_acesso ENABLE ROW LEVEL SECURITY; -- service-role only (padrão GT)

CREATE INDEX IF NOT EXISTS idx_gt_user_empresa_acesso_user
  ON public.gt_user_empresa_acesso(user_id);
