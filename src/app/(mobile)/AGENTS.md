# Front mobile — rotas `/m`

## Purpose

Segmento interno do front mobile. URL pública não muda no rewrite de `/login`.

## Ownership

- `layout.tsx` — `data-abz-ui=mobile` + tokens via `<style>` (`mobile-styles.ts`)
- `m/page.tsx` — home real
- `m/login/page.tsx` — allowlist P0
- `m/preview/page.tsx` — vitrine de kit; em produção o rewrite vai para `/api/mobile/preview-disabled` (404 real)
- `m/[...slug]/route.ts` — `/m/rota-inexistente` redireciona (307) para o equivalente desktop
- `m/not-found.tsx` — só o segmento `/m`; link “Ver versão completa”. Não altera `src/app/not-found.tsx`

## Local Contracts

- Grupo `(mobile)` não altera o layout raiz.
- Pedido `/m` ou `/m/login` com UA desktop: redirect para `/` ou `/login` quando o Edge bundle existe. Sem Edge, a página mobile renderiza — não quebra `/login` desktop.
- `/m/preview` não redireciona (rota direta). Em produção: rewrite `beforeFiles` → HTTP 404 (`/api/mobile/preview-disabled`).
- `/m/*` sem página: `m/[...slug]/route.ts` tira o prefixo `/m` e redireciona. Sem Edge e sem catch-all, caía no 404 mobile.
- Auth/APIs iguais ao desktop.

## Work Guidance

Página nova = allowlist em `src/lib/mobile-ui/device-surface.ts` se precisar de rewrite da URL pública.

## Verification

- UA iPhone em `/login` serve `m/login`.
- UA desktop em `/login` serve `src/app/login/page.tsx`.
- UA desktop em `/m/login` → `/login` (Edge) ou mobile (sem Edge).
- `NODE_ENV=production` em `/m/preview` → HTTP 404 (`curl -w '%{http_code}'` no `next start`).
- `/m/rota-inexistente` → 307 `/rota-inexistente` (desktop).

## Child DOX Index

_(none)_
