-- Migration: Aceite/assinatura do contracheque pelo funcionário (§1 000002 do
-- design dp-folha). Portal do colaborador (/contracheque) registra o aceite
-- com carimbo SHA-256 (padrão src/lib/payroll/aprovacao.ts), IP e user-agent.
-- Padrão do repo (20260922_000001_financeiro_core.sql):
--   idempotente (CREATE/INDEX IF NOT EXISTS, DO blocks condicionais),
--   RLS ENABLED com ZERO policies (leituras/escritas só via service_role /
--   supabaseAdmin), trigger update_updated_at_column idempotente.
-- Executor: node scripts/apply-contracheque-aceites.js  → CONTRACHEQUE_ACEITES_OK

CREATE TABLE IF NOT EXISTS public.payroll_contracheque_aceites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID NOT NULL REFERENCES public.payroll_sheets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.payroll_employees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users_unified(id),          -- usuário do portal que aceitou
  aceito_em TIMESTAMPTZ DEFAULT NOW(),
  assinatura_hash TEXT,                                      -- SHA-256 do payload employee+sheet+timestamp
  ip TEXT,
  user_agent TEXT,
  pdf_path TEXT,                                             -- comprovante arquivado (futuro)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sheet_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_contracheque_aceites_employee
  ON public.payroll_contracheque_aceites(employee_id);

-- ============================================================
-- RLS: ENABLE e ZERO policies (padrão do repo; só service_role acessa)
-- ============================================================

ALTER TABLE public.payroll_contracheque_aceites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Trigger updated_at (idempotente; função já existe no repo)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table = 'payroll_contracheque_aceites'
      AND trigger_name = 'update_payroll_contracheque_aceites_updated_at'
  ) THEN
    CREATE TRIGGER update_payroll_contracheque_aceites_updated_at
      BEFORE UPDATE ON public.payroll_contracheque_aceites
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE public.payroll_contracheque_aceites IS 'Aceite/assinatura do contracheque pelo funcionário (portal /contracheque); carimbo SHA-256 + IP + user-agent; UNIQUE(sheet_id, employee_id)';
