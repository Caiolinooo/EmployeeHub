-- Fase 2 — Tabela de títulos pré-cadastrados de documentos GT
-- Lista padrão de nomenclatura por tipo (seed do DP: Admissão→contratual,
-- Desligamento→demissional, Férias→ferias). Gerenciável pelo admin.
-- Aditiva: segura para aplicar em produção a qualquer momento.

CREATE TABLE IF NOT EXISTS public.gt_documento_titulos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN (
    'pessoal','contratual','demissional','ferias','ponto','outro',
    'aso','treinamento','passaporte','certificado','laudo'
  )),
  titulo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tipo_documento, titulo)
);

ALTER TABLE public.gt_documento_titulos ENABLE ROW LEVEL SECURITY; -- service-role only (padrão GT)

CREATE INDEX IF NOT EXISTS idx_gt_doc_titulos_tipo
  ON public.gt_documento_titulos(tipo_documento, ativo, ordem);

DROP TRIGGER IF EXISTS trg_gt_doc_titulos_updated_at ON public.gt_documento_titulos;
CREATE TRIGGER trg_gt_doc_titulos_updated_at
  BEFORE UPDATE ON public.gt_documento_titulos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SEED — Admissão (contratual)
INSERT INTO public.gt_documento_titulos (tipo_documento, titulo, ordem) VALUES
  ('contratual','CONTRATO DE TRABALHO',10),
  ('contratual','FICHA DE EMPREGADO',20),
  ('contratual','INFORMAÇÕES BANCÁRIAS',30),
  ('contratual','ENCARGOS DE FAMÍLIA',40),
  ('contratual','VALE TRANSPORTE',50),
  ('contratual','ACORDO DE PRORROGAÇÃO DE HE OFFSHORE',60),
  ('contratual','ACORDO DE PRORROGAÇÃO DE HORAS DE TRABALHO – ONSHORE',70),
  ('contratual','AUTODECLARAÇÃO ÉTNICO-RACIAL',80),
  ('contratual','ORDEM DE SERVIÇO',90),
  ('contratual','NOMEAÇÃO DE BENEFICIÁRIO – SEGURO DE VIDA',100),
  ('contratual','AUTORIZAÇÃO PARA TRATAMENTO DE DADOS PESSOAIS',110),
  ('contratual','TERMO DE USO DE IMAGEM E VOZ',120),
  ('contratual','TERMO DE CONFIDENCIALIDADE',130),
  ('contratual','CÓDIGO DE CONDUTA, ÉTICA E POLÍTICA DE ANTICORRUPÇÃO',140),
  ('contratual','POLÍTICA DE ÁLCOOL E DROGAS',150),
  ('contratual','POLÍTICA DE HSE',160),
  ('contratual','POLÍTICA DA QUALIDADE',170),
  ('contratual','POLÍTICA DE PRIVACIDADE E COOKIES',180),
  ('contratual','POLÍTICA DE DIREITOS HUMANOS',190),
  ('contratual','POLÍTICA ANTICORRUPÇÃO',200),
  ('contratual','REUNIÃO DE INTEGRAÇÃO OFFSHORE – ONSHORE',210),
  ('contratual','INTEGRAÇÃO – ONSHORE',220),
  ('contratual','DECLARAÇÃO DE OPÇÃO DE TICKET VA E VR',230),
  ('contratual','CARTA ABERTURA DE CONTA ITAÚ',240),
  ('contratual','DECLARAÇÃO DE AUTORIZAÇÃO DE DESCONTO EM RESCISÃO – TRCT',250)
ON CONFLICT (tipo_documento, titulo) DO NOTHING;

-- SEED — Desligamento (demissional)
INSERT INTO public.gt_documento_titulos (tipo_documento, titulo, ordem) VALUES
  ('demissional','AVISO_PRÉVIO',10),
  ('demissional','PEDIDO_DE_DESLIGAMENTO',20),
  ('demissional','DGE (FGTS RESCISÓRIO)',30),
  ('demissional','EXTRATO_FGTS',40),
  ('demissional','FRE (FICHA DE REGISTRO EMPREGADO)',50),
  ('demissional','GFD (FGTS RESCISÓRIO)',60),
  ('demissional','GFD_PGTO (FGTS RESCISÓRIO)',70),
  ('demissional','SD (SEGURO-DESEMPREGO)',80),
  ('demissional','TRCT_ANALÍTICO (TERMO DE RESCISÃO DO CONTRATO DE TRABALHO)',90),
  ('demissional','TRCT_FRENTE (TERMO DE RESCISÃO DO CONTRATO DE TRABALHO)',100),
  ('demissional','TRCT_PGTO (TERMO DE RESCISÃO DO CONTRATO DE TRABALHO)',110),
  ('demissional','TRCT_VERSO (TERMO DE RESCISÃO DO CONTRATO DE TRABALHO)',120),
  ('demissional','ENTREVISTA_DE_DESLIGAMENTO',130)
ON CONFLICT (tipo_documento, titulo) DO NOTHING;

-- SEED — Férias (ferias)
INSERT INTO public.gt_documento_titulos (tipo_documento, titulo, ordem) VALUES
  ('ferias','AVISO DE FÉRIAS',10),
  ('ferias','RECIBO DE FÉRIAS',20),
  ('ferias','FORMULÁRIO DE FÉRIAS',30)
ON CONFLICT (tipo_documento, titulo) DO NOTHING;
