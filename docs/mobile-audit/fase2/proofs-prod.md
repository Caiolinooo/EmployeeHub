# Fase 2 — prova desktop produção (1440×900)

`next build` + `next start`. Before: `feat/mobile-first` (`149f8771`) em `:3001`. After: esta branch em `:3002`.  
Idioma idêntico nos dois: `locale=pt-BR`, `languageDialogShown=true`, cookie `NEXT_LOCALE=pt-BR`. Sem animações. `document.fonts.ready` + imagens. UA desktop. Sem cookie `ui`. Sem `data-abz-ui=mobile`.

Script: `scripts/mobile-fase2-prod-diff.mjs`. JSON: `proofs-prod.json`.

## Diff por rota (1 296 000 px)

| Rota | px | % | bbox | Nota |
|------|----|---|------|------|
| `/login` | 20 066 | 1,5483% | 536,135–879,816 | Só glifos. Caixas iguais. |
| `/register` | 23 666 | 1,8261% | 527,49–928,840 | Idem. |
| `/reset-password` | 7 800 | 0,6019% | 584,379–880,594 | Idem. Sem overlay Next. Sem modal de idioma. |
| `/unauthorized` | 7 060 | 0,5448% | 530,414–908,553 | Idem. Modal de idioma **não** aparece (os dois lados). |
| `/dashboard` | **0** | **0%** | — | Sem sessão. Os dois refs pintam a mesma tela vazia. Sem bypass commitado. |

Shift 1–2 px: **não**. Melhor alinhamento continua `dx=0, dy=0`.  
`h1` e `form` getBoundingClientRect: **idênticos** (`x=496/536`, `y=125.6875/265.6875`).  
`data-abz-ui` no `<html>`: `null` nos dois. `UiSurfaceSwitch` não monta.

## Causa do leftover (não é layout)

Arquivos CSS **iguais** (mesmo hash):

- `1b418106e0919646.css` — globals + Tailwind
- `715be398208dca58.css`
- `6cb2ff308773e395.css` — `@font-face` `plusJakartaSans` + `.__variable_70cfe0 { --font-plus-jakarta: "plusJakartaSans", … }`

Ordem dos `<link>` no `/login`:

- Before: `1b4181` → `715be3` → `6cb2ff` (**font por último**; variável vence)
- After: `6cb2ff` → `1b4181` → `715be3` (`:root { --font-plus-jakarta: 'Plus Jakarta Sans', system-ui }` em `globals.css` vence)

Computed:

- Before: `font-family: plusJakartaSans, "plusJakartaSans Fallback"` (faces 400/600/800 loaded)
- After: `font-family: "Plus Jakarta Sans", system-ui, sans-serif` (faces `plusJakartaSans` unloaded)

O Next 15.5.25 com `experimental.optimizeCss` reordena os `<link>` quando o grafo ganha as rotas `(mobile)`. Não mexemos em `src/app/layout.tsx` nem `globals.css` (diff 0 vs `feat/mobile-first`). Corrigir a ordem exigiria toque no layout raiz (especificidade `html.__variable_*` sobre `:root`) — fora da regra “desktop congelado”.

Crops: `diff/*-crop-before.png` e `*-crop-after.png` (mesmo texto/botões; raster de fonte).

## Arquivos desktop existentes

- `src/components/ClientProviders.tsx` — **revertido**. Diff 0 vs `feat/mobile-first`.
- `src/contexts/CompanionSessionContext.tsx` — **revertido**. Diff 0 vs `feat/mobile-first`.
- Sem `src/app/login/layout.tsx` (layout extra reordenava CSS).
- Sem `import '*.css'` no front mobile (isso inchava o Tailwind). Tokens em `mobile-styles.ts` via `<style>` no layout `(mobile)`.

## Middleware Edge

`middleware-manifest.json` em **produção**:

```json
{ "version": 3, "middleware": {}, "functions": {}, "sortedMiddleware": [] }
```

- `feat/mobile-first` (`149f8771`): vazio
- `feat/mobile-first-fase2`: vazio
- `portal` (`51f741c4`, Next **15.5.25** igual): **vazio**. Sem `middleware.js`.

**Pré-existente em `portal`.** Causa provável: este Next 15.5.25 não emite o bundle Edge (`middleware: {}`) mesmo com `src/middleware.ts` + `config.matcher`. Impacto: o middleware de auth/locale **já não roda no `next start` de `portal`**. Auth continua nas rotas de API/página (o próprio arquivo diz isso). **Não corrigimos o desktop.** O P0 `/login` usa `next.config.js` `rewrites.beforeFiles`.

## Tablet

`TABLET_UA_VALUE` = iPad | Tablet | PlayBook | SM-T/SM-X | Nexus 7/9/10 | Kindle | Silk | Lenovo TB | Pixel Tablet.  
`PHONE_REWRITE_UA_VALUE` ancorado `^$`; tablet vence mesmo com `Mobile` no UA.

HTML `GET /login` em `:3002`: desktop = iPad = SM-T = iPhone+`ui=desktop` (19124 B, `app/login`). iPhone (20709 B, `(mobile)/m/login`, `abz-m-bg`).

Testes: `npx tsx --test src/lib/mobile-ui/device-surface.test.ts` — **23 pass**.
