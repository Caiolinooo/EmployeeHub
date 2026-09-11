---
name: sobe-o-git
description: Fluxo de release do Painel ABZ — verifica (testes, tsc, build), sobe a versão, atualiza CHANGELOG/README e commita+pusha na branch atual (portal). Use quando o usuário pedir para "subir o git", versionar, fechar release, commitar e mandar as mudanças.
---

# Sobe o Git — release do Painel ABZ

Fluxo completo para fechar um lote de mudanças. Siga na ordem; não pule a verificação.

## 1. Verificar

- Testes dos módulos tocados: `npx tsx --test src/lib/<modulo>/*.test.ts`
- Verificações de script quando existirem (ex.: `npx tsx scripts/verify-escala-contagem.ts`)
- `npx tsc --noEmit` — zero erros **nos arquivos tocados** (erros pré-existentes em outros arquivos não bloqueiam)
- `npm run build` — obrigatório para release; se falhar, PARAR e consertar antes de subir
- Lint dos arquivos tocados: `npx eslint <arquivos>` — sem erro novo

## 2. Versionar

- Descubra a versão atual no `package.json`. Bump:
  - fix pontual → patch (5.76.**1**)
  - lote de correções/melhorias visíveis → minor (5.**77**.0)
- `npm version X.Y.Z --no-git-tag-version` (atualiza package.json + package-lock.json)
- `CHANGELOG.md`: entrada nova no topo, formato `## [X.Y.Z] - YYYY-MM-DD` com título de seção e itens numerados em **negrito** (PT-BR, mesmo estilo das entradas anteriores)
- `README.md`: atualizar `**Versão:**` (linha 5) e a seção `## Nesta versão (X.Y.Z)` (3-4 bullets do que mudou para o usuário)

## 3. Subir

- Branch de trabalho: `portal` (main só via PR)
- `git status` — revise o que vai entrar. **Nunca** commitar:
  - `.claude/settings.local.json`
  - `scripts/_tmp_*` (rascunhos de sessão)
  - `.env*`
- `git add` **apenas os arquivos da mudança** (código tocado + CHANGELOG + README + package.json + package-lock.json + novos arquivos intencionais como scripts/agents/skills)
- Commit no padrão do repo:
  - release: `chore(release): vX.Y.Z — resumo curto em PT-BR.`
  - fix pontual: `fix(escopo): o que conserta.`
  - Fechar com: `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- `git push origin portal`

## 4. Reportar

Ao final diga: versão, quantidade de arquivos, hash do commit, e o que ficou de fora (arquivos ignorados de propósito).
