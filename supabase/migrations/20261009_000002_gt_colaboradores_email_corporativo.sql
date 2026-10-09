-- E-mail corporativo do colaborador. Opcional. Não substitui gt_colaboradores.email (pessoal).

ALTER TABLE public.gt_colaboradores
  ADD COLUMN IF NOT EXISTS email_corporativo TEXT;

COMMENT ON COLUMN public.gt_colaboradores.email_corporativo IS
  'E-mail corporativo (ex.: @groupabz.com). Opcional. Distinto de email (pessoal).';
