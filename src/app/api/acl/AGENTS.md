# ACL API — DOX

## Purpose

Seed e listagem de `acl_permissions` / `role_acl_permissions`.

## Ownership

- `POST|GET /api/acl/init` — seed a partir de `src/config/modules.ts` (`getAclSeedPermissions` / `getAclRoleGrants`)
- `GET|POST /api/acl/permissions` — lista (labels via `getAclResourceLabel`)
- UI: `ACLPermissionTreeSelector`, `ACLInitializer`

## Local Contracts

- Seed só insere o que falta. Nunca dropar GT / e-social / academy / social já persistidos.
- Resources e actions novas vêm do catálogo vivo, não de array morto nesta rota.
- `GET` e `POST /api/acl/init` exigem JWT ADMIN (`requirePermission(..., 'admin')`). Sem token → 401.

- `user_acl_permissions.granted`: `true` = grant individual, `false` = revogação individual (vence papel e setor). Migration `supabase/migrations/20261008_000009_user_acl_permissions_granted.sql` (também restringe escrita das 3 tabelas ACL a service_role).
- `GET|POST|DELETE /api/acl/users/[userId]/permissions`: JWT verificado (`requireAuth`). GET = o próprio usuário ou ADMIN (news usa para o próprio usuário); POST (`granted` opcional, padrão `true`) e DELETE só ADMIN. DELETE remove a linha (grant ou revogação) e volta ao default do papel.
- UserEditor / `ACLPermissionTreeSelector`: desmarcar permissão que vem do papel grava `granted=false` (badge "Revogado"); remarcar apaga a revogação. `useACLPermissions` usa `fetchWithToken` e dispara `permissions-updated`.
- `checkAclPermission` (`src/lib/auth.ts`) e `/api/acl/check` respeitam a revogação.
- `GET /api/user/effective-permissions` é wrapper de `loadEffectivePermissions`. ACL habilita módulo via `resolveModuleKey(resource)` (nunca o resource cru). ACL do papel USER não abre módulo do catálogo para USER com setor (setor estrito); precedência completa em `src/config/AGENTS.md`.
- Depois de mudar o catálogo (ex. `gestao-tripulantes.cadastro.manage`) rodar `POST /api/acl/init` como ADMIN; sem o seed o nome não aparece no UserEditor/ACL tree e MANAGER/ADMIN só passam por bypass de papel.

- Depois de mudar `src/config/module-grants.ts` (centenas de ACLs novas `<modulo>.<acao>`), rodar `POST /api/acl/init` como ADMIN. Até o seed, o gate de rota só soma grants que já existam; ADMIN/MANAGER continuam passando por papel.

## Verification

- `POST /api/acl/init` cria `epi.*`, `kpi.*`, `dp.*`, `reimbursement.*`, `admin.*` se ausentes
- `GET /api/acl/init` continua a listar `gestao-tripulantes.documents.edit` e `e-social.view`
- USER com ACL `gestao-tripulantes.documents.delete` e `access_permissions.features` nulo: `effective_features` inclui a key; UI mostra excluir
- `npx tsx --test src/lib/effective-feature.test.ts` — revogação vence papel/setor/grant; setor estrito bloqueia ACL do papel USER

## Child DOX Index

_(none)_
