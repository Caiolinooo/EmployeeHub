# Fase 2 — provas (2026-09-25)

Prova de produção 1440×900 (0 px): `proofs-prod.md`. Este arquivo é o lote em `next dev` (overlay/i18n ruidosos).

App local `http://127.0.0.1:3000` com `.env.local` fake (não commitado). Playwright + `scripts/mobile-fase2-proofs.mjs`.

## Rewrite / cookie

HTML do `GET /login`:

| Pedido | Árvore |
|--------|--------|
| UA desktop | `app/login/page` (desktop). Sem `(mobile)/m/login`. |
| UA iPhone | `(mobile)/m/login` (front mobile). |
| UA iPhone + cookie `ui=desktop` | `app/login/page` (desktop). |

Fonte: `docs/mobile-audit/fase2/proofs.json`.

Roteamento P0 no `next.config.js` `rewrites.beforeFiles` (cookie / `Sec-CH-UA-Mobile: ?1` / UA `Mobile` exceto iPad/Tablet). `src/middleware.ts` aplica a mesma decisão quando o Edge bundle existe. Neste Next 15.5.25 o `middleware-manifest.json` ficou `middleware: {}` no `next dev` e no `next build` — o fallback do `next.config.js` é o que prova o rewrite local.

## Mobile (375×812 e 390×844)

- `mobile/login-*.png` — login P0 + “Ver versão completa” + FAB IA
- `mobile/login-companion-*.png` — sheet Companion
- `mobile/shell-*.png` — nav Home / Notícias / Férias / Mais
- `mobile/mais-*.png` — sheet Mais com `SYSTEM_MODULES`
- `mobile/companion-*.png` — Companion full-width

## Desktop 1440×900 (antes = `feat/mobile-first`, depois = esta branch)

| Rota | px diferentes / 1 296 000 | Nota |
|------|---------------------------|------|
| `/login` | 7 793 (0,60%) | Overlay Next (botão Issues). Form/layout iguais. |
| `/register` | 2 523 (0,19%) | BEFORE tinha badge Issues; AFTER removeu `nextjs-portal`. Card idêntico. |
| `/unauthorized` | alto | BEFORE capturou o modal de idioma; AFTER é a página real. Não é regressão de layout. |
| `/reset-password` | 85 374 (6,6%) | i18n/overlay. Sem nav/FAB extra. |

Sem cookie `ui=desktop` o desktop **não** mostra “Voltar para o mobile”.

## Lint / tsc / build

- `npx tsx --test src/lib/mobile-ui/device-surface.test.ts` — 21 pass
- `npx eslint` nos arquivos da Fase 2 — 0 erro
- `npx tsc --noEmit` — 0
- `npm run lint` no repo inteiro — warnings pré-existentes
- `npm run build` — webpack compile OK; falhou em `collect page data` de `/api/reembolso/[protocolo]/pdf` por Supabase fake local (`supabaseKey is required`). Sem env de Production.

## Preview Vercel

PR #95 contra `feat/mobile-first`. **Sem comentário/check da Vercel.** Só Netlify (preview **canceled**). Sem `vercel --prod`. Sem merge em `portal`.
