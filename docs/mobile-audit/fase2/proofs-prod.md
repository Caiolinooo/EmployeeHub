# Fase 2 — prova desktop produção (1440×900)

`next build` + `next start`.  
Before: `feat/mobile-first` (`149f8771`) em `/tmp/mf-before` → `:3001`.  
After: `feat/mobile-first-fase2` (`8923b336`) em `/tmp/mf-after` → `:3002`.  
Irmãos sob `/tmp`. Comparar `/workspace` vs `/tmp` é inválido (sort de CSS do Next 15.5 depende do path absoluto).

Idioma idêntico: `locale=pt-BR`, `languageDialogShown=true`, cookie `NEXT_LOCALE=pt-BR`. Sem animações. UA desktop. Sem cookie `ui`.

Script: `scripts/mobile-fase2-prod-diff.mjs`. JSON: `proofs-prod.json` (`createdAt: 2026-09-25T04:25:51.194Z`).

## Diff por rota (1 296 000 px)

| Rota | px | % |
|------|----|---|
| `/login` | **0** | **0%** |
| `/register` | **0** | **0%** |
| `/reset-password` | **0** | **0%** |
| `/unauthorized` | **0** | **0%** |
| `/dashboard` | **0** | **0%** |

Fonte desktop: `plusJakartaSans`. `data-abz-ui` no `<html>`: `null`. Sem toque em `src/app/layout.tsx` nem `src/app/login/page.tsx`.

Hash Tailwind do after mudou (`bef464f1…`) porque o front mobile ganhou classes já usadas no kit; a ordem dos `<link>` no `/login` continua `globals → toastify → next/font`. Pixel-diff 0.

## `/m/*` no desktop

- Com Edge: `/m` → `/`, `/m/login` → `/login`. `/m/preview` não redireciona.
- Sem Edge (este Next 15.5): `/m/*` **renderiza o mobile**. `/login` público continua desktop (provado: `data-abz-mobile-login` = 0).
- `/m/preview` em produção: `notFound()` (vitrine ausente). Status HTML pode vir 200 com corpo 404 (prerender Next).

## Login mobile (mock de rede, sem bypass)

`scripts/mobile-fase2-login-proof.mjs` + `login-proof.json`.

| Passo | Resultado |
|-------|-----------|
| UI e-mail: convite, biometria, Criar conta, EN/PT | ok |
| e-mail novo → `quick_register` | ok |
| e-mail existente → `password` | ok |
| `POST /api/auth/login` | ok (mesmo endpoint do desktop) |
| `POST /api/auth/webauthn/login/options` | ok |
| `/login` desktop sem árvore mobile | ok |
| Destino após login | `postLoginPath` = `/dashboard` (ou `/set-password`). Token mock não mantém sessão. |

Testes: `npx tsx --test src/lib/mobile-ui/device-surface.test.ts src/components/mobile/mobile-login-flow.test.ts` — **30 pass**.

## Screenshots 375×812 e 390×844

| Tela | 375 | 390 |
|------|-----|-----|
| Login (e-mail, convite, biometria, EN/PT, Criar conta) | `mobile/login-375x812.png` | `mobile/login-390x844.png` |
| Login convite aberto | `mobile/login-invite-375x812.png` | `mobile/login-invite-390x844.png` |
| Login senha | `mobile/login-password-375x812.png` | `mobile/login-password-390x844.png` |
| Reset senha | `mobile/login-reset-375x812.png` | `mobile/login-reset-390x844.png` |
| Home | `mobile/home-375x812.png` | `mobile/home-390x844.png` |
| Mais | `mobile/mais-375x812.png` | `mobile/mais-390x844.png` |
| Companion | `mobile/companion-375x812.png` | `mobile/companion-390x844.png` |

Pasta: `docs/mobile-audit/fase2/`.
