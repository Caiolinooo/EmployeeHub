# PDF extract — DOX

## Purpose

HEAD + extração simulada de PDF. Alvo real: storage Supabase e arquivos do portal.

## Ownership

- `route.ts`
- URL: `resolvePdfExtractUrl` em `src/lib/security/safe-url.ts`

## Local Contracts

- Allowlist: host de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`.
- Path relativo junta na base do app (env), nunca no header `Host`.
- Só `https:`. Foreign host / IP privado / `javascript:` → 400 `{ error: 'URL do PDF não permitida' }`.
- HEAD via `fetchWithSafeRedirects` (`redirect: 'manual'`, máx. 3 hops). Cada `Location` revalida allowlist + IP privado (incl. IPv4-mapped IPv6). Hop inseguro → 400 `{ error: 'URL do PDF não permitida' }`.

## Work Guidance

Sem env nova. Sem fetch se o guard falhar.

## Verification

- `npx tsx --test src/app/api/pdf-extract/pdf-extract.test.ts src/lib/security/safe-url.test.ts src/lib/security/fetch-with-safe-redirects.test.ts`

## Child DOX Index

_(none)_
