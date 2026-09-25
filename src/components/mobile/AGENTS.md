# Front mobile — kit e shell

## Purpose

UI só do front mobile. Desktop não importa estes arquivos.

## Ownership

- `TouchButton.tsx` — alvo 44 px (Radix Slot)
- `BottomSheet.tsx` — sheet sem lib nova
- `DataCard.tsx` — listas de pessoas/pedidos
- `MobileShell.tsx` — nav híbrida Home/Notícias/Férias/Mais
- `MobileCompanion.tsx` — um FAB + sheet full-width
- `MobileLoginForm.tsx` — login P0 (mesmos hooks de auth)
- `UiSurfaceSwitch.tsx` — “Voltar para o mobile”. **Não** montar em layout desktop (`/login/layout` reordena CSS). P0: só no front mobile + `/api/ui-surface`
- `mobile-styles.ts` — tokens `--touch-min: 44px` injetados no layout `(mobile)` via `<style>` (não import global de CSS)

## Local Contracts

- Sem mudança visual no desktop.
- Nav Mais lista `SYSTEM_MODULES` (`visible !== false`).
- Companion mobile não monta o FAB desktop (`data-abz-ui=mobile`).
- `/m/preview` é QA (sheet via `?sheet=mais|companion`).

## Work Guidance

Novo módulo: página em `src/app/(mobile)/m/<rota>` + allowlist em `device-surface.ts`.

## Verification

- Login mobile: texto “Entrar” + `data-abz-mobile-login`.
- Preview: nav + sheets Mais/Companion.
- Alvos ≥ 44 px (`.touch-target`).

## Child DOX Index

_(none)_
