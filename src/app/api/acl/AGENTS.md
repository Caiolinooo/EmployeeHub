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

- Grant ACL no UserEditor persiste em `user_acl_permissions`. O alvo lê os nomes em `GET /api/user/effective-permissions` (`acl_permission_names` + `effective_features`). `hasFeature` não depende só do JSONB.

## Verification

- `POST /api/acl/init` cria `epi.*`, `kpi.*`, `dp.*`, `reimbursement.*`, `admin.*` se ausentes
- `GET /api/acl/init` continua a listar `gestao-tripulantes.documents.edit` e `e-social.view`
- USER com ACL `gestao-tripulantes.documents.delete` e `access_permissions.features` nulo: `effective_features` inclui a key; UI mostra excluir

## Child DOX Index

_(none)_
