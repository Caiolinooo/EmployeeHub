-- Natureza da rubrica: mensal | ferias | decimo | rescisao. Tributa por grupo.
ALTER TABLE public.payroll_codes
  ADD COLUMN IF NOT EXISTS natureza VARCHAR(20) NOT NULL DEFAULT 'mensal';

ALTER TABLE public.payroll_codes
  DROP CONSTRAINT IF EXISTS payroll_codes_natureza_check;
ALTER TABLE public.payroll_codes
  ADD CONSTRAINT payroll_codes_natureza_check
  CHECK (natureza IN ('mensal', 'ferias', 'decimo', 'rescisao'));

UPDATE public.payroll_codes SET natureza = 'ferias' WHERE code IN ('005', '006') AND natureza = 'mensal';
UPDATE public.payroll_codes SET natureza = 'decimo' WHERE code = '007' AND natureza = 'mensal';
UPDATE public.payroll_codes SET natureza = 'rescisao' WHERE code IN ('301','302','303','304','305','306','307') AND natureza = 'mensal';

COMMENT ON COLUMN public.payroll_codes.natureza IS 'Competência da rubrica: mensal|ferias|decimo|rescisao';
