# Auditoria mobile — artefatos

## Purpose

Screenshots e métricas da Fase 1 mobile-first (viewports 375×812 e 390×844). Sem UI.

## Ownership

- Pasta: `docs/mobile-audit/`
- Plano: `docs/mobile-first-plan.md`
- Script: `scripts/mobile-audit-screenshots.mjs`

## Local Contracts

- Nenhum segredo, token ou `.env` nesta pasta.
- PNGs são prova de rotas públicas / gate. Módulos autenticados = auditoria por código no plano.
- Regenerar: app local + `node scripts/mobile-audit-screenshots.mjs`.

## Work Guidance

- Preferir `mcp-*.png` + `login`/`register`/`chat` como evidência de UI real.
- `metrics.json` lista overflow e alvos &lt; 44 px.

## Verification

- Abrir `metrics.json` e conferir `totals.ok`.
- Login/register sem overflow X (`overflowX: false`).

## Child DOX Index

_(none)_
