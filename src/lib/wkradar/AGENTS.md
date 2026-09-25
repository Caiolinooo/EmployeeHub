# WK Radar TLS pin — DOX

## Purpose

Cliente pull-only da RadarAPI (`wk.groupabz.com`) com validação TLS ligada e pin SHA-256 do certificado autoassinado `CN=WKSistemas`.

## Ownership

- `tls-pin.ts` — `createWkHttpsAgent`, `checkWkServerIdentity`, `wkHttpsRequestJson`
- `wk-ca.pem` — PEM público do pin (handshake only)
- `api-client.ts` — GET/login usam o agent pinado
- `scripts/wk-extrair-api.ts` — mesmo helper (`node:https`), sem `fetch` global e sem `NODE_TLS_REJECT_UNAUTHORIZED`

## Local Contracts

- `rejectUnauthorized: true` sempre. Nunca `false`. Nunca `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- `checkServerIdentity` compara `cert.fingerprint256` com o pin. Sem compare → não retorna `undefined`.
- Host do cert (`CN=WKSistemas`) não bate com `wk.groupabz.com`. O pin substitui a checagem de hostname.
- Handshake falhou por cert/fingerprint → `WK Radar TLS pin mismatch: o certificado de wk.groupabz.com mudou; atualize o pin conforme src/lib/wkradar/AGENTS.md`

### Pin atual (2026-09-25)

- Host: `wk.groupabz.com:443`
- SHA-256: `40:AB:FB:8C:B5:AE:15:30:1D:D8:52:1C:B8:77:4B:5E:68:DE:7B:B4:37:3B:16:BB:69:E4:72:A6:01:11:B5:46`
- `notBefore`: Dec  6 16:44:40 2021 GMT
- `notAfter`: Dec  6 16:54:40 2121 GMT (`2121-12-06T16:54:40.000Z`)

## Work Guidance

Re-fixar **só por handshake** (sem path de API, sem credencial):

```
openssl s_client -connect wk.groupabz.com:443 -servername wk.groupabz.com -showcerts </dev/null
openssl x509 -noout -fingerprint -sha256 -dates -subject -issuer
```

Atualize `wk-ca.pem`, `WK_PINNED_CA_PEM`, `WK_PIN_FINGERPRINT256` e `WK_PIN_NOT_AFTER`.

## Verification

- `npx tsx --test src/lib/wkradar/tls-pin.test.ts`
- Servidor TLS local: fingerprint certo conecta; fingerprint errado → mensagem de pin mismatch
- Grep-teste: `rejectUnauthorized: false` e `NODE_TLS_REJECT_UNAUTHORIZED` ausentes em `api-client.ts`, `tls-pin.ts`, `scripts/wk-extrair-api.ts`

## Child DOX Index

_(none)_
