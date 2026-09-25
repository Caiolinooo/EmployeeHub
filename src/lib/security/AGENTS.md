# Security URL helpers — DOX

## Purpose

Guard de URL de saída para fetches server-side (SSRF / scheme checks).

## Ownership

- `safe-url.ts` — `parseSafeUrl`, `joinSafeUrl`, allowlists Poliweb / CA / ICS / PDF
- `fetch-with-safe-redirects.ts` — `fetchWithSafeRedirects` (redirect manual, 3 hops, revalida cada `Location`)
- `trim-trailing-char.ts` — `trimTrailingChar` linear (mesmo corpo que #116 em `llm-endpoint.ts` / `tls-pin.ts`; ficheiro próprio para o merge não colidir)
- Testes: `safe-url.test.ts`, `fetch-with-safe-redirects.test.ts`, `trim-trailing-char.test.ts` (`npx tsx --test`)

## Local Contracts

- Sempre `new URL()`. Só `https:` salvo o alvo real exigir `http:`.
- Host allowlist explícita (constante ou host já lido de env existente). Sem env nova.
- Rejeitar credenciais na URL e IPs privados / loopback / link-local, inclusive IPv4 embutido em IPv6 (`::ffff:0:0/96` mapped `::ffff:X:Y`, IPv4-translated `::ffff:0:X:Y` / `0:0:0:0:ffff:0:0:0/96`, `::/96` compatível, `64:ff9b::/96` NAT64, `2002::/16` 6to4 hextets 2–3; pontilhado e hextets Node), mesmo se o hostname estiver na allowlist. IPv4 público embutido (ex. `64:ff9b::8.8.8.8`, `[2002:808:808::]`, `[::ffff:0:808:808]`) não entra no denylist; a allowlist ainda vale.
- Hostname: `trimTrailingChar(host, '.')` — sem regex `/\\.+$/` (ReDoS).
- Limitação conhecida: hostnames DNS wildcard (`127.0.0.1.nip.io`) não são pegos — o checker não resolve DNS.
- Outbound `fetch` SSRF: `fetchWithSafeRedirects` (`redirect: 'manual'`, no máx. 3 hops). Cada `Location` resolve contra a URL atual e passa de novo em `parseSafeUrl` (allowlist + IP privado).
- HTML rewrite: `URL.protocol` bloqueia `javascript:`, `data:`, `vbscript:`.
- Fetch usa `url.href` depois do guard. Sem host derivado de `Host` / origin do request.

## Work Guidance

Novo sink `fetch(userInput)`: passar por `parseSafeUrl` / `joinSafeUrl` com allowlist do alvo real. Follow de 3xx só via `fetchWithSafeRedirects`.

## Verification

- `npx tsx --test src/lib/security/safe-url.test.ts src/lib/security/fetch-with-safe-redirects.test.ts src/lib/security/trim-trailing-char.test.ts src/app/api/poliweb-proxy/poliweb-proxy.test.ts src/app/api/calendar/company/events/events.test.ts src/app/api/pdf-extract/pdf-extract.test.ts src/app/api/avaliacao/avaliacoes/alias.test.ts src/services/caLookupService.test.ts`

## Child DOX Index

_(none)_
