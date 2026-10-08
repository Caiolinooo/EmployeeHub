-- Prova de que a batida do portal passou por WebAuthn com verificação do usuário.
-- Não guarda template biométrico, clientDataJSON nem assinatura.
-- A batida em si continua no PontoFlow. RLS ligado, sem policy anon (service_role).

create table if not exists public.ts_punch_biometric (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  colaborador_id uuid not null references public.gt_colaboradores(id) on delete cascade,
  entry_id text not null,
  kind text not null check (kind in ('in', 'out')),
  work_date date not null,
  method text not null check (method = 'webauthn'),
  credential_id text not null,
  user_verified boolean not null,
  device_type text check (device_type in ('singleDevice', 'multiDevice')),
  origin text,
  created_at timestamptz not null default now()
);

create index if not exists ts_punch_biometric_colaborador_date_idx
  on public.ts_punch_biometric (colaborador_id, work_date);

alter table public.ts_punch_biometric enable row level security;
