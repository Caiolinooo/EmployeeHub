# Fase 2 — prova desktop produção (1440×900)

`next build` + `next start`.  
Before: `feat/mobile-first` (`149f8771`) em `/tmp/mf-before` → `:3001`.  
After: `feat/mobile-first-fase2` (este commit) em `/tmp/mf-after` → `:3002`.  
Os dois trees são irmãos sob `/tmp` (mesmo prefixo absoluto). Comparar after em `/workspace` contra before em `/tmp` é inválido — ver causa abaixo.

Idioma idêntico: `locale=pt-BR`, `languageDialogShown=true`, cookie `NEXT_LOCALE=pt-BR`. Sem animações. `document.fonts.ready` + imagens. UA desktop. Sem cookie `ui`. Sem `data-abz-ui=mobile`.

Script: `scripts/mobile-fase2-prod-diff.mjs`. JSON: `proofs-prod.json` (`createdAt: 2026-09-25T04:11:16.786Z`).

## Diff por rota (1 296 000 px)

| Rota | px | % | bbox | Fonte computada |
|------|----|---|------|-----------------|
| `/login` | **0** | **0%** | — | `plusJakartaSans, "plusJakartaSans Fallback"` nos dois |
| `/register` | **0** | **0%** | — | idem |
| `/reset-password` | **0** | **0%** | — | idem |
| `/unauthorized` | **0** | **0%** | — | idem |
| `/dashboard` | **0** | **0%** | — | Sem sessão. Mesma tela vazia. Sem bypass. |

`h1`/`form` iguais. `data-abz-ui` no `<html>`: `null` nos dois. `UiSurfaceSwitch` não monta.

Uma captura fria de `/login` neste mesmo par chegou a 22 px (0,0017%, delta de canal ≤ 7) só na antialias dos ícones do form. Recaptura do mesmo par e captura dupla do mesmo servidor: **0 px**. Não é troca de fonte nem quebra de linha.

## Causa do leftover anterior (falso)

Arquivos CSS **iguais** (mesmo hash):

- `1b418106e0919646.css` — globals + Tailwind
- `715be398208dca58.css`
- `6cb2ff308773e395.css` — `@font-face` `plusJakartaSans` + `.__variable_70cfe0 { --font-plus-jakarta: "plusJakartaSans", … }`

O Next 15.5.25 (`FlightClientEntryPlugin` / `deduplicateCSSImportsForEntry`) ordena os `<link>` com um sort que **depende do path absoluto do build**. Não é o grafo do front mobile.

| Build | Path | Ordem `<link>` em `/login` | `--font-plus-jakarta` vencedor | Fonte |
|-------|------|----------------------------|--------------------------------|-------|
| before `149f8771` | `/tmp/mf-before` | `1b4181` → `715be3` → `6cb2ff` | next/font | `plusJakartaSans` |
| after `30710493` | `/workspace` | `6cb2ff` → `1b4181` → `715be3` | `:root` em `globals.css` (`'Plus Jakarta Sans', system-ui`) | system-ui (quebra “Windows Hello”) |
| after `30710493` | `/tmp/mf-after` | `1b4181` → `715be3` → `6cb2ff` | next/font | `plusJakartaSans` |

Bisect no after em `/workspace`: remover `(mobile)`, reverter `next.config.js` / `src/middleware.ts`, remover `/api/ui-surface` — a ordem **continuou** font-first. Recolocar os arquivos não mudou. O mesmo SHA em `/tmp/mf-after` volta font-last.

O mobile **não** redeclarava `next/font` nem reimportava `globals.css`. Isolamento já existente (sem toque no `layout.tsx` raiz):

- `src/app/(mobile)/layout.tsx` injeta `MOBILE_SURFACE_CSS` via `<style>` (string em `mobile-styles.ts`)
- sem `import '*.css'` no front mobile
- sem segundo `next/font`
- classes Tailwind únicas do mobile viraram helpers `abz-m-*` para o hash `1b418106` ficar igual ao before

Nenhum arquivo desktop existente nem o layout raiz foi editado nesta correção. A correção da prova é construir os dois refs como irmãos sob o mesmo prefixo (`/tmp/mf-*`).

## `/m/login` — fonte da marca

UA iPhone + `Sec-CH-UA-Mobile: ?1` em `:3002`:

- `data-abz-ui=mobile`
- `font-family: plusJakartaSans, "plusJakartaSans Fallback"`
- faces 400/600/800 `loaded`

## Screenshots mobile (produção `:3002`, depois da correção)

| Viewport | Login | Shell |
|----------|-------|-------|
| 375×812 | `docs/mobile-audit/fase2/mobile/login-375x812.png` | `docs/mobile-audit/fase2/mobile/shell-375x812.png` |
| 390×844 | `docs/mobile-audit/fase2/mobile/login-390x844.png` | `docs/mobile-audit/fase2/mobile/shell-390x844.png` |

## Arquivos desktop existentes

- `src/app/layout.tsx` — **não tocado**
- `src/components/ClientProviders.tsx` — diff 0 vs `feat/mobile-first`
- `src/contexts/CompanionSessionContext.tsx` — diff 0 vs `feat/mobile-first`
- Sem `src/app/login/layout.tsx`
- Sem `import '*.css'` no front mobile

## Middleware Edge

`middleware-manifest.json` em produção: `{ "version": 3, "middleware": {}, "functions": {}, "sortedMiddleware": [] }` em `feat/mobile-first`, nesta branch e em `portal` (`51f741c4`, Next 15.5.25). Pré-existente. P0 `/login` usa `next.config.js` `rewrites.beforeFiles`.

## Tablet / testes UA

`TABLET_UA_VALUE` = iPad | Tablet | PlayBook | SM-T/SM-X | Nexus 7/9/10 | Kindle | Silk | Lenovo TB | Pixel Tablet.  
`PHONE_REWRITE_UA_VALUE` ancorado `^$`; tablet vence mesmo com `Mobile`.

`npx tsx --test src/lib/mobile-ui/device-surface.test.ts` — **23 pass**.
