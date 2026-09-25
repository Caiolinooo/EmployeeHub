# Prova NewsPostEditorFullScreen

Servidores: portal `127.0.0.1:3010` vs branch `127.0.0.1:3011`. Sessão/API via `page.route` (sem bypass no código).

| viewport | before | after | nota |
|---|---|---|---|
| 390×844 | `before-390.png` | `after-390.png` | Before: só texto "Fechar" (sem X 44px). After: X `data-modal-close` 44×44. Esc fecha. Sem overflow. |
| 375×812 | `before-375.png` | `after-375.png` | Mesmo: X after 44×44. Sem overflow horizontal. |
| 1440×900 | `before-1440.png` | `after-1440.png` | **diffPx = 0** (`diff-1440.png`). X é `mobileOnly`. |

Esc (after 390): `data-modal-panel` 1 → 0.

Teste: `npx tsx --test src/components/news/NewsPostEditorFullScreen.mobile-chrome.test.ts`

Bloqueado: `InstagramStylePostCreator*`, `MediaUploadWithFilters*`, `HighlightCreator*` (PRs de segurança #102+).
