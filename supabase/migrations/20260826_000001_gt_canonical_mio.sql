-- Canonical GT: missing-file flags, anexo retry queue, leftover MIO entities.
-- Future modules read gt_* only (never live MIO / PoliWeb / mio_cache blobs).

ALTER TABLE public.gt_documentos
  ADD COLUMN IF NOT EXISTS arquivo_ausente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivo_ausente_motivo TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_ausente_em TIMESTAMPTZ;

ALTER TABLE public.gt_colaboradores
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.gt_documentos.arquivo_ausente IS
  'True when origem=mio (or other ingest) has metadata but bytes were not copied into gestao-tripulantes-documentos.';

CREATE TABLE IF NOT EXISTS public.gt_mio_anexo_misses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_ref TEXT NOT NULL,
  mio_id TEXT,
  colaborador_id UUID REFERENCES public.gt_colaboradores(id) ON DELETE SET NULL,
  motivo TEXT NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gt_mio_anexo_misses_open
  ON public.gt_mio_anexo_misses (origem_ref)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gt_mio_anexo_misses_open
  ON public.gt_mio_anexo_misses (resolved_at)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gt_mio_entidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  origem_ref TEXT NOT NULL,
  colaborador_id UUID REFERENCES public.gt_colaboradores(id) ON DELETE SET NULL,
  cpf TEXT,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  origem TEXT NOT NULL DEFAULT 'mio',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gt_mio_entidades_origem_check CHECK (origem IN ('mio', 'poliweb', 'local', 'upload', 'manual'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gt_mio_entidades_origem_ref
  ON public.gt_mio_entidades (origem_ref);

CREATE INDEX IF NOT EXISTS idx_gt_mio_entidades_tipo
  ON public.gt_mio_entidades (tipo);

CREATE INDEX IF NOT EXISTS idx_gt_mio_entidades_cpf
  ON public.gt_mio_entidades (cpf);

CREATE INDEX IF NOT EXISTS idx_gt_docs_arquivo_ausente
  ON public.gt_documentos (arquivo_ausente)
  WHERE arquivo_ausente = true AND deleted_at IS NULL;

ALTER TABLE public.gt_historico_embarques
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.gt_mio_anexo_misses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gt_mio_entidades ENABLE ROW LEVEL SECURITY;
