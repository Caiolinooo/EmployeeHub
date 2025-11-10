# Guia de Implementação - Novo Sistema de Avaliação Sem Pesos

## 📋 Visão Geral

Este documento descreve a implementação completa do novo sistema de avaliação de desempenho do EmployeeHub, que remove completamente os pesos e implementa um fluxo automatizado com notificações.

## 🎯 Objetivos

- ✅ Remover todos os pesos das questões do questionário
- ✅ Implementar cálculo de médias simples (1-5)
- ✅ Dividir competência "Liderança" em duas: "Delegar" e "Desenvolvimento de equipe"
- ✅ Unificar "Pontualidade" e "Comprometimento"
- ✅ Automatizar fluxo com notificações
- ✅ Implementar sistema de aprovação com comentários obrigatórios

## 🏗️ Arquitetura do Sistema

### 1. Camada de Dados (Supabase)

#### Tabelas Principais

```sql
ciclos_avaliacao              -- Ciclos anuais de avaliação
avaliacoes_desempenho        -- Avaliações individuais
auditoria_avaliacoes         -- Logs de auditoria
notificacoes_avaliacao       -- Sistema de notificações
criterios_avaliacao          -- Critérios configuráveis
```

#### Estrutura de Dados

```typescript
interface Avaliacao {
  id: string;
  ciclo_id: string;
  funcionario_id: string;
  avaliador_id?: string;
  status: 'pendente' | 'em_andamento' | 'aguardando_gerente' | 'aprovado' | 'devolvido' | 'finalizado';
  dados_colaborador?: DadosColaborador;
  dados_gerente?: DadosGerente;
  resultado?: ResultadoAvaliacao;
  // ... timestamps
}
```

### 2. Camada de Serviços

#### AvaliacaoWorkflowService

```typescript
// Métodos principais
abrirCicloAnual(ano: number): Promise<string>
salvarAutoavaliacao(avaliacaoId, funcionarioId, dados): Promise<boolean>
submeterAvaliacaoColaborador(avaliacaoId, funcionarioId, dados): Promise<boolean>
aprovarAvaliacao(avaliacaoId, gerenteId, dados): Promise<boolean>
devolverAvaliacao(avaliacaoId, gerenteId, dados): Promise<boolean>
```

#### Cálculo de Médias

```typescript
function calcularMediaSimples(
  notas: Record<string, number>,
  criterios: CriterioAvaliacao[]
): ResultadoAvaliacao {
  // Implementação sem pesos
  // Média geral: soma das notas / quantidade
  // Média por competência: média simples por grupo
}
```

### 3. Camada de API

#### Endpoints Implementados

```
GET  /api/avaliacao-workflow/ciclos              -- Listar ciclos
POST /api/avaliacao-workflow/ciclos              -- Criar ciclo
GET  /api/avaliacao-workflow/avaliacoes/[id]     -- Obter avaliação
PATCH /api/avaliacao-workflow/avaliacoes/[id]     -- Salvar rascunho
POST /api/avaliacao-workflow/avaliacoes/[id]     -- Submeter/aprovar/devolver
GET  /api/avaliacao-workflow/relatorios           -- Gerar relatórios
POST /api/avaliacao-workflow/relatorios           -- Exportar dados
```

## 🚀 Passos de Implementação

### Passo 1: Configurar Banco de Dados

1. **Executar migração SQL:**
   ```bash
   # Copie e cole o conteúdo de NOVO_SISTEMA_AVALIACAO.sql no Supabase SQL Editor
   # Execute em etapas para garantir integridade
   ```

2. **Aplicar Foreign Keys:**
   ```bash
   npm run db:apply-foreign-keys
   # Ou execute manualmente FIX_FOREIGN_KEYS.sql
   ```

3. **Migrar Dados Antigos:**
   ```sql
   SELECT * FROM migrar_avaliacoes_antigas();
   ```

### Passo 2: Atualizar Aplicação Frontend

1. **Atualizar Componentes:**
   - `FormularioAutoavaliacao.tsx` - Usar novas funções de cálculo
   - `InterfaceAprovacaoGerente.tsx` - Implementar fluxo de aprovação
   - `SeletorEstrelas.tsx` - Manter interface 1-5

