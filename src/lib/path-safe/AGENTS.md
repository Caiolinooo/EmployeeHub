# Path-safe — DOX

## Purpose

Helper puro para resolver caminhos de usuário contra um diretório-base fixo, sem path traversal.

## Ownership

- `src/lib/path-safe/resolve-inside.ts`
- Consumidores: `debug-utils`, `reimbursement-settings-local`, `files/create-folder`, `avaliacao/import-criterios`

## Local Contracts

- `resolveInside(base, input, { asName? })` usa `path.resolve(base, input)`.
- Rejeita null byte (`\0` / `%00`), `..`, caminho absoluto fora da base, e `rel` absoluto.
- `asName: true` exige um único segmento em `^[A-Za-z0-9._-]+$` (sem `/`, sem `.` / `..`).
- Decodifica `%xx` até 5 vezes (cobre `..%2f` e `..%252f`).
- Rotas: input válido mantém shape/status; path inválido → 400 no formato já usado pela rota.

## Work Guidance

- Primeiro argumento de `console.*` / `util.format` é string constante; valores externos vão em args ou `%s`.
- Não logar token, senha, código de verificação ou URL que os contenha.

## Verification

```bash
npx tsx --test src/lib/path-safe/resolve-inside.test.ts
```

## Child DOX Index

(none)
