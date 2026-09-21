-- Migration: DP/Folha — provisionamento das tabelas payroll faltantes + Rubricas WK + aprovação
-- Plano: dp-rubricas-wkradar (Onda 0, passo 1)
--
-- Situação real do banco (verificada 2026-09-21): existem payroll_companies,
-- payroll_departments, payroll_employees, payroll_sheets. FALTAM payroll_codes,
-- payroll_sheet_items, payroll_employee_summaries, payroll_audit_log e
-- payroll_calculation_profiles (o seed-payroll-data.sql histórico tem SQL
-- inválido e nunca aplicou). Nenhuma tabela NOVA de design: este script apenas
-- provisiona as tabelas do DDL canônico (scripts/create-payroll-tables.sql) e
-- adiciona as colunas do plano.
-- Idempotente (IF NOT EXISTS / DO blocks condicionais).

-- ============================================================
-- 1. Tabelas do DDL canônico que não existem ainda
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payroll_calculation_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  company_id UUID REFERENCES public.payroll_companies(id),
  rules JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('provento', 'desconto', 'outros')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  calculation_type VARCHAR(20) DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'formula', 'legal')),
  value DECIMAL(10,4) DEFAULT 0,
  formula TEXT,
  legal_type VARCHAR(20),
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(code, type)
);

CREATE TABLE IF NOT EXISTS public.payroll_sheet_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID REFERENCES public.payroll_sheets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.payroll_employees(id) ON DELETE CASCADE,
  code_id UUID REFERENCES public.payroll_codes(id),
  quantity DECIMAL(10,2) DEFAULT 1,
  reference_value DECIMAL(10,2) DEFAULT 0,
  calculated_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_employee_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID REFERENCES public.payroll_sheets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.payroll_employees(id) ON DELETE CASCADE,
  base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_others DECIMAL(10,2) NOT NULL DEFAULT 0,
  inss_base DECIMAL(10,2) DEFAULT 0,
  irrf_base DECIMAL(10,2) DEFAULT 0,
  fgts_base DECIMAL(10,2) DEFAULT 0,
  inss_value DECIMAL(10,2) DEFAULT 0,
  irrf_value DECIMAL(10,2) DEFAULT 0,
  fgts_value DECIMAL(10,2) DEFAULT 0,
  gross_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sheet_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.payroll_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. Colunas faltantes nas tabelas existentes (DDL canônico)
-- ============================================================

ALTER TABLE public.payroll_employees
  ADD COLUMN IF NOT EXISTS pis_pasep VARCHAR(20);

ALTER TABLE public.payroll_sheets
  ADD COLUMN IF NOT EXISTS total_inss DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.payroll_sheets
  ADD COLUMN IF NOT EXISTS total_irrf DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.payroll_sheets
  ADD COLUMN IF NOT EXISTS total_fgts DECIMAL(12,2) DEFAULT 0;

-- ============================================================
-- 3. Constraints exigidas pelo upsert do sync (idempotente via DO block)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payroll_employees'::regclass
      AND conname = 'payroll_employees_company_id_registration_number_key'
  ) THEN
    ALTER TABLE public.payroll_employees
      ADD CONSTRAINT payroll_employees_company_id_registration_number_key
      UNIQUE (company_id, registration_number);
  END IF;
END $$;

-- ============================================================
-- 4. Plano dp-rubricas-wkradar: mapeamento WK, origem de itens, aprovação
-- ============================================================

-- 4a. Mapeamento código WK → rubrica do portal (coluna, não tabela)
ALTER TABLE public.payroll_codes
  ADD COLUMN IF NOT EXISTS codigo_wk TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_codes_codigo_wk
  ON public.payroll_codes (codigo_wk)
  WHERE codigo_wk IS NOT NULL;

-- 4b. Origem do lançamento: manual (padrão) | wk (sync WK Radar) | gt (módulos do portal)
ALTER TABLE public.payroll_sheet_items
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_payroll_items_origem
  ON public.payroll_sheet_items (sheet_id)
  WHERE origem = 'wk';

-- 4c. Estado de aprovação multi-assinatura (padrão fechamento GT v2):
--     { aprovadores, assinaturas, rejeicao?: {por, motivo, em}, hash? } — NULL = não iniciada.
ALTER TABLE public.payroll_sheets
  ADD COLUMN IF NOT EXISTS aprovacao JSONB;

-- ============================================================
-- 5. Índices canônicos
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_payroll_employees_company ON public.payroll_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employees_status ON public.payroll_employees(status);
CREATE INDEX IF NOT EXISTS idx_payroll_sheets_company_period ON public.payroll_sheets(company_id, reference_year, reference_month);
CREATE INDEX IF NOT EXISTS idx_payroll_sheet_items_sheet ON public.payroll_sheet_items(sheet_id);
CREATE INDEX IF NOT EXISTS idx_payroll_sheet_items_employee ON public.payroll_sheet_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_summaries_sheet ON public.payroll_employee_summaries(sheet_id);

-- ============================================================
-- 6. Trigger updated_at (idempotente por tabela)
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
    'payroll_companies','payroll_departments','payroll_employees',
    'payroll_calculation_profiles','payroll_codes','payroll_sheets',
    'payroll_sheet_items','payroll_employee_summaries'
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
END $$;

