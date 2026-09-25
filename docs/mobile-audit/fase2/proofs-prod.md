# Fase 2 — prova desktop produção (1440×900) + QA PR #95

`next build` + `next start`.  
Before: `870924dc` em `/tmp/mf-before` → `:3001`.  
After: `03497d6c` em `/tmp/mf-after` → `:3002`.  
Irmãos sob `/tmp`. Comparar `/workspace` vs `/tmp` é inválido (sort de CSS do Next 15.5 depende do path absoluto).

Idioma idêntico: `locale=pt-BR`, `languageDialogShown=true`, cookie `NEXT_LOCALE=pt-BR`. Sem animações. UA desktop. Sem cookie `ui`.

Script: `scripts/mobile-fase2-prod-diff.mjs`. JSON: `proofs-prod.json`. Alvos: `scripts/mobile-fase2-touch-targets.mjs` → `touch-targets.json`.

## Diff por rota (1 296 000 px)

| Rota | px | % |
|------|----|---|
| `/login` | **0** | **0%** |
| `/register` | **0** | **0%** |
| `/reset-password` | **0** | **0%** |
| `/unauthorized` | **0** | **0%** |
| `/dashboard` | **0** | **0%** |

Fonte desktop: mesma ordem de `<link>` (`bef464f1` → `715be398` → `6cb2ff30`). `data-abz-ui` no `<html>`: ausente. Sem toque em `src/app/layout.tsx`, `src/app/login/page.tsx`, `LanguageSelector.tsx`, `Auth/InviteCodeInput.tsx`.

## Alvos de toque no login mobile (`getBoundingClientRect`)

Antes (QA, 390×844): EN 34,4×28; PT 32,3×28; convite 203,3×20; Criar conta 77,6×19.

| Alvo | 390×844 antes | 390×844 depois | 375×812 depois |
|------|---------------|----------------|----------------|
| EN | 34,4×28 | **44×44** | **44×44** |
| PT | 32,3×28 | **44×44** | **44×44** |
| Tenho um código de convite | 203,3×20 | **201×44** | **201×44** |
| Criar conta | 77,6×19 | **73×44** | **73×44** |

Wrappers só em `src/components/mobile/` (`MobileLanguageSelector`, `MobileInviteCodeInput`) + `touch-target` no link “Criar conta”.

## `/m/preview` e `/m/rota-inexistente` (`next start`)

```
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/m/preview
404
```

Corpo: `Not Found`. Rewrite `beforeFiles` → `GET /api/mobile/preview-disabled`.

```
curl -sI http://127.0.0.1:3002/m/rota-inexistente
HTTP/1.1 307 Temporary Redirect
location: http://localhost:3002/rota-inexistente
```

Seguir o redirect: desktop 404 (`src/app/not-found.tsx`). `m/not-found.tsx` não altera o 404 global.

## `/m/*` no desktop

- Com Edge: `/m` → `/`, `/m/login` → `/login`. `/m/preview` não redireciona (404 em produção).
- Sem Edge (este Next 15.5): `/m/*` **renderiza o mobile** (ou 307 no catch-all). `/login` público continua desktop (`data-abz-mobile-login` = 0).

## Testes

`npx tsx --test src/lib/mobile-ui/device-surface.test.ts src/lib/mobile-ui/preview-block.test.ts src/components/mobile/mobile-login-flow.test.ts` — **34 pass** (inclui GET/HEAD 404 do handler).

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
