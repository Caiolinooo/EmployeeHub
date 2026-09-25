# Geometria desktop — rodada QA #95

Servidores: `next build` + `next start` locais. Sem preview Vercel.

| par | base | HEAD | porta base | porta HEAD |
|---|---|---|---|---|
| portal-vs-head | `origin/portal` `71bd3534` | working tree desta rodada | :3020 | :3041 |
| mid-vs-head | `3b062c1d` (merge #97) | working tree desta rodada | :3042 | :3041 |

Viewports: 1024×768, 1280×800, 1440×900. Modais abertos: Confirmation (`/admin/setores` → Excluir) e LanguageDialog.

## Critério

Geometria = `getBoundingClientRect` iguais. Pixel restante = glifo / raster (Companion, ícones, AA de fonte). Prova: `mid-vs-head` boxes 100% iguais e px 0 em várias páginas; login sobra ~37 px `maxChannel` 37 (AA).

## portal-vs-head

- Confirmation e Language: boxes iguais nos 3 viewports. Sem `modalClose` no Confirmation (portal não tem X; HEAD usa `mountOnlyWhenMobile`).
- Shell, sidebar, toolbar da escala, férias, reembolso, login: boxes iguais.
- `ficha` `tablist` / `fichaTablist` / `modalClose`: já em `3b062c1d` (#97). `mid-vs-head` ficha = boxes iguais.
- px 688–1653: silhueta Companion/ícone + path de compile (mesmo método da #99).

## mid-vs-head (delta desta rodada)

Todas as páginas, todos os viewports: boxes iguais. Exit 0. px residual ≤61 (login 38).

## Mobile

`docs/mobile-audit/fase2/desktop-geometry/fase2-round-verify.json`:

- Confirmation X 44×44 em 390 e 375; ausente em 1280 (nó não monta).
- `?tab=schedule` monta `[data-testid=man-schedule-scroll]`.
- `/m/login` 200; desktop em `/m/login` 307 (não 308).
- `?ui=desktop` + UA iPhone: 200, `Set-Cookie: ui=desktop`, sem `x-abz-ui=mobile`.
