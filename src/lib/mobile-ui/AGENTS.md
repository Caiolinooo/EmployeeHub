# Front mobile — detecção e rewrite

## Purpose

Decidir se o pedido serve o front mobile (`/m/...`) ou o desktop atual. Desktop é o default.

## Ownership

- `device-surface.ts` — allowlist, cookie `ui`, CH, UA, tablet, `/m/preview`
- `apply-mobile-surface.ts` — usado só por `src/middleware.ts`
- `mobile-surface-context.tsx` — flag cliente para esconder FAB desktop
- API: `src/app/api/ui-surface/route.ts` — cookie `ui`
- Testes: `device-surface.test.ts`

## Local Contracts

- Allowlist P0: `/login`. Fora da lista = desktop. `/m/preview` é direto (QA).
- Tablet (`device.type === 'tablet'`) = desktop.
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
