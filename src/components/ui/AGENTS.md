# UI base — modal chrome

## Purpose

Fechar overlays no celular sem mudar o desktop.

## Ownership

- `ModalCloseButton.tsx` — X com `data-modal-close` (44×44 via `globals.css` ≤767px e `max-md:h-11`). `mobileOnly` = `md:hidden`. `mountOnlyWhenMobile` = não monta no desktop. Helpers byte-idênticos à #99 `2ac1c878` (`40edf5f85cf574a0a8378d21f8cd6227` / `206d81d43a0748d0c045d6f713908702`; bloco modal `1c95bbef3c8d`).
- `src/hooks/useEscapeToClose.ts` — Esc.
- `globals.css` `@media (max-width: 767px)` — só `[data-modal-close]` e `[data-modal-panel]`. Nenhum desses seletores fora do media.
- `GlobalSearch` no header (`MainLayout`, wrapper `md:hidden`): atalho Ctrl+K e listener `document` só com `matchMedia('(max-width: 767px)')`. Esc/X devolvem foco ao `data-global-search-trigger`.

## Local Contracts

- Desktop 0 px: regras só no media query ou `md:hidden`.
- Acima de md: GlobalSearch não chama `preventDefault` em Ctrl+K e não abre overlay.
- Overlay: toque fora só com o painel aberto.
- Não editar `src/middleware.ts` nem rewrites de `next.config.js`.

## Verification

- `npx tsx --test src/components/GlobalSearch.mobile-chrome.test.ts src/components/globalsearch-mobile-chrome.test.ts`

## Child DOX Index

_(none)_
