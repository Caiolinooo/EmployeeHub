-- Horas aprovadas do PontoFlow na folha.
-- A rubrica é a mesma do financeiro e do DP: payroll_codes.codigo_timesheet
-- (DIAS, HORAS, HE50, NOTURNO, FALTA), único como codigo_wk.

alter table public.ts_timesheet_resumo
  add column if not exists lines jsonb,
  add column if not exists folha_status text,
  add column if not exists folha_motivo text;

alter table public.payroll_codes
  add column if not exists codigo_timesheet text;

create unique index if not exists uq_payroll_codes_codigo_timesheet
  on public.payroll_codes (codigo_timesheet)
  where codigo_timesheet is not null;
