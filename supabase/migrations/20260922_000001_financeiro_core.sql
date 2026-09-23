-- Migration: Financeiro core — clientes, faturas, bancos, cobranças,
-- conciliação, pagamentos, eventos (§2.1 do design financeiro).
-- Padrão do repo (20260921_000001_dp_folha_wk.sql):
--   idempotente (CREATE/INDEX IF NOT EXISTS, DO blocks condicionais),
--   RLS ENABLED com ZERO policies (leituras/escritas só via service_role /
--   supabaseAdmin), triggers update_updated_at_column idempotentes.
-- Executor: node scripts/apply-financeiro-core.js  → FIN_APPLY_CORE_OK

-- ============================================================
-- 1. Clientes de faturação (perfil multi-empresa, espelha client_profiles.json do 1_Invoice)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.payroll_companies(id),      -- emissor
  client_key VARCHAR(60) NOT NULL,                                       -- 'FMS','OMEGA','JIFMAR_VOE_VANGUARD'
  nome VARCHAR(255) NOT NULL,
  documento VARCHAR(20),                                                 -- CPF/CNPJ (tomador)
  email VARCHAR(255),
  endereco JSONB,
  moeda VARCHAR(3) NOT NULL DEFAULT 'BRL',
  condicao_pagamento TEXT,
  categoria VARCHAR(30),                                                 -- offshore|maritime|onshore
  subcategoria VARCHAR(120),                                             -- ex: embarcação
  metadados JSONB DEFAULT '{}',                                          -- parser/filename pattern legado
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, client_key)
);

-- ============================================================
-- 2. Templates de layout de fatura (xlsx do 1_Invoice ou HTML)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_fatura_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(120) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('xlsx','html')),
  storage_path TEXT NOT NULL,                       -- bucket 'financeiro-templates'
  mapping JSONB NOT NULL DEFAULT '{}',              -- anchors: celulas/servicos/totais/conta
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- mapping xlsx (referência Template_Invoice_Geral.xlsx):
-- { "celulas": {"invoice_no":"H4","invoice_date":"H5","call_off":"H6","cliente":"B10"},
--   "servicos": {"linha_inicial":18,"linha_final":29,"colunas":{"descricao":"B","referencia":"E","valor":"H"}},
--   "totais": {"celula":"H31"}, "conta": {"secao":"Corporate Account Details"} }

-- ============================================================
-- 3. Faturas (cabeçalho) + itens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_faturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.payroll_companies(id),
  cliente_id UUID REFERENCES public.fin_clientes(id),
  numero INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  competencia_mes INTEGER, competencia_ano INTEGER,
  origem_tipo VARCHAR(10) NOT NULL CHECK (origem_tipo IN ('folha','medicao','manual')),
  payroll_sheet_id UUID,                            -- referência solta (padrão gt_desligamentos), sem FK
  template_id UUID REFERENCES public.fin_fatura_templates(id),
  moeda VARCHAR(3) NOT NULL DEFAULT 'BRL',
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  data_emissao DATE, data_vencimento DATE,
  condicao_pagamento TEXT,
  call_off VARCHAR(60),
  cliente_snapshot JSONB,                           -- nome/documento/endereço no dia da emissão
  observacoes TEXT,
  status VARCHAR(15) NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','emitida','nfse_emitida','paga','cancelada')),
  created_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, ano, numero)
);
CREATE TABLE IF NOT EXISTS public.fin_fatura_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fatura_id UUID NOT NULL REFERENCES public.fin_faturas(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  descricao VARCHAR(255) NOT NULL,
  referencia VARCHAR(120),                          -- colaborador/competência/item de medição
  quantidade DECIMAL(10,2) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  origem VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (origem IN ('folha','medicao','manual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Integrações de banco (config NÃO-secreta; segredos → app_secrets)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_integracoes_banco (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adapter_key VARCHAR(30) NOT NULL,                 -- itau|xp|bb|santander|bradesco|...
  apelido VARCHAR(120) NOT NULL,
  ambiente VARCHAR(10) NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox','producao')),
  certificado_path TEXT,                            -- bucket 'financeiro-certificados' (.pfx)
  certificado_fingerprint VARCHAR(64),
  certificado_validade DATE,
  status VARCHAR(15) NOT NULL DEFAULT 'configurando'
    CHECK (status IN ('configurando','ativa','erro','desativada')),
  ultima_testagem JSONB,                            -- {em, ok, detalhe}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. Contas bancárias (movimentação/recebimento)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_contas_bancarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.payroll_companies(id),
  integracao_id UUID REFERENCES public.fin_integracoes_banco(id),
  banco_codigo VARCHAR(5) NOT NULL,                 -- FEBRABAN: 341 Itaú, 348 XP, 001 BB...
  banco_nome VARCHAR(120),
  agencia VARCHAR(20), conta VARCHAR(30), digito VARCHAR(2),
  tipo VARCHAR(15) NOT NULL DEFAULT 'corrente' CHECK (tipo IN ('corrente','investimento','pagamento')),
  titular_nome VARCHAR(255) NOT NULL, titular_documento VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. Cobranças geradas (boleto/pix) contra uma fatura
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_cobrancas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fatura_id UUID NOT NULL REFERENCES public.fin_faturas(id),
  conta_bancaria_id UUID NOT NULL REFERENCES public.fin_contas_bancarias(id),
  tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('boleto','pix','transferencia')),
  valor DECIMAL(12,2) NOT NULL,
  vencimento DATE,
  status VARCHAR(15) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','gerada','liquidada','expirada','cancelada')),
  id_externo VARCHAR(120),                          -- id no banco
  nosso_numero VARCHAR(60), linha_digitavel VARCHAR(80),
  txid VARCHAR(80), qr_code_emv TEXT,
  resposta_adapter JSONB,                           -- raw sanitizado (sem segredos)
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. Pagamentos em lote (folha → colaboradores)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origem_tipo VARCHAR(15) NOT NULL CHECK (origem_tipo IN ('payroll_sheet','manual')),
  origem_id UUID,                                   -- payroll_sheets.id
  conta_bancaria_id UUID NOT NULL REFERENCES public.fin_contas_bancarias(id),
  favorecido JSONB NOT NULL,                        -- {nome,documento,banco,agencia,conta,digito,tipoConta}
  valor DECIMAL(12,2) NOT NULL,
  data_prevista DATE,
  status VARCHAR(15) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','enviado','processado','rejeitado','cancelado')),
  lote_id_externo VARCHAR(120), id_externo VARCHAR(120),
  resposta_adapter JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. Conciliação (extrato/movimentos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_conciliacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conta_bancaria_id UUID NOT NULL REFERENCES public.fin_contas_bancarias(id),
  data_movimento DATE NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('credito','debito')),
  valor DECIMAL(12,2) NOT NULL,
  descricao TEXT,
  id_externo VARCHAR(120),
  origem VARCHAR(10) NOT NULL CHECK (origem IN ('api','csv','manual')),
  cobranca_id UUID REFERENCES public.fin_cobrancas(id),
  status VARCHAR(15) NOT NULL DEFAULT 'nao_conciliado'
    CHECK (status IN ('nao_conciliado','conciliado','ignorado')),
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conta_bancaria_id, id_externo)
);

