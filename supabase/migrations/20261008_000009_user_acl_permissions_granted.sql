-- Revogação individual de ACL: `granted = false` nega a permissão para o usuário mesmo
-- quando ela vem do papel (role_acl_permissions) ou do setor. Linhas existentes = grant.
-- Escrita nas tabelas ACL fica só com service_role (rotas /api/acl/** como ADMIN).
--
-- Reverter:
--   alter table public.user_acl_permissions drop column if exists granted;
--   create policy authenticated_all_<tabela> on public.<tabela> for all to authenticated using (true) with check (true);

alter table public.user_acl_permissions
  add column if not exists granted boolean not null default true;

comment on column public.user_acl_permissions.granted is
  'true = grant individual; false = revogação individual (vence papel e setor).';

do $$
declare
  t text;
begin
  foreach t in array array['acl_permissions', 'role_acl_permissions', 'user_acl_permissions'] loop
    execute format('drop policy if exists %I on public.%I', 'authenticated_all_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'authenticated_select_' || t, t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      'authenticated_select_' || t,
      t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
