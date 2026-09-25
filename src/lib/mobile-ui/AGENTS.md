# Front mobile — detecção e rewrite

## Purpose

Decidir se o pedido serve o front mobile (`/m/...`) ou o desktop atual. Desktop é o default.

## Ownership

- `device-surface.ts` — allowlist, cookie `ui`, CH, UA, tablet, `/m/preview`
- `apply-mobile-surface.ts` — usado só por `src/middleware.ts`
- Fallback P0: `next.config.js` `rewrites.beforeFiles` (`/login` + cookie/CH/UA)
- `ua-patterns.js` — tablet/phone regex (next.config + testes)
- API: `src/app/api/ui-surface/route.ts` — cookie `ui`
- “Voltar ao mobile”: `src/app/login/layout.tsx` (switch null sem cookie)
- Testes: `device-surface.test.ts`

## Local Contracts

- Allowlist P0: `/login`. Fora da lista = desktop. `/m/preview` é direto (QA).
- Tablet = desktop. Middleware: `device.type === 'tablet'`. Fallback `next.config`: `TABLET_UA_VALUE` (iPad, Tablet, PlayBook, SM-T/SM-X, Nexus 7/9/10, Kindle, Silk, Lenovo TB, Pixel Tablet). Telefone = `PHONE_REWRITE_UA_VALUE` (ancora `^$`; tablet vence mesmo com `Mobile`).
- Cookie `ui=desktop|mobile` vence UA/CH.
- Bot = desktop.
- Rewrite interno; URL pública não muda.
- Pedido desktop: `NextResponse.next()` sem header extra.

## Work Guidance

- Novo módulo mobile: página em `src/app/(mobile)/m/<rota>` **e** entrada na allowlist.
- Não importar isto em componentes desktop.

## Verification

- `npx tsx --test src/lib/mobile-ui/device-surface.test.ts`
- UA desktop em `/login` → HTML desktop.
- UA iPhone em `/login` → rewrite `/m/login`.
- Cookie `ui=desktop` no iPhone → desktop.

## Child DOX Index

_(none)_
