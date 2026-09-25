# PDF extract — DOX

## Purpose

HEAD + extração simulada de PDF. Alvo real: storage Supabase e arquivos do portal.

## Ownership

- `route.ts`
- URL: `resolvePdfExtractUrl` em `src/lib/security/safe-url.ts`

## Local Contracts

- Auth obrigatória **antes** de resolver URL ou HEAD externo: `Authorization: Bearer` via `extractTokenFromHeader`, fallback cookie `abzToken` / `token`, validado com `verifyToken`. Sem token ou sem `payload.userId` → 401 `{ error: 'Unauthorized' }`.
- Allowlist: host de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`.
- Path relativo junta na base do app (env), nunca no header `Host`.
- Só `https:`. Foreign host / IP privado / `javascript:` → 400 `{ error: 'URL do PDF não permitida' }`.
- HEAD via `fetchWithSafeRedirects` (`redirect: 'manual'`, máx. 3 hops). Cada `Location` revalida allowlist + IP privado (incl. IPv4-mapped IPv6). Hop inseguro → 400 `{ error: 'URL do PDF não permitida' }`.

## Work Guidance

Sem env nova. Sem fetch se o guard falhar.

## Verification

- `npx tsx --test src/app/api/pdf-extract/pdf-extract.test.ts src/lib/security/safe-url.test.ts src/lib/security/fetch-with-safe-redirects.test.ts` — sem token / token inválido → 401; token válido segue allowlist + HEAD mockado; redirect inseguro ou >3 hops rejeitado

## Child DOX Index

_(none)_
