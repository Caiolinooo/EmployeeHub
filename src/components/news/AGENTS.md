# News overlays

## Purpose

Contrato local do editor fullscreen e do menu ⋮ do feed.

## Ownership

`NewsFeed`, `NewsPostCard`, `NewsPostEditorFullScreen`.

## Local Contracts

- Botão ⋮ leva `data-news-more`. Item Editar desmonta; antes de abrir o editor, o ⋮ recebe `focus()` e o fullscreen faz `markTrigger` nele (fallback se o item do menu for o `activeElement`).
- Fechar (Esc, X, Fechar) restaura foco no ⋮ visível. Sem backdrop separado (`n/a-fullscreen`).
- Hash de `useRestoreFocus` / `useEscapeToClose` / `useEscapeCapture` não muda aqui.

## Work Guidance

## Verification

- Foco sem Playwright `force`: Tab até ⋮, Enter abre menu, Enter em Editar, Esc/X fecha, `activeElement` = `[data-news-more]`.
- Clique normal no ⋮ e em Editar: mesmo restore.

## Child DOX Index
