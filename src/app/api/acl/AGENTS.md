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

## Verification

- `POST /api/acl/init` cria `epi.*`, `kpi.*`, `dp.*`, `reimbursement.*`, `admin.*` se ausentes
- `GET /api/acl/init` continua a listar `gestao-tripulantes.documents.edit` e `e-social.view`

## Child DOX Index

_(none)_
