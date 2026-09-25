# Prova Chat criação/configurações

Servidores: portal `127.0.0.1:3010` vs branch `127.0.0.1:3011`. Sessão/API via `page.route`.

| viewport | before | after | nota |
|---|---|---|---|
| 390×844 | `before-390.png` | `after-390.png` | Before: CreateServerModal sem X. After: X `data-modal-close` 44×44. Tap-fora no backdrop. |
| 375×812 | `before-375.png` | `after-375.png` | X after 44×44. Sem overflow horizontal. |
| 1440×900 | `before-1440.png` | `after-1440.png` | **diffPx = 0** (`diff-1440.png`). X é `mobileOnly`. |

Esc: `useEscapeToClose` no modal (teste unitário). No Playwright o painel da sidebar (`-translate-x-full`) também tem `data-modal-panel`, então o contador não vai a 0.

Teste: `npx tsx --test src/components/chat/chat-modals.mobile-chrome.test.ts`
