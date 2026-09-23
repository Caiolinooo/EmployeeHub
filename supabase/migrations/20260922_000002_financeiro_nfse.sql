-- Migration: Financeiro NFS-e — municípios (registry IBGE), config de emissão
-- e emissões RPS/NFS-e (§2.2 do design financeiro).
-- Padrão do repo: idempotente, RLS ENABLED com ZERO policies (só service_role).
-- Executor: node scripts/apply-financeiro-nfse.js  → FIN_APPLY_NFSE_OK

-- ============================================================
-- 1. Registry de municípios (IBGE; provider/wsdl editáveis no admin)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_municipios (
  codigo_ibge VARCHAR(7) PRIMARY KEY,               -- ex: '3302403' Macaé/RJ
  nome VARCHAR(160) NOT NULL,
  uf VARCHAR(2) NOT NULL,
  provider_sugerido VARCHAR(20) CHECK (provider_sugerido IN ('abrasf202','abrasf204','nacional','proprietario')),
  wsdl_url TEXT,                                    -- webservice municipal (ABRASF/proprietário)
  ambiente_urls JSONB,                              -- {"producao":"...","homologacao":"..."}
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Config NFS-e por empresa+município
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_nfse_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.payroll_companies(id),
  municipio_id VARCHAR(7) NOT NULL REFERENCES public.fin_municipios(codigo_ibge),
  provider_key VARCHAR(20) NOT NULL CHECK (provider_key IN ('abrasf202','abrasf204','nacional','proprietario')),
  inscricao_municipal VARCHAR(40),
  regime_especial VARCHAR(20),                      -- 1..6 ABRASF (nullable)
  optante_simples BOOLEAN DEFAULT false,
  incentivo_fiscal BOOLEAN DEFAULT false,
  aliquota_iss DECIMAL(5,2),
  iss_retido_padrao BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',                        -- urls proprietárias etc. (valores → app_secrets)
  rps_serie VARCHAR(10) NOT NULL DEFAULT '1',
  proximo_numero_rps INTEGER NOT NULL DEFAULT 1,    -- contador transacional (§5.2)
  certificado_path TEXT, certificado_fingerprint VARCHAR(64), certificado_validade DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, municipio_id)
);

-- ============================================================
-- 3. Emissões (RPS → NFS-e)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_nfse_emissoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fatura_id UUID NOT NULL REFERENCES public.fin_faturas(id),
  nfse_config_id UUID NOT NULL REFERENCES public.fin_nfse_config(id),
  provider_key VARCHAR(20) NOT NULL,
  ambiente VARCHAR(15) NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
  status VARCHAR(15) NOT NULL DEFAULT 'rps_gerado'
    CHECK (status IN ('rps_gerado','enviado','autorizado','rejeitado','cancelado')),
  rps_numero INTEGER NOT NULL, rps_serie VARCHAR(10) NOT NULL,
  lote_id VARCHAR(60), protocolo VARCHAR(60),
  numero_nfse VARCHAR(30), codigo_verificacao VARCHAR(60),
  xml_rps TEXT, xml_nfse TEXT, xml_cancelamento TEXT,
  resumo_tributos JSONB,                            -- {valorServicos, aliquotaIss, valorIss, issRetido, baseCalculo}
  mensagem_erro JSONB,                              -- {codigo, mensagem}
  tentativas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_nfse_emissoes_fatura ON public.fin_nfse_emissoes(fatura_id);
CREATE INDEX IF NOT EXISTS idx_fin_nfse_emissoes_status ON public.fin_nfse_emissoes(status);
CREATE INDEX IF NOT EXISTS idx_fin_municipios_uf ON public.fin_municipios(uf);

-- Correção do design §2.2: 'homologacao' tem 11 chars e não caberia em VARCHAR(10).
-- Idempotente: tabelas novas já nascem com VARCHAR(15).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fin_nfse_emissoes'
      AND column_name = 'ambiente' AND character_maximum_length = 10
  ) THEN
    ALTER TABLE public.fin_nfse_emissoes ALTER COLUMN ambiente TYPE VARCHAR(15);
  END IF;
END $$;

-- ============================================================
-- 4. RLS: ENABLE e ZERO policies (só service_role/supabaseAdmin)
-- ============================================================

ALTER TABLE public.fin_municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_nfse_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_nfse_emissoes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Trigger updated_at (idempotente)
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fin_nfse_config','fin_nfse_emissoes'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table = t
        AND trigger_name = 'update_' || t || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 6. Seed mínimo: Macaé como primeiro caso real (não sobrescreve edições admin)
-- ============================================================

INSERT INTO public.fin_municipios (codigo_ibge, nome, uf, provider_sugerido) VALUES
  ('3302403','Macaé','RJ','proprietario')
ON CONFLICT (codigo_ibge) DO NOTHING;

COMMENT ON TABLE public.fin_municipios IS 'Registry de municípios IBGE; provider_sugerido/wsdl_url editáveis no admin (seed não sobrescreve)';
COMMENT ON TABLE public.fin_nfse_config IS 'Config NFS-e por empresa+município; proximo_numero_rps é contador transacional';
COMMENT ON TABLE public.fin_nfse_emissoes IS 'Emissões RPS/NFS-e (rps_gerado→enviado→autorizado|rejeitado; autorizado→cancelado)';
