# Front mobile — kit e shell

## Purpose

UI só do front mobile. Desktop não importa estes arquivos.

## Ownership

- `TouchButton.tsx` — alvo 44 px (Radix Slot)
- `BottomSheet.tsx` — sheet sem lib nova
- `DataCard.tsx` — listas
- `MobileShell.tsx` — nav Home/Notícias/Férias/Mais (ícone + rótulo, ativo, ≥ 44 px, `pb-safe`)
- `MobileHome.tsx` — home real (saudação + atalhos do catálogo; sem mock)
- `MobileCompanion.tsx` — um FAB acima da nav + entrada no Mais
- `MobileLoginForm.tsx` + `mobile-login-flow.ts` — mesmo fluxo/APIs do desktop (`initiateLogin`, senha, OTP, convite, biometria, reset, quick-register, `/register`)
- `MobileLanguageSelector.tsx` / `MobileInviteCodeInput.tsx` — clones só do login mobile (hit ≥ 44×44). Não alterar `LanguageSelector.tsx` nem `Auth/InviteCodeInput.tsx`
- `mobile-shortcuts.ts` — `SYSTEM_MODULES` visíveis
- `UiSurfaceSwitch.tsx` — “Voltar para o mobile”. **Não** montar em layout desktop
- `mobile-styles.ts` — tokens injetados no layout `(mobile)` via `<style>`

## Local Contracts

- Sem mudança visual no desktop. Sem `import '*.css'` e sem segundo `next/font`.
- Login mobile: mesmas APIs e mesmos destinos (`/dashboard` ou `/set-password`). Sem bypass commitado. **Não** chamar `GET /api/auth/ensure-admin` no mount (`MobileLoginForm` / `mobile-login-flow`) — a rota fica gated (`CRON_SECRET`). Desktop `/login` igual. Sem mudança visual.
- Home `/m`: atalhos reais. Sem copy de dev e sem dados fake.
- `/m/preview`: vitrine de kit. Em produção, rewrite `beforeFiles` → `GET /api/mobile/preview-disabled` (HTTP 404). `notFound()` no page é reserva (layout já pode ter feito stream).
- Companion: entrada no Mais (D7 — sem FAB cobrindo nav/atalhos). Login sem FAB.
- `/m/*` no desktop: com Edge, `shouldRedirectMobilePrefix` manda `/m` → `/` e `/m/login` → `/login`. Sem Edge (Next 15.5 neste repo) a URL `/m/*` renderiza o front mobile; URLs públicas do desktop não mudam.

## Padrão de página mobile (revamp por módulo)

Cada módulo `/<rota>` ganha front mobile em `/m/<rota>`:

- `src/app/(mobile)/m/<rota>/page.tsx` — server component FINO, só `export default function …() { return <MobileX /> }` (contrato Next.js, não inlinar).
- `src/components/mobile/Mobile<Module>.tsx` — client component com a UI: `MobileShell` (título = nome do módulo) + `DataCard`/`TouchButton`/`BottomSheet`. Sem lib nova, sem CSS import, sem Tailwind classes novas fora do já usado no kit.
- Dados: APIs existentes em `src/app/api/**` (ler a rota antes de chamar). Auth: `getToken()` de `@/lib/tokenStorage` + header `Authorization: Bearer`; usuário via `useSupabaseAuth()` de `@/contexts/SupabaseAuthContext` (`user`, `profile`, `isAuthenticated`, `isLoading`).
- Função preservada: mesma API e mesmos campos do desktop; fluxos completos do desktop (forms grandes, aprovações admin) podem virar ação simples + link/302 natural p/ URL desktop (o catch-all `/m/[...slug]` redireciona).
- Referências canônicas: `MobileNewsFeed.tsx` (lista paginada pública) e `MobileLeave.tsx` (lista autenticada + BottomSheet de criação).
- `data-abz-mobile-<modulo>` no container raiz para smoke.

## Work Guidance

Página nova = adicionar a URL pública em `src/lib/mobile-ui/mobile-paths.js` (allowlist única, CJS; dono = sessão principal do revamp). Subagentes NÃO editam `mobile-paths.js` nem `next.config.js` — reportam os paths implementados no output. Match é exato (`/noticias` não cobre `/noticias/123`; sub-rota vira fallback desktop pelo catch-all).

## Verification

- `npx tsx --test src/components/mobile/mobile-login-flow.test.ts src/lib/mobile-ui/device-surface.test.ts src/lib/mobile-ui/middleware-contract.test.ts src/lib/mobile-ui/preview-block.test.ts`
- Login: `data-abz-mobile-login` + passos `data-abz-login-form`
- Home: `data-abz-mobile-home`. Nav ≥ 44 px (`.abz-m-nav-item`)
- Prova de fluxo: `scripts/mobile-fase2-login-proof.mjs` (mock de rede, sem bypass no repo)

## Child DOX Index

_(none)_
