-- Prazo do contrato: tipo continua TEXT em prazo_contrato (select grava o rótulo).
-- Dias e datas só quando o tipo exige vigência.
-- Sem regra automática: Experiência não vira Indeterminado aos 90 dias.

ALTER TABLE public.gt_colaboradores
  ADD COLUMN IF NOT EXISTS prazo_contrato_dias INTEGER,
  ADD COLUMN IF NOT EXISTS prazo_contrato_termino DATE,
  ADD COLUMN IF NOT EXISTS prazo_contrato_prorrog_dias INTEGER,
  ADD COLUMN IF NOT EXISTS prazo_contrato_prorrog_termino DATE;

COMMENT ON COLUMN public.gt_colaboradores.prazo_contrato IS
  'Tipo do prazo (texto): Indeterminado, Determinado, Experiência, Não se aplica, temporário. Texto livre legado permanece.';

COMMENT ON COLUMN public.gt_colaboradores.prazo_contrato_dias IS
  'Dias da vigência. Null em Indeterminado e Não se aplica.';

COMMENT ON COLUMN public.gt_colaboradores.prazo_contrato_termino IS
  'Data de término da vigência. Null em Indeterminado e Não se aplica. Opcional.';

COMMENT ON COLUMN public.gt_colaboradores.prazo_contrato_prorrog_dias IS
  'Dias da prorrogação. Só Experiência. Null nos demais tipos.';

COMMENT ON COLUMN public.gt_colaboradores.prazo_contrato_prorrog_termino IS
  'Término da prorrogação. Só Experiência. Null nos demais tipos. Opcional.';
