-- Migration: Cadastros fiscais — NFS-e nacional + invoice internacional
-- (§1 do design dp-folha, 2026-09-23).
-- Padrão do repo (20260922_000001_financeiro_core.sql):
--   idempotente (ADD COLUMN IF NOT EXISTS), RLS ENABLED com ZERO policies
--   (leituras/escritas só via service_role / supabaseAdmin — já habilitado
--   nas tabelas; reafirmado aqui de forma idempotente).
-- Executor: node scripts/apply-cadastros-fiscais.js  → APPLY_CADASTROS_OK

-- ============================================================
-- 1. Empresa emissora (payroll_companies) — cadastro fiscal/endereço
--    estruturado (address TEXT legado permanece como fallback)
-- ============================================================

ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(30);
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(30);
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS bairro VARCHAR(120);
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS cep VARCHAR(9);
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS municipio VARCHAR(120);
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS uf CHAR(2);
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS municipio_ibge VARCHAR(7);
ALTER TABLE public.payroll_companies ADD COLUMN IF NOT EXISTS cnae_principal VARCHAR(10);

-- ============================================================
-- 2. Tomador/cliente (fin_clientes) — IM/IE, país ISO e Tax ID/VAT
--    alfanumérico (exterior), template padrão do cliente
-- ============================================================

ALTER TABLE public.fin_clientes ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(30);
ALTER TABLE public.fin_clientes ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(30);
ALTER TABLE public.fin_clientes ADD COLUMN IF NOT EXISTS pais CHAR(2) DEFAULT 'BR';
ALTER TABLE public.fin_clientes ADD COLUMN IF NOT EXISTS tax_id VARCHAR(40);
ALTER TABLE public.fin_clientes ADD COLUMN IF NOT EXISTS default_template_id UUID;

-- ============================================================
-- 3. Itens da fatura — código LC 116/2003, alíquota ISS e CNAE por item
-- ============================================================

ALTER TABLE public.fin_fatura_itens ADD COLUMN IF NOT EXISTS codigo_lc116 VARCHAR(10);
ALTER TABLE public.fin_fatura_itens ADD COLUMN IF NOT EXISTS aliquota_iss NUMERIC(5,2);
ALTER TABLE public.fin_fatura_itens ADD COLUMN IF NOT EXISTS cnae VARCHAR(10);

-- ============================================================
-- 4. Contas bancárias — dados internacionais (SWIFT/IBAN/UK/US) e moeda
-- ============================================================

ALTER TABLE public.fin_contas_bancarias ADD COLUMN IF NOT EXISTS swift_bic VARCHAR(11);
ALTER TABLE public.fin_contas_bancarias ADD COLUMN IF NOT EXISTS iban VARCHAR(34);
ALTER TABLE public.fin_contas_bancarias ADD COLUMN IF NOT EXISTS routing_number VARCHAR(12);
ALTER TABLE public.fin_contas_bancarias ADD COLUMN IF NOT EXISTS sort_code VARCHAR(8);
ALTER TABLE public.fin_contas_bancarias ADD COLUMN IF NOT EXISTS moeda VARCHAR(3) DEFAULT 'BRL';
ALTER TABLE public.fin_contas_bancarias ADD COLUMN IF NOT EXISTS banco_correspondente TEXT;

-- ============================================================
-- 5. Faturas — dados offshore (embarcação e purchase order)
-- ============================================================

ALTER TABLE public.fin_faturas ADD COLUMN IF NOT EXISTS vessel_name VARCHAR(120);
ALTER TABLE public.fin_faturas ADD COLUMN IF NOT EXISTS po_number VARCHAR(60);

-- ============================================================
-- 6. RLS: ENABLED e ZERO policies (padrão do repo; só service_role).
--    Idempotente: ENABLE é no-op quando já habilitado.
-- ============================================================

ALTER TABLE public.payroll_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_fatura_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_faturas ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.payroll_companies.municipio_ibge IS 'Código IBGE (7 dígitos) do município do prestador';
COMMENT ON COLUMN public.fin_clientes.pais IS 'País do tomador (ISO 3166-1 alpha-2); BR = sanitização CPF/CNPJ, demais = tax_id alfanumérico preservado';
COMMENT ON COLUMN public.fin_clientes.tax_id IS 'Tax ID/VAT/Company Reg No do tomador exterior (alfanumérico, nunca sanitizado)';
COMMENT ON COLUMN public.fin_fatura_itens.codigo_lc116 IS 'Código do serviço LC 116/2003 por item; ausente → config.codigo_lc116_padrao da NFS-e';
COMMENT ON COLUMN public.fin_fatura_itens.aliquota_iss IS 'Alíquota ISS (%) por item; ausente → fin_nfse_config.aliquota_iss';
COMMENT ON COLUMN public.fin_contas_bancarias.swift_bic IS 'SWIFT/BIC para recebimento internacional';
COMMENT ON COLUMN public.fin_contas_bancarias.iban IS 'IBAN (Europa/UK) para recebimento internacional';
COMMENT ON COLUMN public.fin_faturas.vessel_name IS 'Embarcação (offshore/maritime) exibida na invoice';
COMMENT ON COLUMN public.fin_faturas.po_number IS 'Purchase Order do cliente exibida na invoice';
