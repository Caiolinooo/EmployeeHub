-- Migration: UNIQUE parcial (company_id, cpf) em payroll_employees (design §1, 000003)
-- DevMerge — reforma Folha/DP/Vínculo.
--
-- PRÉ-REQUISITO OBRIGATÓRIO: rodar o dedupe ANTES de aplicar esta migration:
--   npx tsx scripts/dedupe-payroll-employees.ts          # dry-run (lista)
--   npx tsx scripts/dedupe-payroll-employees.ts --apply  # consolida duplicados
-- O CREATE UNIQUE INDEX falha enquanto houver (company_id, cpf) duplicado.
--
-- Idempotente (IF NOT EXISTS). Índice parcial: CPF ausente/vazio não participa
-- (fichas legadas sem CPF continuam possíveis, mas nunca duplicam um CPF real).

CREATE UNIQUE INDEX IF NOT EXISTS payroll_employees_company_cpf_key
  ON public.payroll_employees (company_id, cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';
