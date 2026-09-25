# Prova GlobalSearch

Servidores: portal `127.0.0.1:3010` (base + mount temporário do trigger) vs branch `127.0.0.1:3011`.

| viewport | before | after | nota |
|---|---|---|---|
| 390×844 | `before-390.png` | `after-390.png` | X after 44×44 (`aria-label=Fechar`). Esc fecha o painel. |
| 375×812 | `before-375.png` | `after-375.png` | X after 44×44. Sem overflow horizontal. |
| 1440×900 | `before-1440.png` | `after-1440.png` | **diffPx = 0** (`diff-1440.png`) |

Esc (after 390): `data-modal-panel` 1 → 0.

Teste: `npx tsx --test src/components/GlobalSearch.mobile-chrome.test.ts`
