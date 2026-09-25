# Front mobile — detecção e rewrite

## Purpose

Decidir se o pedido serve o front mobile (`/m/...`) ou o desktop atual. Desktop é o default.

## Ownership

- `device-surface.ts` — allowlist, cookie `ui`, CH, UA, tablet, `/m` home, `/m/preview` (404 em produção)
- `preview-block.js` — rewrite de produção `/m/preview` → `/api/mobile/preview-disabled`
- `apply-mobile-surface.ts` — usado pelo `middleware.ts` da raiz
- Path gates: `src/lib/middleware-gates.ts` (`isAvaliacaoPagePath`, `isAuthPassthroughPath`, `/api/mobile/preview-disabled` público)
- Fallback P0: `next.config.js` `rewrites.beforeFiles` (`/login` + cookie/CH/UA; `/m/preview` 404 em produção). Mantido de propósito depois do Edge voltar a bundlar — `ui=desktop` em `missing`; regex de telefone cobre UA que o `userAgent()` do Next classifica como desktop.
- `ua-patterns.js` — tablet/phone regex (next.config + testes)
- API: `src/app/api/ui-surface/route.ts` — cookie `ui`
- `safeUiSurfaceNext` — `next=` só same-origin; rejeita `//`, `\\`, `%5c`. Redirect via `request.nextUrl.origin`, nunca `new URL(next, request.url)` cru.
- “Voltar ao mobile”: `UiSurfaceSwitch` só no front mobile. Sem layout extra em `/login` (reordena CSS).
- Testes: `device-surface.test.ts`

## Local Contracts

- Allowlist P0: `/login`. Fora da lista = desktop. Home mobile é `/m` (sem rewrite de `/`). `/m/preview` é direto; em produção o rewrite devolve HTTP 404.
- Desktop em `/m/*`: Edge redireciona `/m` → `/`, `/m/login` → `/login`. Sem o ficheiro na raiz o Edge não entra no bundle; com `middleware.ts` na raiz o rewrite de `/login` volta a correr. `next.config.js` `beforeFiles` permanece como fallback.
- Tablet = desktop. Middleware: `device.type === 'tablet'`. Fallback `next.config`: `TABLET_UA_VALUE` (iPad, Tablet, PlayBook, SM-T/SM-X, Nexus 7/9/10, Kindle, Silk, Lenovo TB, Pixel Tablet). Telefone = `PHONE_REWRITE_UA_VALUE` (ancora `^$`; tablet vence mesmo com `Mobile`).
- Cookie `ui=desktop|mobile` vence UA/CH. Query `?ui=desktop|mobile` vence o rewrite (e o cookie) e grava o cookie.
- Redirect `/m/*` → URL pública via `request.nextUrl.clone()` + `pathname = stripMobilePrefix`. Sem `new URL(stripMobilePrefix…)`.
- Bot = desktop.
- Rewrite interno; URL pública não muda.
- Pedido desktop: `NextResponse.next()` sem header extra.

## Work Guidance

- Novo módulo mobile: página em `src/app/(mobile)/m/<rota>` **e** entrada na allowlist.
- Não importar isto em componentes desktop.
- Não adicionar `import '*.css'` no front mobile: o CSS global do Next reordena `:root --font-plus-jakarta` e o desktop deixa de usar `next/font`.

## Verification

- `npx tsx --test src/lib/mobile-ui/device-surface.test.ts src/lib/mobile-ui/preview-block.test.ts src/lib/mobile-ui/middleware-contract.test.ts src/lib/middleware-gates.test.ts`
- `safeUiSurfaceNext('/\\evil.com', origin)` e `next=/%5Cevil.com` → `/login`; `new URL(result, origin).origin` = origin.
- UA desktop em `/login` → HTML desktop.
- UA iPhone em `/login` → rewrite `/m/login`.
- Cookie `ui=desktop` no iPhone → desktop.
- Query `?ui=desktop` no iPhone → desktop + cookie `ui=desktop`.

## Child DOX Index

_(none)_