2. **Atualizar Contextos e Hooks:**
   - Integrar novo serviço de workflow
   - Remover referências a pesos

### Passo 3: Configurar Notificações

1. **Service Worker:** `public/notifications-sw.js`
2. **Push API:** `src/lib/push.ts`
3. **Template de Notificações:** Configurar mensagens padrão

### Passo 4: Testes e Validação

1. **Executar Testes Gherkin:**
   ```bash
   # Use ferramenta como Cucumber.js ou Cypress
   npx cypress run --spec "tests/avaliacao-workflow.feature"
   ```

2. **Testes Manuais:**
   - Criar ciclo de avaliação
   - Testar fluxo completo colaborador → gerente
   - Validar cálculos sem pesos
   - Verificar notificações

## 📊 Novo Modelo de Competências

### Critérios do Colaborador (Questões 11-14)

1. **Pontos Fortes** (q11-pontos-fortes)
2. **Áreas de Melhoria** (q12-areas-melhoria)
3. **Objetivos Alcançados** (q13-objetivos-alcancados)
4. **Planos de Desenvolvimento** (q14-planos-desenvolvimento)

### Critérios do Gerente

1. **Pontualidade e Comprometimento** (unificado)
2. **Liderança - Delegar** (dividido)
3. **Liderança - Desenvolvimento de Equipe** (dividido)
4. **Comentário do Avaliador** (q15-comentario-avaliador) - *OBRIGATÓRIO*

## 🔄 Fluxo do Processo

```
1. ABERTURA DO CICLO
   ├── Criar ciclo anual
   ├── Gerar avaliações para todos os funcionários
   └── Notificar colaboradores (abertura_ciclo)

2. RESPOSTA DO COLABORADOR
   ├── Responder questões 11-14
   ├── Salvar rascunhos (opcional)
   ├── Submeter avaliação
   └── Status: "aguardando_gerente"

3. REVISÃO DO GERENTE
   ├── Visualizar respostas
   ├── Adicionar notas das competências
   ├── Preencher comentário (questão 15)
   └── Decidir: aprovar OU devolver

4. APROVAÇÃO
   ├── Status: "aprovado"
   ├── Notificar colaborador
   ├── Consolidar no histórico
   └── Gerar relatórios

5. DEVOLUÇÃO
   ├── Status: "devolvido"
   ├── Notificar colaborador com motivo
   ├── Colaborador ajusta e reenvia
   └── Retornar ao passo 2
```

## 📈 Cálculo de Resultados

### Fórmulas

```
Média Geral = (Soma de todas as notas) / (Quantidade de notas respondidas)

Média por Competência = (Soma das notas da competência) / (Quantidade de notas da competência)

Arredondamento:
- Exibição: 1 casa decimal
- Armazenamento: 2 casas decimais
```

### Exemplo Prático

```
Notas: [4, 3, 5, 4] (4 competências)
Média Geral = (4 + 3 + 5 + 4) / 4 = 4.0

Liderança - Delegar: 4
Liderança - Desenvolvimento: 3
Média Liderança = (4 + 3) / 2 = 3.5
```

## 🔐 Permissões e Segurança

### Níveis de Acesso

1. **Colaborador:**
   - Responder questões 11-14
   - Visualizar próprio histórico
   - Editar apenas antes de submeter ou quando devolvido

2. **Gerente/Avaliador:**
   - Visualizar avaliações da equipe
   - Avaliar competências (notas 1-5)
   - Preencher comentário obrigatório (questão 15)
   - Aprovar ou devolver avaliações

3. **RH/Admin:**
   - Configurar ciclos de avaliação
   - Gerenciar critérios
   - Acessar todos os relatórios
   - Visualizar auditoria completa

### Auditoria

Todos os eventos são registrados:
- Abertura/fechamento de ciclos
- Submissão de avaliações
- Aprovações e devoluções
- Alterações de dados
- Acesso não autorizado (tentativas)

## 📧 Sistema de Notificações

### Tipos de Notificação

