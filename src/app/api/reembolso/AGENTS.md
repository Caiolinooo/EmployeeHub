# Reembolso API — DOX

## Purpose

APIs de criação e atualização de status de reembolso, incluindo o envio de emails conforme configuração admin.

## Ownership

- Rotas: `src/app/api/reembolso/`
- Routing de destinatários: `src/lib/reimbursement-email-routing.ts`
- Templates: `src/lib/emailTemplates.ts` (prefixo `reimbursement*`)
- Envio: `src/lib/notifications.ts`
- Config admin: `/admin/reimbursement-settings` + `src/app/api/reimbursement-settings`

## Local Contracts

### Fluxo de email (três listas independentes)

| Lista | Uso |
|---|---|
| `recipients` | Aprovação inicial — solicitantes `@groupabz.com` |
| `externalRecipients` | Aprovação inicial — outros domínios |
| `financeEmails` | Após aprovação — marcar como pago |

Defaults: Andresa | fiscal | fiscal. Admin pode adicionar/remover emails em cada lista.

### Gate da config

`GET|POST /api/reimbursement-settings` e `/api/reimbursement-settings-fallback` exigem JWT verificado + ADMIN **ou** grant `reimbursement.settings` / `admin.reimbursement_settings.manage` (`withPermissionOrGrant`). GET não é público: só a tela `/admin/reimbursement-settings` consome (via `fetchWithToken`); o envio de e-mail lê `settings` direto no servidor.

### Templates obrigatórios

Usar apenas templates em `emailTemplates.ts` via `baseTemplate`:
- `reimbursementConfirmationTemplate`
- `reimbursementApprovalRequestTemplate`
- `reimbursementApprovalTemplate`
- `reimbursementRejectionTemplate`
- `reimbursementPaymentTemplate`
- `reimbursementFinancePendingTemplate`

## Work Guidance

- Alterar destinatários apenas via `reimbursement-email-routing.ts`
- Não misturar as três listas no código de envio
- Solicitante sempre recebe confirmação na criação; aprovadores recebem template de aprovação com anexos

## Verification

```bash
npx tsx scripts/test-reimbursement-email-routing.ts
npx tsx --test src/app/api/library/upload-auth/upload-auth.test.ts  # settings: sem token / forjado → 401
```

## Child DOX Index

(none)
