-- Campo de contrato/template: obrigatório (default) ou opcional.
ALTER TABLE public.solicitacoes_assinatura
    ADD COLUMN IF NOT EXISTS obrigatorio BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.contrato_template_campos
    ADD COLUMN IF NOT EXISTS obrigatorio BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.solicitacoes_assinatura.obrigatorio IS 'Se true, texto/checkbox vazios bloqueiam a assinatura deste documento.';
COMMENT ON COLUMN public.contrato_template_campos.obrigatorio IS 'Copiado para solicitacoes_assinatura ao instanciar o template.';
