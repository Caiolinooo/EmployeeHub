# e-Social UI — DOX

## Purpose

UI de `/department/e-social` para painel, eventos, revisão, certificados e config. Lê APIs e-Social; cadastro operacional continua em `gt_*`.

## Ownership

- Page/layout: `src/app/department/e-social/`
- List UI: `src/components/e-social/EventosList.tsx`
- Viewport shell: `src/components/gestao-tripulantes/GtPageShell.tsx` (família GT)

## Local Contracts

- Sempre wrap com `MainLayout` (`layout.tsx`).
- Auth/fetch: `fetchWithToken`. Não trocar por fetch anônimo.
- Viewport: `GtPageShell` preenche o `<main>` (`flex-1 min-h-0 min-w-0`). Nav/filtros `shrink-0`. Lista `flex-1 min-h-0 min-w-0 overflow-auto`. Sem `p-6` extra em cima do padding do MainLayout.

## Work Guidance

- Header + `ESocialNavigation` + filtros ficam visíveis; a tabela/lista de eventos rola no espaço restante.
- Não voltar ao modelo documento-rola-tudo (`flex-1 p-6` + `space-y-6` sem `min-h-0`).
- Schema `nmMed` / `TS_nome`: **Validar Auto-Correção** ou **Enviar ao e-Social** (modal e lista, status `erro`) sanitiza nome OCR e rebuilda XML. Contrato em `src/lib/e-social/AGENTS.md`.

## Verification

- `/department/e-social` e `/department/e-social/eventos`: documento não é o scroll principal; filtros visíveis; lista rola no pane restante (`[data-testid=gt-page-shell]`).
- S-2220 rejeitado por `nmMed` / Pattern: Validar Auto-Correção deixa `<nmMed>` só com o nome (sem cargo/quebra de linha); Enviar retransmite.

## Child DOX Index

_(none)_
