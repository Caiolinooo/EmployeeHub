# e-Social lib — DOX

## Purpose

Geração, validação e auto-correção de eventos e-Social (S-2220 e correlatos). Cadastro operacional continua em `gt_*`.

## Ownership

- Sanitização `TS_nome`: `ts-nome.ts`
- Datas civis PT-BR: `esocial-date.ts` (`normalizeEsocialDate`, `alinharDataExamePtBr`, `corrigirXmlDatasS2220PtBr`)
- Auto-correção: `esocialAutoCorrector.ts` (usado por `preEnvioGateway.ts` e `POST .../eventos/[id]/validar` e `/enviar`)
- XML S-2220: `eventos/s-2220.ts` + `src/services/eSocialService.ts` (`generateEventXML`)

## Local Contracts

- `nmMed` / `nmResp` / `nmTrab` / `nmSoc` seguem `TS_nome` (2–70; letras, espaço, `'`, `.`, `-`). Sem quebra de linha.
- OCR de ASO costuma colar cargo (`Médica`) e lixo (`à Á`) no nome. `sanitizeTsNome` remove título/lixo e rebuilda o XML. Botão **Validar Auto-Correção** e o pré-envio usam o mesmo caminho.
- Rejeição só de schema/XSD (sem recibo): `POST .../validar` limpa `protocolo_envio` para permitir reenvio original.
- Geradores nunca emitem nome cru do OCR.
- Datas de ASO/exame: sempre DD/MM (PT-BR), mesmo se o laudo misturar MM/DD inglês. `10/08/2026` e `08/10/2026` no mesmo ASO de 10 de agosto viram `2026-08-10`. `dtExm` que é swap de `dtAso` (ex. `2026-10-08` vs `2026-08-10`) alinha em `dtAso`. Nunca `Date.parse`. XML existente: `corrigirXmlDatasS2220PtBr` + Validar Auto-Correção.

## Work Guidance

- Novo campo de nome no XML: passar por `sanitizeTsNome` na emissão e no auto-corrector.
- Não tratar `medico` objeto como string (`esp.medico.nmMed`).
- Nova data de ASO/exame: passar por `normalizeEsocialDate` / `alinharDataExamePtBr` (nunca `Date.parse`).

## Verification

- `npx tsx --test src/lib/e-social/ts-nome.test.ts src/lib/e-social/esocialAutoCorrector.test.ts src/lib/e-social/esocial-date.test.ts`
- Caso Renan / Thalia: `Thalia Leal Dibo\nMédica\nà Á` → `Thalia Leal Dibo` no XML. Validar Auto-Correção + Enviar.
- Caso datas: XML com `dtAso=2026-08-10` e `dtExm=2026-10-08` → Validar Auto-Correção deixa todos `dtExm=2026-08-10`.

## Child DOX Index

_(none)_
