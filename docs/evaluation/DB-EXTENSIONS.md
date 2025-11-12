# Extensões de Banco para Avaliação (Adições Seguras)

Data: 2025-11-12

Este documento descreve as adições não disruptivas feitas ao banco para suportar:
- Respostas detalhadas por pergunta (11–17)
- Salvamento de rascunhos (drafts)
- Ajustes de critérios (peso, visibilidade, obrigatoriedade)
- Configurações de cálculo/visibilidade (global e por período)

## Tabelas Criadas
- `avaliacao_respostas`:
  - Armazena notas/comentários por pergunta e respondente (`collaborator`/`manager`).
  - Chave única: `(avaliacao_id, pergunta_id, respondente_tipo)`.
  - Índices: `avaliacao_id`, `pergunta_id`.

- `avaliacao_drafts`:
  - Rascunhos por avaliação e respondente.
  - Campos: `conteudo` (JSONB), `progresso` (0–100), timestamps.
  - Única por `(avaliacao_id, respondente_tipo)`.

- `avaliacao_config`:
  - Vincula usuários a papéis de avaliador (`manager`/`leader`).
  - Seed automático baseado em `users_unified.role`.

- `avaliacao_settings`:
  - Configurações de cálculo e obrigatoriedade.
  - Escopo `global` ou `periodo` (`periodo_id` opcional).
  - `calculo.method`: `simple_average` (padrão) ou `weighted`.

## Ajustes em Tabelas Existentes
Se existirem, as tabelas `criterios` e/ou `criterios_avaliacao` recebem colunas:
- `peso NUMERIC(6,2) DEFAULT 1`
- `visibilidade_roles TEXT[]`
- `obrigatorio_roles TEXT[]`
- `tipo_calculo TEXT`
- `ativo BOOLEAN DEFAULT TRUE`

Índices adicionais em `ativo` e `ordem` (idempotentes).

## View
- `vw_avaliacoes_desempenho` foi recriada condicionalmente:
  - Prefere `avaliacao_ciclos` se existir; senão `ciclos_avaliacao`; senão sem join de ciclo.
  - Inclui `media_geral` e `total_respostas` calculados a partir de `avaliacao_respostas`.

## RLS
- `avaliacao_respostas` e `avaliacao_drafts`: leitura/escrita apenas para `funcionario_id` ou `avaliador_id` da avaliação.
- `avaliacao_config` e `avaliacao_settings`: leitura pública; apenas `ADMIN` pode inserir/alterar.

## Funções
- `calcular_media_avaliacao(avaliacao_id)` retorna média com 1 casa decimal.
- Trigger `atualizar_media_avaliacao` mantém `updated_at` da avaliação ao inserir/atualizar respostas.

## Serviço de Configuração (Cliente)
Arquivo: `src/lib/services/evaluation-settings.ts`
- `getEffectiveSettings(periodoId?)`: retorna config ativa do período ou global.
- `calculateScore(notas, settings)`: suporta `simple_average` e `weighted`.

## Observações
- Migração é aditiva e idempotente, compatível com estruturas já existentes no repositório.
- Não altera contratos de APIs existentes; novas capacidades serão plugadas gradualmente.
