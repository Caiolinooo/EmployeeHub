-- Migration: Integração Time-Sheet (PontoFlow) × Portal ABZ — design §7.2.
-- Flag "Contabilizar no Time Sheet" em gt_colaboradores + outbox de sync +
-- config de tenant por empresa + mapa de pessoas + dedup de webhooks + resumo.
-- Idempotente (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- RLS: tabelas ts_* ficam service-role only (mesmo padrão de gt_historico_embarques:
-- RLS ligado, zero policies anon — acesso só via supabaseAdmin).

alter table public.gt_colaboradores
  add column if not exists contabilizar_timesheet boolean not null default false,
  add column if not exists timesheet_sync_status text not null default 'none',
  add column if not exists timesheet_sync_error text,
  add column if not exists timesheet_synced_at timestamptz;

-- CHECK idempotente: ADD CONSTRAINT não tem IF NOT EXISTS no Postgres.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gt_colaboradores_timesheet_sync_status_check'
      and conrelid = 'public.gt_colaboradores'::regclass
  ) then
    alter table public.gt_colaboradores
      add constraint gt_colaboradores_timesheet_sync_status_check
      check (timesheet_sync_status in ('none','pending','active','inactive','error'));
  end if;
end $$;

create table if not exists public.ts_integration_outbox (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.gt_colaboradores(id) on delete cascade,
  desired text not null check (desired in ('active','inactive')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  dead_at timestamptz,
  created_at timestamptz not null default now()
);

-- Coalesce: no máximo 1 job vivo (não-dead) por colaborador; último desired vence.
create unique index if not exists ts_outbox_one_pending
  on public.ts_integration_outbox (colaborador_id) where dead_at is null;

create index if not exists ts_outbox_pending_idx
  on public.ts_integration_outbox (next_attempt_at) where dead_at is null;

create table if not exists public.ts_empresa_config (          -- 1 tenant TS por empresa
  empresa_id uuid primary key,
  ts_tenant_slug text not null,   -- credenciais em app_secrets: timesheet.<empresa_id>.{base_url,api_key,webhook_secret}
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ts_people_map (
  colaborador_id uuid primary key references public.gt_colaboradores(id) on delete cascade,
  empresa_id uuid not null,
  ts_employee_id uuid not null,
  last_payload_hash text,
  synced_at timestamptz not null default now()
);

create table if not exists public.ts_webhook_events_seen (
  event_id uuid primary key,
  received_at timestamptz not null default now()
);

create table if not exists public.ts_timesheet_resumo (
  colaborador_id uuid not null references public.gt_colaboradores(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  ts_timesheet_id uuid not null,
  status text not null,
  worked_days int,
  worked_minutes int,
  updated_at timestamptz not null default now(),
  primary key (colaborador_id, period_start, period_end)
);

-- RLS service-role only (padrão do portal): ligado, sem policies anon/authenticated.
alter table public.ts_integration_outbox enable row level security;
alter table public.ts_empresa_config enable row level security;
alter table public.ts_people_map enable row level security;
alter table public.ts_webhook_events_seen enable row level security;
alter table public.ts_timesheet_resumo enable row level security;
