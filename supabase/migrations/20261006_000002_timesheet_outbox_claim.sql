-- Integração Time-Sheet (PontoFlow): claim da outbox com SKIP LOCKED.
-- Depende de public.ts_integration_outbox (migration 20261006_000001_timesheet_integration.sql).
-- Semântica: claim atômico de até p_limit jobs devidos (dead_at IS NULL,
-- next_attempt_at <= now()), incrementando attempts e escondendo o lote por
-- 5 minutos (visibility timeout). O worker então remove (sucesso), reagenda
-- com backoff 2^n (falha) ou marca dead_at (attempts >= 8). Idempotente.

create or replace function public.ts_claim_outbox(p_limit int default 25)
returns setof public.ts_integration_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update ts_integration_outbox o
     set attempts = o.attempts + 1,
         next_attempt_at = now() + interval '5 minutes'
   where o.id in (
     select id
       from ts_integration_outbox
      where dead_at is null
        and next_attempt_at <= now()
      order by next_attempt_at
      limit greatest(p_limit, 1)
      for update skip locked
   )
  returning o.*;
end;
$$;

revoke all on function public.ts_claim_outbox(int) from public;
revoke all on function public.ts_claim_outbox(int) from anon;
revoke all on function public.ts_claim_outbox(int) from authenticated;
grant execute on function public.ts_claim_outbox(int) to service_role;
