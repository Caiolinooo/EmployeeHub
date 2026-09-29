-- 20260929_000001_gt_documentos_origem_importado.sql
-- Adiciona 'importado' e 'local' ao CHECK de gt_documentos.origem, alinhando o
-- banco ao contrato canônico documentado (mio | poliweb | upload | manual | ocr
-- | local | importado — ver src/app/api/gestao-tripulantes/AGENTS.md).
-- Motivação: pipeline dp-import (scripts/dp-import.ts) grava origem='importado'
-- para documentos trazidos do fileserver DATA-ABZ.
-- Idempotente: remove o CHECK antigo (qualquer que seja o nome) e recria.

DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.gt_documentos'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%origem%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.gt_documentos DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.gt_documentos
  ADD CONSTRAINT gt_documentos_origem_check
  CHECK (origem IN ('upload', 'poliweb', 'mio', 'manual', 'ocr', 'local', 'importado'));
