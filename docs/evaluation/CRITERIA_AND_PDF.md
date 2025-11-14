# Avaliação: Critérios e Exportação de PDF

Este documento resume os endpoints e componentes adicionados para gerenciar critérios de avaliação, método de cálculo e exportação de PDF.

## Endpoints

- `GET /api/avaliacao/criterios`
  - Lista critérios ativos (`criterios_avaliacao`), ordenados por `ordem`.
- `POST /api/avaliacao/criterios`
  - Cria novo critério. Campos: `nome` (obrigatório), `descricao`, `categoria`, `tipo` (default `gerente`), `apenas_lideres` (bool), `ordem` (number), `peso` (number).
- `PATCH /api/avaliacao/criterios/:id`
  - Atualiza um critério. Qualquer campo acima é aceito.
- `DELETE /api/avaliacao/criterios/:id`
  - Desativa o critério via `ativo=false` (soft delete).
- `GET /api/avaliacao/settings`
  - Retorna as configurações efetivas do cálculo (globais/período). Campo principal: `calculo.method` (`simple_average` ou `weighted`).
- `PATCH /api/avaliacao/settings`
  - Atualiza o método de cálculo; respeita precedência do feature-flag.
- `GET /api/avaliacao/:id/pdf`
  - Gera PDF (binário base64) com resumo da avaliação usando `pdf-lib`.

Todas as respostas seguem `{ success, data, error, timestamp }` quando aplicável.

## UI/Componentes

- `src/components/admin/avaliacao/CriteriosManager.tsx`
  - CRUD completo de critérios com `peso`, `ordem`, `apenas_lideres`.
- `src/app/avaliacao/ver/[id]/page.tsx`
  - Botão "Exportar PDF" e download do arquivo `.pdf`.
  - Card "Resumo da Avaliação" com método de cálculo e status.
  - Tabela de critérios ativos com pesos/ordem.

## Observações de Cálculo

- A média ponderada só é aplicada quando:
  1. `EVALUACAO_WEIGHTED_ENABLED` (env) estiver habilitado, e
  2. `settings.calculo.method` = `weighted` (DB/Admin).
- O serviço `EvaluationSettingsService` agrega as configurações e calcula scores conforme método definido.

## Dependências

- `pdf-lib` (já presente): usado para gerar PDFs em `/api/avaliacao/[id]/pdf`.

## Próximos passos sugeridos

- Incluir branding (logo, cores) no PDF.
- Exibir pesos efetivos por pergunta quando o método `weighted` estiver ativo.
- Adicionar testes básicos dos endpoints de critérios e exportação.
