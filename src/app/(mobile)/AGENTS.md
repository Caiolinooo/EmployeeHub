# Front mobile — rotas `/m`

## Purpose

Segmento interno do front mobile. URL pública não muda (rewrite).

## Ownership

- `layout.tsx` — `data-abz-ui=mobile` + tokens
- `m/login/page.tsx` — P0 allowlist
- `m/preview/page.tsx` — QA do shell (sem rewrite; UA desktop pode abrir)

## Local Contracts

- Grupo `(mobile)` não altera o layout raiz.
- Pedido `/m/*` com UA desktop redireciona à URL sem prefixo, salvo `ui=mobile` ou `/m/preview`.
- Auth/APIs iguais ao desktop.

## Work Guidance

Página nova = allowlist em `src/lib/mobile-ui/device-surface.ts`.

## Verification

- UA iPhone em `/login` serve este login.
- UA desktop em `/login` serve `src/app/login/page.tsx`.

## Child DOX Index

_(none)_
