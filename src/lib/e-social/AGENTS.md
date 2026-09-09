# e-Social lib — DOX

## Purpose

Geração, validação e auto-correção de eventos e-Social (S-2220 e correlatos). Cadastro operacional continua em `gt_*`.

## Ownership

- Sanitização `TS_nome`: `ts-nome.ts`
- Auto-correção: `esocialAutoCorrector.ts` (usado por `preEnvioGateway.ts` e `POST .../eventos/[id]/validar` e `/enviar`)
- XML S-2220: `eventos/s-2220.ts` + `src/services/eSocialService.ts` (`generateEventXML`)

## Local Contracts

- `nmMed` / `nmResp` / `nmTrab` / `nmSoc` seguem `TS_nome` (2–70; letras, espaço, `'`, `.`, `-`). Sem quebra de linha.
- OCR de ASO costuma colar cargo (`Médica`) e lixo (`à Á`) no nome. `sanitizeTsNome` remove título/lixo e rebuilda o XML. Botão **Validar Auto-Correção** e o pré-envio usam o mesmo caminho.
- Rejeição só de schema/XSD (sem recibo): `POST .../validar` limpa `protocolo_envio` para permitir reenvio original.
- Geradores nunca emitem nome cru do OCR.

## Work Guidance

- Novo campo de nome no XML: passar por `sanitizeTsNome` na emissão e no auto-corrector.
- Não tratar `medico` objeto como string (`esp.medico.nmMed`).

## Verification

- `npx tsx --test src/lib/e-social/ts-nome.test.ts src/lib/e-social/esocialAutoCorrector.test.ts`
- Caso Renan / Thalia: `Thalia Leal Dibo\nMédica\nà Á` → `Thalia Leal Dibo` no XML. Validar Auto-Correção + Enviar.

## Child DOX Index

_(none)_
