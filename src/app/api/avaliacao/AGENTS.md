# Avaliação API alias — DOX

## Purpose

`/api/avaliacao/avaliacoes/[id]` é alias de `/api/avaliacao-desempenho/avaliacoes/[id]`.

## Ownership

- `avaliacoes/[id]/route.ts` — delega aos handlers de desempenho
- `avaliacoes/[id]/alias.ts` — UUID + delegate sem HTTP

## Local Contracts

- Sem `fetch` e sem host derivado de `request.url` / `Host`.
- UUID inválido: `{ success: false, error: 'ID inválido. O ID deve ser um UUID válido.', timestamp }` status 400.
- UUID válido: chama `GET`/`PUT`/`DELETE` de `avaliacao-desempenho` (mesmo shape).

## Work Guidance

Não reintroduzir self-HTTP. Novo método no desempenho = reexportar/delegar aqui.

## Verification

- `npx tsx --test src/app/api/avaliacao/avaliacoes/alias.test.ts`

## Child DOX Index

_(none)_