1. **abertura_ciclo:** Novo ciclo disponível
2. **submissao_colaborador:** Avaliação pronta para revisão
3. **revisao_gerente:** Nova avaliação para analisar
4. **aprovacao:** Avaliação aprovada
5. **devolucao:** Avaliação devolvida para ajustes
6. **reenvio:** Avaliação reenviada após ajustes

### Canais

- **In-App:** Centro de notificações
- **Push:** Browser push notifications
- **Email:** Notificações por email (opcional)

## 📊 Relatórios

### Relatórios Disponíveis

1. **Resumo do Ciclo:**
   - Total de avaliações
   - Status distribution
   - Taxa de conclusão

2. **Relatório Individual:**
   - Médias por competência
   - Média geral
   - Comentários do gerente
   - Histórico de alterações

3. **Relatório de Equipe:**
   - Performance por gerente
   - Comparativo entre equipes
   - Identificação de outliers

4. **Exportação:**
   - PDF: Relatório visual com gráficos
   - XLSX: Dados brutos para análise
   - CSV: Formato simplificado

## 🧪 Testes de Aceitação

### Cenários Críticos

1. **Fluxo Completo:**
   - Colaborador responde → Gerente avalia → Aprovação
   - Colaborador responde → Gerente devolve → Ajuste → Aprovação

2. **Validações:**
   - Comentário obrigatório para aprovação
   - Campos obrigatórios do colaborador
   - Permissões de acesso

3. **Cálculos:**
   - Médias sem pesos
   - Arredondamento correto
   - Tratamento de valores vazios

### Testes Automatizados

```gherkin
Feature: Avaliação anual sem pesos no EmployeeHub
  Scenario: Colaborador responde e submete avaliação
    When "Maria" acessa sua avaliação pendente
    And responde todas as perguntas 11–14 usando a escala 1–5
    And submete a avaliação
    Then o status da avaliação muda para "aguardando_gerente"
    And "João" recebe uma notificação de nova submissão
    And a média geral e por competência são calculadas por média simples
```

## 🔄 Migração de Dados

### Conversão de Avaliações Antigas

1. **Remover pesos:** Converter ponderadas para médias simples
2. **Mapear competências:** Adaptar critérios antigos para novo modelo
3. **Preservar histórico:** Manter registros de auditoria
4. **Validar integridade:** Verificar consistência dos dados migrados

### Script de Migração

```sql
SELECT * FROM migrar_avaliacoes_antigas();
```

## 🚨 Rollback

Em caso de problemas, execute:

1. **Restaurar backup do banco**
2. **Reverter código para versão anterior**
3. **Comunicar usuários sobre interrupção**
4. **Investigar causa do problema**

## 📞 Suporte e Troubleshooting

### Problemas Comuns

1. **Foreign Keys Faltando:**
   ```bash
   npm run db:apply-foreign-keys
   ```

2. **Cálculos Incorretos:**
   - Verificar se `calcularMediaSimples` está sendo usado
   - Validar estrutura dos dados de entrada

3. **Notificações Não Funcionando:**
   - Verificar configuração do service worker
   - Testar permissões de push notifications

4. **Permissões Negadas:**
   - Verificar políticas RLS no Supabase
   - Validar papéis dos usuários

### Logs Importantes

- Backend: `console.log` no serviço de workflow
- Frontend: DevTools Console
- Banco: Logs de auditoria
- Notificações: Centro de notificações

## 📈 Métricas de Sucesso

### KPIs de Adoção

- Taxa de conclusão de avaliações
- Tempo médio por etapa do fluxo
- % de devoluções vs aprovações diretas
- Engajamento com notificações

### Métricas Técnicas

- Performance dos cálculos de média
- Taxa de entrega de notificações
- Tempo de resposta das APIs
- Uso de memória e CPU

## 🔄 Roadmap Futuro

### Versão 1.1 (Próximo Ciclo)

- Integração com metas OKRs
- Avaliações 360° (múltiplos avaliadores)
- Gamificação com badges
- Mobile app nativo

### Versão 2.0

- IA para análise preditiva
- Planos de desenvolvimento automáticos
- Integração com sistemas de RH
- Relatórios avançados com ML

---

**Este guia deve ser atualizado conforme a implementação evolui. Mantenha documentação sincronizada com o código.**