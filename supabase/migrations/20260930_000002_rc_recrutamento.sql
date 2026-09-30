-- Recrutamento: vagas do Inhire + prospectos antes de virarem gt_colaboradores.
-- RLS ligado, zero policies — runtime via supabaseAdmin (service_role), padrão do repo.

CREATE TABLE IF NOT EXISTS public.rc_vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inhire_id TEXT UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  empresa TEXT,
  centro_custo TEXT,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'pausada', 'fechada', 'rascunho')),
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rc_prospectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id UUID REFERENCES public.rc_vagas(id) ON DELETE SET NULL,
  inhire_candidato_id TEXT UNIQUE,
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  telefone TEXT,
  telefone_2 TEXT,
  dados JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'prospecto' CHECK (status IN ('prospecto', 'pre_cadastro', 'aprovado', 'contratado', 'rejeitado', 'convertido')),
  colaborador_id UUID REFERENCES public.gt_colaboradores(id) ON DELETE SET NULL,
  convertido_em TIMESTAMPTZ,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rc_prospectos_cpf
  ON public.rc_prospectos (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

CREATE INDEX IF NOT EXISTS idx_rc_prospectos_status ON public.rc_prospectos(status);
CREATE INDEX IF NOT EXISTS idx_rc_prospectos_vaga ON public.rc_prospectos(vaga_id);

ALTER TABLE public.rc_vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rc_prospectos ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rc_vagas IS 'Vagas (mirror Inhire ou manual)';
COMMENT ON TABLE public.rc_prospectos IS 'Candidatos em pré-cadastro antes de virarem gt_colaboradores (DP converte)';
COMMENT ON COLUMN public.rc_prospectos.cpf IS '11 dígitos; preenchido no pré-cadastro, nunca inventado';
