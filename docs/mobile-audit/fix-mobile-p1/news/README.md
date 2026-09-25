# Prova NewsPostEditorFullScreen

Método: `next build` + `next start` locais. BASE = `origin/portal` `71bd3534`. HEAD = esta branch após merge da portal. Compile path absoluto idêntico (`/tmp/geom-compile`). Sessão e APIs só via `page.route`. Sem harness estático.

Prova completa: `desktop-geometry/` (`p1-news-same-path-table.md`, JSON, prints, heatmaps).

## Desktop — geometria (1280×800 e 1440×900)

| viewport | página | boxes | px | nota |
|---|---|---|---:|---|
| 1280×800 | login | iguais | 31 | loginCard 368×360@(456,212); 31 px / maxChannel 37 = glifo (mesmo valor da prova two-path da #99) |
| 1280×800 | dashboard | iguais | 0 | header 1200×64, sidebar 80×800, main 1200×736 |
| 1280×800 | noticias | iguais | 0 | |
| 1280×800 | news-fullscreen | iguais | 0 | título 168×28@(16,12); Fechar desktop 46×20 (X é `md:hidden`) |
| 1440×900 | login | iguais | 0 | |
| 1440×900 | dashboard | iguais | 0 | |
| 1440×900 | noticias | iguais | 0 | |
| 1440×900 | news-fullscreen | iguais | 0 | título 168×28@(96,12); Fechar 46×20@(1298,16) |

## Mobile (HEAD)

| viewport | X | Esc |
|---|---|---|
| 390×844 | `data-modal-close` 44×44 | painel 1 → 0 |
| 375×812 | `data-modal-close` 44×44 | painel 1 → 0 |

Helpers = #99 final: `ModalCloseButton` md5 `5179e1f504553fe62e2c7ec7b360b9c1`, `useEscapeToClose` md5 `206d81d43a0748d0c045d6f713908702`.

Teste: `npx tsx --test src/components/news/NewsPostEditorFullScreen.mobile-chrome.test.ts`

Bloqueado: `InstagramStylePostCreator*`, `MediaUploadWithFilters*`, `HighlightCreator*` (PRs de segurança #102+).