-- ============================================================
-- 7. Seed das rubricas (fonte: seed-payroll-data.sql canônico, com o
--    SQL inválido `description = background-color:` corrigido).
--    Códigos de rescisão: 301 Aviso Prévio, 302 Multa 40% FGTS,
--    303 Saldo de Salário, 304 13º Proporcional, 305 Férias Proporcionais,
--    306 Férias Vencidas, 307 Multa 20% (acordo art. 484-A).
--    Seed de codigo_wk INTENCIONALMENTE vazio — mapeamento pela UI.
-- ============================================================

INSERT INTO public.payroll_codes (code, type, name, description, calculation_type, legal_type, is_system, is_active) VALUES
('104', 'desconto', 'INSS', 'Contribuição Previdenciária', 'legal', 'inss', true, true),
('108', 'desconto', 'IRRF', 'Imposto de Renda Retido na Fonte', 'legal', 'irrf', true, true),
('119', 'outros', 'FGTS 8%', 'Fundo de Garantia do Tempo de Serviço', 'legal', 'fgts', true, true),
('001', 'provento', 'Dias Normais', 'Salário base por dias trabalhados', 'fixed', null, false, true),
('063', 'provento', 'Adicional de Sobreaviso 20%', 'Adicional por sobreaviso', 'percentage', null, false, true),
('125', 'provento', 'Folga Indenizada', 'Pagamento de folga não gozada', 'fixed', null, false, true),
('127', 'provento', 'Reflexo DSR s/adicional noturno', 'Reflexo do adicional noturno no DSR', 'formula', null, false, true),
('131', 'provento', 'Adicional Noturno 20%', 'Adicional por trabalho noturno', 'percentage', null, false, true),
('138', 'provento', 'Dobra', 'Pagamento em dobro por trabalho em feriado', 'percentage', null, false, true),
('213', 'provento', 'Adicional de Periculosidade 30%', 'Adicional por atividade perigosa', 'percentage', null, false, true),
('002', 'provento', 'Horas Extras 50%', 'Horas extras com adicional de 50%', 'percentage', null, false, true),
('003', 'provento', 'Horas Extras 100%', 'Horas extras com adicional de 100%', 'percentage', null, false, true),
('004', 'provento', 'DSR', 'Descanso Semanal Remunerado', 'formula', null, false, true),
('005', 'provento', 'Férias', 'Pagamento de férias', 'fixed', null, false, true),
('006', 'provento', '1/3 Férias', 'Terço constitucional de férias', 'percentage', null, false, true),
('007', 'provento', '13º Salário', 'Décimo terceiro salário', 'fixed', null, false, true),
('201', 'desconto', 'Vale Transporte', 'Desconto de vale transporte (6%)', 'percentage', null, false, true),
('202', 'desconto', 'Vale Refeição', 'Desconto de vale refeição', 'fixed', null, false, true),
('203', 'desconto', 'Plano de Saúde', 'Desconto de plano de saúde', 'fixed', null, false, true),
('204', 'desconto', 'Seguro de Vida', 'Desconto de seguro de vida', 'fixed', null, false, true),
('205', 'desconto', 'Empréstimo', 'Desconto de empréstimo', 'fixed', null, false, true),
('206', 'desconto', 'Pensão Alimentícia', 'Desconto de pensão alimentícia', 'percentage', null, false, true),
('207', 'desconto', 'Sindicato', 'Contribuição sindical', 'fixed', null, false, true),
('301', 'outros', 'Aviso Prévio', 'Aviso prévio indenizado', 'fixed', null, false, true),
('302', 'outros', 'Multa 40% FGTS', 'Multa rescisória do FGTS', 'percentage', null, false, true),
('303', 'provento', 'Saldo de Salário', 'Saldo de salário dos dias trabalhados no mês da rescisão', 'fixed', null, false, true),
('304', 'provento', '13º Salário Proporcional', 'Décimo terceiro proporcional na rescisão', 'fixed', null, false, true),
('305', 'provento', 'Férias Proporcionais + 1/3', 'Férias proporcionais acrescidas do terço constitucional', 'fixed', null, false, true),
('306', 'provento', 'Férias Vencidas + 1/3', 'Férias vencidas acrescidas do terço constitucional', 'fixed', null, false, true),
('307', 'outros', 'Multa 20% FGTS', 'Multa rescisória do FGTS no acordo mútuo (art. 484-A CLT)', 'percentage', null, false, true)
ON CONFLICT (code, type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  calculation_type = EXCLUDED.calculation_type,
  legal_type = EXCLUDED.legal_type,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMENT ON TABLE public.payroll_codes IS 'Códigos de proventos, descontos e outros (rubricas)';
COMMENT ON TABLE public.payroll_sheet_items IS 'Itens individuais da folha (origem: manual|wk|gt)';
COMMENT ON TABLE public.payroll_employee_summaries IS 'Resumos calculados por funcionário';
COMMENT ON TABLE public.payroll_audit_log IS 'Auditoria de sync/aprovação (origem_evento: wk_sync|consolidacao|assinatura|rejeicao|aprovacao)';
