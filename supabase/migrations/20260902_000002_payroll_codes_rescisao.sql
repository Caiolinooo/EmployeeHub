-- Rubricas de rescisão ausentes no seed original (301 Aviso Prévio, 302 Multa 40% FGTS).
-- Fail-soft: payroll_codes só existe em ambientes que rodaram scripts/create-payroll-tables.sql.
-- ON CONFLICT (code, type) — mesma unique do seed.

DO $$
BEGIN
  IF to_regclass('public.payroll_codes') IS NULL THEN
    RAISE NOTICE 'payroll_codes ausente — skip rubricas de rescisão';
    RETURN;
  END IF;

  INSERT INTO payroll_codes (code, type, name, description, calculation_type, legal_type, is_system, is_active)
  VALUES
    ('303', 'provento', 'Saldo de Salário', 'Saldo de salário dos dias trabalhados no mês da rescisão', 'fixed', null, false, true),
    ('304', 'provento', '13º Salário Proporcional', 'Décimo terceiro proporcional na rescisão', 'fixed', null, false, true),
    ('305', 'provento', 'Férias Proporcionais + 1/3', 'Férias proporcionais acrescidas do terço constitucional', 'fixed', null, false, true),
    ('306', 'provento', 'Férias Vencidas + 1/3', 'Férias vencidas acrescidas do terço constitucional', 'fixed', null, false, true),
    ('307', 'outros', 'Multa 20% FGTS', 'Multa rescisória do FGTS no acordo mútuo (art. 484-A CLT)', 'percentage', null, false, true)
  ON CONFLICT (code, type) DO NOTHING;
END $$;
