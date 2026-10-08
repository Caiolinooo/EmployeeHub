-- Setor estrito (USER com setor) passa a ver só `sectors.allowed_modules`; o ACL padrão de USER
-- (`chat.view`) deixa de abrir o chat. Estes setores tinham USERs usando o chat só por esse
-- vazamento: o chat entra explicitamente no setor para preservar o uso diário.
--
-- Reverter:
--   update public.sectors set allowed_modules = array_remove(allowed_modules, 'chat')
--   where name in ('Departamento Pessoal', 'Engenharia', 'Logística');

update public.sectors
set allowed_modules = array_append(coalesce(allowed_modules, '{}'::text[]), 'chat'),
    updated_at = now()
where name in ('Departamento Pessoal', 'Engenharia', 'Logística')
  and not ('chat' = any(coalesce(allowed_modules, '{}'::text[])));
