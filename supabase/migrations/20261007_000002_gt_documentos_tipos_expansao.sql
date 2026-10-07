-- Fase 2 — Expansão de tipos de documento GT + migração dos existentes
-- Novos tipos do prontuário DP: pessoal, contratual, demissional, ferias, ponto.
-- ATENÇÃO (ordem de deploy): aplicar esta migração IMEDIATAMENTE ANTES do deploy
-- do código novo — o código novo só grava os valores novos, e o CHECK antigo os
-- rejeitaria. Ordem interna obrigatória: drop CHECK → backfill subtipo → update
-- tipos → add CHECK.
-- Reversão: não trivial (dados migrados); tirar backup de gt_documentos antes.

-- 0) Sanity: valores atualmente em uso (checar no output antes de prosseguir)
-- SELECT DISTINCT tipo_documento FROM public.gt_documentos;

-- 1) Drop do CHECK antigo (nome descoberto dinamicamente)
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'public.gt_documentos'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%tipo_documento%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.gt_documentos DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- 2) Backfill: preserva o tipo antigo em subtipo (rastreabilidade de CNH/CTPS/etc.)
UPDATE public.gt_documentos
SET subtipo = tipo_documento, updated_at = now()
WHERE subtipo IS NULL AND tipo_documento IN
  ('documento_pessoal','cnh','ctps','reservista','titulo_eleitor','certidao_nascimento','certidao_casamento','contrato');

-- 3) Migração dos valores
UPDATE public.gt_documentos SET tipo_documento = 'pessoal', updated_at = now()
WHERE tipo_documento IN ('documento_pessoal','cnh','ctps','reservista','titulo_eleitor','certidao_nascimento','certidao_casamento');
UPDATE public.gt_documentos SET tipo_documento = 'contratual', updated_at = now()
WHERE tipo_documento = 'contrato';

-- 4) Novo CHECK (11 valores)
ALTER TABLE public.gt_documentos
ADD CONSTRAINT gt_documentos_tipo_documento_check CHECK (tipo_documento IN (
  'aso','treinamento','passaporte','certificado','laudo',
  'pessoal','contratual','demissional','ferias','ponto','outro'
));

-- 5) Bucket com limite explícito de 50MB (fluxo signed URL)
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'gestao-tripulantes-documentos';
