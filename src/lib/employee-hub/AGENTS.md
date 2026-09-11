# Employee Hub — DOX

## Purpose

Ponto único de leitura do colaborador no portal: `gt_*` + usuário (`users_unified`) + férias + reembolsos + e-Social.

## Ownership

- `src/lib/employee-hub/employee-hub-service.ts`
- `src/lib/employee-hub/portal-user.ts` / `portal-user-match.ts`
- `src/app/api/employee-hub/`
- Ficha card: `src/components/gestao-tripulantes/tabs/FichaUnificadaTab.tsx` (vínculo do portal; sem chrome do modal)

## Local Contracts

- Join colaborador: `gt_colaboradores.id`.
- Join portal (`resolvePortalUser`): `user_id` → `users_unified.tax_id` dígitos = CPF do colaborador → e-mail lowercase exact → nome+CPF se único. Select `first_name, last_name, email, tax_id, role` — **nunca** `cpf` / `full_name` / `phone` (não existem em `users_unified`; o PostgREST quebra e a ficha cai em "sem vínculo").
- **Corroboração de identidade** (`hasSecondIdentityFactor` / `shouldAcceptPrimaryMatch`): match isolado por `tax_id` ou e-mail **não** entra em `moduleUserIds` nem dispara backfill. Segunda evidência obrigatória: `namesCorroborate` (nome do colaborador ou do `user_id` confirmado vs `portalDisplayName` — exact ou first+last contido no nome maior) **ou** o outro identificador (e-mail cruzado com CPF, ou e-mail/`tax_id` compartilhado com o usuário confirmado). Sem isso, o hit solto é ignorado (log `skip uncorroborated`). Dois cadastros da mesma pessoa (ex. Aislan gmail+corp) continuam mesclados quando o nome corrobora.
- Backfill `gt_colaboradores.user_id` só se estiver null, o match for único **e** corroborado; nunca sobrescreve outro `user_id`. E-mail único sem nome/`tax_id` em comum **não** é backfill seguro.
- Férias (`leave_requests`) e reembolsos (`Reimbursement`, não `reembolsos`) usam os `user_id` resolvidos; reembolso também tenta CPF da própria tabela.
- Documentos: validade civil + papel vigente/histórico (`validade-civil.ts` / `documentos-alertas.ts`).
- Módulos externos (`leave_requests`, `Reimbursement`) são fail-soft: tabela ausente ou erro → lista vazia.
- GET `/api/employee-hub/[id]` devolve o record plano (não `{ data }`). `colaborador.status_embarque` é o status vivo da célula de hoje (`overlayStatusEscalaHoje` / `embarque-status.ts`), com `escala_codigo_hoje`. Search overlay the same.
- UI: aba **Ficha unificada** no `CollaboratorModal`. Card **Usuário do portal** mostra nome + e-mail + role; sem match → "sem vínculo".

## Work Guidance

- Novos módulos com vínculo de colaborador entram aqui; não criar segundo hub.
- Desligamento auditável fica em `gt_desligamentos` (modal GT/DP). A ficha já lê `gt_colaboradores.ativo` / `data_demissao`; não duplicar o processo no hub.

## Verification

- `npx tsx --test src/lib/employee-hub/portal-user.test.ts` — Aislan (gmail+corp) permanece em `moduleUserIds`; e-mail/CPF coincidente sem nome **não** entra nem autoriza backfill.
- `npx tsx scripts/verify-docs-alertas.ts` → `DOCS_ALERTAS_VERIFY_OK`
- Abrir perfil com KPI > 0 cai na ficha e lista o documento vigente vencido.
- Ficha do Aislan (CPF `13984165765`) mostra usuário vinculado (não "sem vínculo").

## Child DOX Index

_(none)_
