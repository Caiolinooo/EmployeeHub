# Catálogo vivo de módulos e permissões — DOX

## Purpose

Fonte única de módulos do portal + superfícies de permissão (flag de módulo, features JSONB, ACL).

## Ownership

- Registry: `src/config/modules.ts` (`SYSTEM_MODULES`, `EXTRA_ACL_RESOURCES`)
- Sidebar adapter: `src/constants/modules.ts` (reexporta o mesmo registry)
- APIs: `GET /api/admin/available-modules`, `GET /api/admin/permission-catalog`, `POST /api/acl/init`
- UI: UserEditor “Módulos do Sistema”, `CatalogFeatureToggles`, ACL tree, RolePermissionsEditor

## Local Contracts

- Novo módulo: adicionar **um** item em `SYSTEM_MODULES` (key, href, defaultRoles, `features`, `acl`). Sidebar, checkboxes e seed ACL passam a entender sem segunda lista morta.
- `src/constants/modules.ts` não duplica dados — só adapta `id`/`label`/`href`/`visible`.
- Cards extras na tabela `cards` entram em available-modules / permission-catalog como módulo sem features/ACL até alguém registrá-los no catálogo.
- ACL seed é insert-if-missing (`POST /api/acl/init`). Não apaga linhas existentes (GT / e-social / academy / social).
- Módulo `financeiro` (2026-09, design financeiro §8): key `financeiro`, href `/folha-pagamento` (hub com abas), category `business`, ACL granular `financeiro.view|edit|admin` (nível 1/2/3, STAFF/STAFF/ADMIN). Gates das rotas `/api/financeiro/**` usam esses nomes via `garantirNivelFinanceiro`.
- `users_unified` não tem coluna `cpf`. Identidade de portal é `tax_id` + e-mail.

## Work Guidance

Ao criar módulo novo:

1. Entrada em `SYSTEM_MODULES` com `features` (UserEditor) e `acl` (resource/actions + `defaultRoles`)
2. Se o resource ACL ≠ key (ex. noticias → `news`), setar `aclResource`
3. Rodar `npx tsx --test src/config/modules.test.ts`
4. Em preview, `POST /api/acl/init` para semear permissões novas

## Verification

- `npx tsx --test src/config/modules.test.ts`
- `/admin/users` Módulos do Sistema inclui `gestao-tripulantes`, `e-social`, `dp`, `epi`, `ferias`, `kpi`
- Features do catálogo aparecem no UserEditor mesmo com o módulo desmarcado; ligar a feature liga o módulo
- `hasFeature` / `GET /api/user/effective-permissions` tratam nome ACL = feature key (JSONB nulo não esconde o grant)
- `npx tsx --test src/lib/effective-feature.test.ts` — USER + ACL `gestao-tripulantes.documents.delete` sem JSONB = canDelete
- `GET /api/acl/init` lista resources do catálogo; GT `documents.edit` / e-social `view` permanecem

## Child DOX Index

_(none)_
