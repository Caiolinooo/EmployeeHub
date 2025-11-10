# language: pt
Feature: Avaliação anual sem pesos no EmployeeHub

  Background:
    Given existe um ciclo anual aberto para o ano corrente
    And o colaborador "Maria" é elegível e possui gerente "João"
    And o questionário do ciclo usa o template avaliação.xlsx mapeando perguntas 11–14 para o colaborador e 15 para o comentário do gerente
    And o sistema não utiliza pesos em nenhuma pergunta

  Scenario: Colaborador responde e submete avaliação
    When "Maria" acessa sua avaliação pendente
    And responde todas as perguntas 11–14 usando a escala 1–5
    And submete a avaliação
    Then o status da avaliação muda para "aguardando_gerente"
    And "João" recebe uma notificação de nova submissão
    And a média geral e por competência são calculadas por média simples

  Scenario: Gerente revisa, comenta e aprova
    Given a avaliação de "Maria" está em "aguardando_gerente"
    When "João" abre a avaliação
    And insere o comentário do avaliador na pergunta 15
    And aprova a avaliação
    Then o status muda para "aprovado_pelo_gerente"
    And "Maria" é notificada da aprovação
    And o registro é consolidado no histórico com carimbo de data e hora

  Scenario: Gerente devolve para ajustes
    Given a avaliação de "Maria" está em "aguardando_gerente"
    When "João" devolve a avaliação com motivo "Detalhar exemplos na pergunta 12"
    Then o status muda para "devolvido_para_ajustes"
    And "Maria" é notificada com o motivo
    When "Maria" edita as respostas e reenvia
    Then o status retorna para "aguardando_gerente"
    And "João" é notificado do reenvio

  Scenario: Bloqueio de aprovação sem comentário
    Given a avaliação está "aguardando_gerente"
    When o gerente tenta aprovar sem preencher a pergunta 15 (comentário)
    Then a aprovação é bloqueada com mensagem "Comentário do avaliador é obrigatório"

  Scenario: Relatório sem pesos
    Given existem avaliações aprovadas no ciclo
    When RH gera o relatório em PDF e XLSX
    Then os cálculos não utilizam pesos
    And as competências exibidas incluem "Liderança – Delegar", "Liderança – Desenvolvimento de equipe" e "Pontualidade e comprometimento"
    And o relatório contém médias por competência, média geral, comentários dos gerentes e timestamps

  Scenario: Permissões de edição
    Given o colaborador submeteu a avaliação
    When o colaborador tenta editar sem que haja devolução
    Then a edição é negada
    And um evento de auditoria é registrado

  Scenario: Compatibilidade retroativa
    Given existem avaliações históricas com pesos
    When o processo de migração é executado
    Then as notas históricas são recalculadas por média simples
    And as competências antigas são remapeadas conforme a nova taxonomia
    And nenhum campo de peso permanece acessível nos relatórios

  Scenario: Notificações automáticas do ciclo
    When um novo ciclo de avaliação é aberto
    Then todos os colaboradores elegíveis recebem notificação de "abertura_ciclo"
    And as avaliações são criadas com status "pendente"
    And o sistema registra a data de abertura do ciclo

  Scenario: Cálculo de médias simplificado
    Given uma avaliação com as seguintes notas: Pontualidade=4, Liderança-Delegar=3, Liderança-Desenvolvimento=5
    When o sistema calcula o resultado
    Then a média geral é 4.0 (média simples de 4, 3, 5)
    And a média por competência é exibida sem pesos
    And o arredondamento utiliza uma casa decimal para exibição

  Scenario: Validação de dados obrigatórios
    When o colaborador tenta submeter a avaliação sem responder a questão 12
    Then o sistema bloqueia a submissão
    And exibe mensagem "Questão 12: Áreas de melhoria é obrigatória"
    And a avaliação permanece em status "em_andamento"

  Scenario: Auditoria completa do processo
    Given uma avaliação passa por todo o fluxo
    When o processo é finalizado
    Then todos os eventos são registrados com timestamp
    And as transições de status são auditadas
    And os dados anteriores e novos são armazenados para histórico