-- Recrutamento: soft delete (deleted_at) em vagas e prospectos.

ALTER TABLE public.rc_vagas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.rc_prospectos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Unicidade de CPF só entre registros ativos (excluídos não bloqueiam novo cadastro).
CREATE UNIQUE INDEX IF NOT EXISTS uq_rc_prospectos_cpf_ativo
  ON public.rc_prospectos (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rc_vagas_deleted ON public.rc_vagas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_rc_prospectos_deleted ON public.rc_prospectos(deleted_at);
