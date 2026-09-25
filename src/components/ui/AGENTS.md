# UI base — modal chrome

## Purpose

Fechar overlays no celular sem mudar o desktop em 1440×900.

## Ownership

- `ModalCloseButton.tsx` — X com `data-modal-close` (44×44 via `globals.css` ≤767px). `mobileOnly` = `md:hidden`.
- `src/hooks/useEscapeToClose.ts` — Esc.
- `globals.css` `@media (max-width: 767px)` — `[data-modal-close]` e `[data-modal-panel]`.

## Local Contracts

- Desktop 0 px: regras só no media query ou `md:hidden`.
- Overlay: toque fora só se já era o padrão (não em form sujo).
- Sem X no desktop e no celular: `LanguageDialog`, `ConfirmationModal`, `ThankYouModal`, `DeleteCourseModal`, `LanguageSelector` (variant modal) — X só `md:hidden`.
- `SetPasswordModal` sem X de propósito (senha obrigatória). Só `data-modal-panel`.
- Não editar `src/middleware.ts` nem rewrites de `next.config.js`.

## Verification

- `npx tsx --test src/components/ui/modal-chrome.test.ts`
- `node scripts/mobile-ui-proof.mjs` — prints 390/375 em `docs/mobile-audit/fix-mobile-ui/`
- `node scripts/mobile-modal-inventory.mjs` — tabela em `docs/mobile-audit/fix-mobile-ui/modals.md`

## Child DOX Index

_(none)_
