-- A1 único da empresa + URLs oficiais da SPE de Macaé (ABRASF 2.03).
-- Idempotente. Não emite nota, não altera dados fiscais de terceiros.

UPDATE public.fin_municipios
SET
  provider_sugerido = 'abrasf204',
  wsdl_url = 'https://spe.macae.rj.gov.br/nfse/WSNacional2/nfse.asmx',
  ambiente_urls = jsonb_build_object(
    'producao', 'https://spe.macae.rj.gov.br/nfse/WSNacional2/nfse.asmx',
    'homologacao', 'https://macaehomologacao.nfe.com.br/nfse/wsnacional2/nfse.asmx'
  ),
  atualizado_em = NOW()
WHERE codigo_ibge = '3302403';

INSERT INTO public.fin_municipios (codigo_ibge, nome, uf, provider_sugerido, wsdl_url, ambiente_urls)
VALUES (
  '3302403',
  'Macaé',
  'RJ',
  'abrasf204',
  'https://spe.macae.rj.gov.br/nfse/WSNacional2/nfse.asmx',
  jsonb_build_object(
    'producao', 'https://spe.macae.rj.gov.br/nfse/WSNacional2/nfse.asmx',
    'homologacao', 'https://macaehomologacao.nfe.com.br/nfse/wsnacional2/nfse.asmx'
  )
)
ON CONFLICT (codigo_ibge) DO UPDATE SET
  provider_sugerido = EXCLUDED.provider_sugerido,
  wsdl_url = EXCLUDED.wsdl_url,
  ambiente_urls = EXCLUDED.ambiente_urls,
  atualizado_em = NOW();
