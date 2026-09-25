# Front mobile — rotas `/m`

## Purpose

Segmento interno do front mobile. URL pública não muda no rewrite de `/login`.

## Ownership

- `layout.tsx` — `data-abz-ui=mobile` + tokens via `<style>` (`mobile-styles.ts`)
- `m/page.tsx` — home real
- `m/login/page.tsx` — allowlist P0
- `m/preview/page.tsx` — vitrine de kit; bloqueada em produção (`notFound()`)

## Local Contracts

- Grupo `(mobile)` não altera o layout raiz.
- Pedido `/m` ou `/m/login` com UA desktop: redirect para `/` ou `/login` quando o Edge bundle existe. Sem Edge, a página mobile renderiza — não quebra `/login` desktop.
- `/m/preview` não redireciona (rota direta). Em produção responde 404.
- Auth/APIs iguais ao desktop.

## Work Guidance

Página nova = allowlist em `src/lib/mobile-ui/device-surface.ts` se precisar de rewrite da URL pública.

## Verification

- UA iPhone em `/login` serve `m/login`.
- UA desktop em `/login` serve `src/app/login/page.tsx`.
- UA desktop em `/m/login` → `/login` (Edge) ou mobile (sem Edge).
- `NODE_ENV=production` em `/m/preview` → 404.

## Child DOX Index

_(none)_
