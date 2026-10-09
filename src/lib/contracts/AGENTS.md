# Contratos (assinatura de envelopes) — DOX

## Purpose

Escopo de visualização e gate de ações dos contratos (`/contratos`, `/api/contracts/**`).

## Ownership

- `view-scope.ts` — regra pura `resolveContractViewScope` (`all` | `own` | `none`), helpers `grantedByUser`/`explicitlyOff`/`hasManageUmbrella`
- `action-gate.ts` — regra pura `canContractAction` / `buildContractAccess` (tabela `ACTION_DEFAULT`: `manage` | `open`)
- `view-access.ts` — servidor: `loadContractAccess(user)` (uma leitura de `loadEffectivePermissions`: JSONB + ACL + módulo efetivo), `denyUnlessCan`, `canMutateEnvelope`, `getOwnEnvelopeIds`, `isOwnSolicitacao`
- `signature-queue.ts` — item da fila é campo, não PDF. `uniqueSignatureDocuments` / `file_count` = PDFs distintos (cópia fora). `isFieldRequired` (default true) e `missingRequiredFieldValue` (texto vazio ou checkbox ≠ `true`)
- `signed-file.ts` — path no bucket e última auditoria **deste** `documento_id` (não a de outro arquivo do envelope)
- Tabelas: `envelopes`, `documentos_trabalhistas`, `solicitacoes_assinatura` (status enum `PENDING|SIGNED|REJECTED`), `auditoria_assinaturas`, `contrato_templates*`, view `vw_envelopes_completo`. Envelope: `DRAFT|SENT|COMPLETED|DELETED`
- Vínculo "próprio contrato": `solicitacoes_assinatura.colaborador_id = users_unified.id` **ou** `external_signer_email` = e-mail do usuário (assinante ou cópia)

## Local Contracts

- Módulo = `contratos` (alias legado `contracts`). Rotas nunca usam `checkPermissions('contracts_manager')` (só JSONB, cego a ACL) nem `checkAclPermission` (pool pg); só `loadContractAccess`.
- Escopo: ADMIN/MANAGER/SUPERADMIN → `all`. Módulo `contratos` desligado no sidebar/efetivo → `none` (403). `view_all: false` explícito → `own`. `view_all` (JSONB/ACL) → `all`. `view_own` → `own` (mesmo com manage). Nenhum: legado (`contracts.manage` JSONB ou ACL `contratos.manage` → `all`, senão `own`).
- Ações (`contratos.<ação>`, mesmo nome JSONB e ACL): `create edit delete dispatch send cancel resend download download_signed sign templates.view templates.manage templates.use signers.manage audit.view export`. Ordem: role bypass → módulo off (nega, exceto `sign`) → `false` explícito nega → grant próprio (JSONB/ACL) → `open` (`download`, `download_signed`, `sign`) libera → `contracts.manage`/ACL `contratos.manage` libera as de gestão.
- Rotas: `GET /api/contracts` (escopo; devolve `scope` e `can`; `arquivo_url` só com `download`/`download_signed`; `token_acesso` só com `signers.manage`), `DELETE /api/contracts` (`delete`), `POST envelope` e `upload` (`create`), `POST [id]/assign` (`signers.manage`), `DELETE [id]/assign` (`cancel` ou `signers.manage`), `POST [id]/dispatch` (DRAFT `dispatch`, SENT `resend`, COMPLETED 409), `POST send-email` (`send` ou `resend`), `GET templates` (qualquer `templates.*`), `POST|DELETE templates` (`templates.manage`), `POST templates/use` (`templates.use`), `POST sign` (`sign` só nega com `false` explícito; externo exige `signer_data`), `POST sign-access` (JWT; escopo `all` + `download` direto, senão só atribuição própria). Acesso público é só `sign-access/[token]`.
- Mutação em envelope exige escopo `all` ou ser o remetente (`canMutateEnvelope`). Escopo `view_own` explícito restringe também as mutações.
- `audit.view` e `export` existem no catálogo sem rota ainda (reservados).
- Link de assinatura externo é sempre `/assinatura/[token]` (dispatcher e `send-email`). A página legada `/contratos/[id]/assinar` foi removida.
- Posição dos campos: envelope persiste em `PATCH /api/contracts/[id]/assign`. Template fica no cliente até Salvar. Painéis flutuantes usam `DraggableFloatingPanel`.
- `obrigatorio` (default true) em `solicitacoes_assinatura` e `contrato_template_campos`. `POST /api/contracts/sign` recusa obrigatório vazio; opcional não bloqueia.
- `GET /api/contracts/sign-access/[token]` devolve `documentos` e `file_count` (PDFs distintos, cópias fora). `/assinatura/[token]` uma aba por arquivo e `key={documento.id}`. Nunca `queue.length` como total de arquivos.
- Refresh da lista e do envelope (`GET /api/contracts`) mantém o dado atual; spinner só no ícone.
- Rotas usam `supabaseAdmin` (service role). RLS das tabelas de contrato é só `service_role` (`20261008_000002_contratos_rls_hardening.sql`); o gate é a API.

## Verification

- `npx tsx --test src/lib/contracts/*.test.ts src/config/modules.test.ts src/lib/effective-feature.test.ts`

## Child DOX Index

_(none)_
