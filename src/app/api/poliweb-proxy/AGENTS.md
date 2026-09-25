# Poliweb proxy — DOX

## Purpose

Proxy autenticado para o host único `poliweb.policlinicamacae.com.br`.

## Ownership

- `route.ts`, `[...path]/route.ts`
- URL: `src/lib/security/safe-url.ts` (`resolvePoliwebUrl`, `shouldRewriteProxiedHtmlUrl`)

## Local Contracts

- Fetch só `https://poliweb.policlinicamacae.com.br` + path validado (`new URL(path, POLIWEB_BASE)`).
- Path de query/`[...path]` que escape o host é 502.
- Rewrite de `href`/`src`/`action`: `URL.protocol` bloqueia `javascript:`, `data:`, `vbscript:`.

## Work Guidance

Não acrescentar host extra sem atualizar `POLIWEB_HOST` e os testes.

## Verification

- `npx tsx --test src/app/api/poliweb-proxy/poliweb-proxy.test.ts src/lib/security/safe-url.test.ts`

## Child DOX Index

_(none)_
