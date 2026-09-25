# Security URL helpers — DOX

## Purpose

Guard de URL de saída para fetches server-side (SSRF / scheme checks).

## Ownership

- `safe-url.ts` — `parseSafeUrl`, `joinSafeUrl`, allowlists Poliweb / CA / ICS / PDF
- Testes: `safe-url.test.ts` (`npx tsx --test`)

## Local Contracts

- Sempre `new URL()`. Só `https:` salvo o alvo real exigir `http:`.
- Host allowlist explícita (constante ou host já lido de env existente). Sem env nova.
- Rejeitar credenciais na URL e IPs privados / loopback / link-local.
- HTML rewrite: `URL.protocol` bloqueia `javascript:`, `data:`, `vbscript:`.
- Fetch usa `url.href` depois do guard. Sem host derivado de `Host` / origin do request.

## Work Guidance

Novo sink `fetch(userInput)`: passar por `parseSafeUrl` / `joinSafeUrl` com allowlist do alvo real.

## Verification

- `npx tsx --test src/lib/security/safe-url.test.ts src/app/api/poliweb-proxy/poliweb-proxy.test.ts src/app/api/calendar/company/events/events.test.ts src/app/api/pdf-extract/pdf-extract.test.ts src/app/api/avaliacao/avaliacoes/alias.test.ts src/services/caLookupService.test.ts`

## Child DOX Index

_(none)_
