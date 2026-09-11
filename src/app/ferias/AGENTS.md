# Férias — DOX

## Purpose

Módulo de solicitações de férias (`/ferias`): criação, aprovação por setor, histórico (anos/status passados), exportação XLSX/CSV e download do formulário PDF preenchido.

## Ownership

- UI: `src/app/ferias/page.tsx`
- Admin: `src/app/admin/leave-requests/page.tsx`, `leave-settings`, `leave-approvals`
- APIs: `src/app/api/leave/**`, `src/app/api/admin/leave-*`
- Serviços: `src/services/leaveService.ts`, `leaveNotifications.ts`
- PDF: `src/lib/leavePDFGenerator.ts` + `GET /api/leave/[id]/pdf` (preenchido) + `GET /api/leave/form-pdf` (branco)
- Export: `src/lib/leaveExport.ts`
- IA: `buscar_ferias` / `buscar_ferias_global` em `src/lib/ia/tools.ts` (+ registry `ferias.tools.ts`)
- Assinatura: global `useSignature()` / `SignatureProvider` (`src/contexts/SignatureContext.tsx`) + `GET/POST /api/user/signature` + perfil `SignatureTab`

## Local Contracts

### Viewport

- Página preenche a coluna do `MainLayout` (`flex flex-col min-h-0 flex-1`); filtros/header `shrink-0`; lista/tabela primária em `flex-1 min-h-0 overflow-auto`.

### Histórico

- Listagens **não** filtram só futuro: incluem aprovadas/rejeitadas/canceladas/passadas
- Filtros UI: **status** + **ano** (gozo = `start_date`)
- Minhas solicitações: default “Todos os status” + “Todos os anos”
- Aprovadores: aba **Histórico da equipe** (`?history=1` em leave-approvals)
- Admin: `GET /api/admin/leave-requests` com `status`, `year`, `limit` (default 500)

### Extração / formulários

- Export XLSX/CSV do conjunto filtrado (colaborador, datas, status, períodos, abono, 13º, observações, datas criação/atualização)
- **Detalhes** → prévia do formulário preenchido + botão **Baixar PDF** → `GET /api/leave/[id]/pdf` (mesmo gerador ABZ, dados reais + líder/gerente do setor)
- Histórico antigo também gera PDF preenchido (mesmo endpoint)
- Formulário em branco: `GET /api/leave/form-pdf`
- Preenchimento PDF: CPF ← `users_unified.tax_id` (**nunca** coluna `cpf` — não existe e quebra o select PostgREST); cargo ← `position`; setor ← `sectors.name` (fallback `department`); nome ← `name` ou `first_name`+`last_name`; duração recalculada se `periods[].duration` ausente; líder/gerente ← `leave_sector_configs` (lookup por id, sem FK nomeada obrigatória); **não** há colunas `leader_approved_at`/`manager_approved_at` em `leave_requests` (datas de aprovação ficam “—” até existir audit trail)
- Sync `gt_afastamentos` ao aprovar férias (`leaveService.updateLeaveRequestStatus`): join `users_unified(id, first_name, last_name, email, tax_id)`; match colaborador por dígitos de `tax_id` (nunca coluna `cpf`)
- Assinaturas no PDF preenchido: carimba `users_unified.signature_url` (bucket `user-signatures/{userId}.png`) do colaborador + líder/gerente quando resolvidos; fetch null-safe; sem URL/`PASSKEY_SIGNED`/falha → caption **“Assinatura não cadastrada”**; formulário em branco (`form-pdf`) mantém linhas vazias
- Download: cliente envia `Authorization: Bearer` (mesmo padrão das demais APIs leave); toast por status; body PDF como `Uint8Array`

### Soft prompt de assinatura

- Se `!hasSignature` (via `useSignature`), `/ferias` mostra banner dismissível + soft-gate em **Nova Solicitação** e **Baixar PDF**
- CTA **Cadastrar assinatura** chama `requestSignature({ title, description })` — reutiliza o `SignatureModal` global do `SignatureProvider` (não montar segundo modal)
- “Continuar sem assinatura” / “Agora não” grava `sessionStorage` key `ferias_signature_prompt_dismissed` — não bloqueia o módulo pelo resto da sessão
- Cadastro também em `/profile` aba Assinatura (`SignatureTab` → `POST /api/user/signature`)

### RBAC

- USER: próprias solicitações
- Líder/gerente de setor: fila + histórico do(s) setor(es)
- ADMIN / ACL `ferias:admin|manage|read`: todas; PDF para owner, approver do setor, admin/ACL

### IA Companion

- `buscar_ferias`: default = usuário logado; `ano`, `status`, `incluir_historico` (default true), `limite`
- `buscar_ferias_global`: mesmos filtros + RBAC equipe/global; status DB reais (`PENDING_*` / `APPROVED` / …)

## Work Guidance

- Não inventar segundo UX de formulário: reutilizar `leavePDFGenerator` + Detalhes
- Não inventar segundo modal de assinatura: sempre `useSignature().requestSignature`
- Status DB: `PENDING_LEADER` | `PENDING_MANAGER` | `APPROVED` | `REJECTED` | `CANCELLED`
- Antecedência: `leaveConfig` / `/api/leave/config`

## Verification

- `/ferias` sem assinatura → banner + soft-gate em Nova Solicitação / Baixar PDF; CTA abre SignatureModal global; dismiss em sessionStorage libera o fluxo
- `/ferias` → filtrar ano passado → vê aprovadas/gozadas
- Detalhes (Todas as Solicitações) → prévia + Baixar PDF com nome/datas/status
- PDF preenchido: assinatura cadastrada carimbada (ou “Assinatura não cadastrada”); blank `form-pdf` sem carimbo
- Export XLSX/CSV com filtro aplicado
- Companion: “férias do ano passado” → `buscar_ferias` com `ano`

## Child DOX Index

_(none)_