-- ============================================================
-- 9. Log de eventos financeiros (trilha única)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fin_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entidade VARCHAR(20) NOT NULL CHECK (entidade IN ('fatura','nfse','cobranca','pagamento','conciliacao','integracao')),
  entidade_id UUID,
  tipo VARCHAR(60) NOT NULL,                        -- ex: fatura.emitida, nfse.autorizada, cobranca.liquidada
  payload JSONB,
  ator_id UUID, ator_nome TEXT,                     -- JWT do portal ou 'system'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fin_faturas_empresa_periodo ON public.fin_faturas(empresa_id, ano, numero);
CREATE INDEX IF NOT EXISTS idx_fin_faturas_status ON public.fin_faturas(status);
CREATE INDEX IF NOT EXISTS idx_fin_fatura_itens_fatura ON public.fin_fatura_itens(fatura_id);
CREATE INDEX IF NOT EXISTS idx_fin_cobrancas_fatura ON public.fin_cobrancas(fatura_id);
CREATE INDEX IF NOT EXISTS idx_fin_concil_conta_data ON public.fin_conciliacoes(conta_bancaria_id, data_movimento);
CREATE INDEX IF NOT EXISTS idx_fin_eventos_entidade ON public.fin_eventos(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_fin_clientes_empresa ON public.fin_clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fin_pagamentos_origem ON public.fin_pagamentos(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_fin_concil_status ON public.fin_conciliacoes(status);
CREATE INDEX IF NOT EXISTS idx_fin_cobrancas_lookup ON public.fin_cobrancas(txid, nosso_numero);

-- ============================================================
-- 11. RLS: ENABLE e ZERO policies (padrão do repo; só service_role acessa)
-- ============================================================

ALTER TABLE public.fin_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_fatura_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_fatura_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_integracoes_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_conciliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_eventos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. Trigger updated_at (idempotente por tabela; função já existe no repo).
--     fin_eventos/fin_fatura_itens não têm updated_at → sem trigger.
--     fin_conciliacoes também não tem updated_at (design §2.1) — reparo
--     idempotente remove trigger eventualmente criado por execução antiga.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fin_clientes','fin_fatura_templates','fin_faturas',
    'fin_integracoes_banco','fin_contas_bancarias','fin_cobrancas',
    'fin_pagamentos'
  ] LOOP
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

  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'fin_conciliacoes'
      AND trigger_name = 'update_fin_conciliacoes_updated_at'
  ) THEN
    DROP TRIGGER update_fin_conciliacoes_updated_at ON public.fin_conciliacoes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'fin_fatura_itens'
      AND trigger_name = 'update_fin_fatura_itens_updated_at'
  ) THEN
    DROP TRIGGER update_fin_fatura_itens_updated_at ON public.fin_fatura_itens;
  END IF;
END $$;

COMMENT ON TABLE public.fin_clientes IS 'Clientes de faturação (perfil multi-empresa, espelha client_profiles.json do 1_Invoice)';
COMMENT ON TABLE public.fin_faturas IS 'Faturas (cabeçalho); nº sequencial por empresa+ano; snapshot do cliente na emissão';
COMMENT ON TABLE public.fin_fatura_itens IS 'Itens da fatura (origem: folha|medicao|manual)';
COMMENT ON TABLE public.fin_integracoes_banco IS 'Integrações de banco (config não-secreta; segredos em app_secrets)';
COMMENT ON TABLE public.fin_cobrancas IS 'Cobranças boleto/pix contra faturas';
COMMENT ON TABLE public.fin_conciliacoes IS 'Movimentos de extrato para conciliação (UNIQUE conta+id_externo)';
COMMENT ON TABLE public.fin_eventos IS 'Trilha de eventos financeiros (fatura.emitida, nfse.autorizada, cobranca.liquidada...)';
