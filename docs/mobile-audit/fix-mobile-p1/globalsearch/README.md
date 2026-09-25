# Prova GlobalSearch

Método: `next build` + `next start` locais. BASE = `origin/portal` `71bd3534`. HEAD = esta branch após merge da portal. Compile path absoluto idêntico (`/tmp/geom-compile`). Sessão e APIs só via `page.route`. Sem harness estático.

Prova completa: `desktop-geometry/` (`p1-gs-same-path-table.md`, JSON, prints, heatmaps).

## Desktop — geometria (1280×800 e 1440×900)

GlobalSearch vive no ancestral `md:hidden` do header. Ctrl+K não pinta overlay no desktop (base e HEAD). Header/sidebar/main idênticos.

| viewport | página | boxes | px | nota |
|---|---|---|---:|---|
| 1280×800 | login | iguais | 0 | loginCard 368×360@(456,212) |
| 1280×800 | dashboard | iguais | 0 | header 1200×64, sidebar 80×800, main 1200×736 |
| 1280×800 | globalsearch-ctrlk | iguais | 0 | overlay desktop ausente nos dois lados |
| 1440×900 | login | iguais | 37 | maxChannel 37 = glifo |
| 1440×900 | dashboard | iguais | 0 | header 1360×64, sidebar 80×900, main 1360×836 |
| 1440×900 | globalsearch-ctrlk | iguais | 61 | maxChannel 2 = raster; boxes iguais |

## Mobile (HEAD)

| viewport | X | Esc |
|---|---|---|
| 390×844 | `data-modal-close` 44×44 | painéis 3 → 0 |
| 375×812 | `data-modal-close` 44×44 | painéis 3 → 0 |

Helpers = #99 final: `ModalCloseButton` md5 `5179e1f504553fe62e2c7ec7b360b9c1`, `useEscapeToClose` md5 `206d81d43a0748d0c045d6f713908702`.

Teste: `npx tsx --test src/components/GlobalSearch.mobile-chrome.test.ts`
