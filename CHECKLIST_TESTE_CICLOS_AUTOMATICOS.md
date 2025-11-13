# ✅ Checklist de Teste - Sistema de Ciclos Automáticos

## 📋 Pré-requisitos
- [ ] Banco de dados Supabase configurado
- [ ] Variáveis de ambiente corretas (.env.local)
- [ ] Build compilado sem erros (`npm run build`)
- [ ] Aplicação rodando (`npm run dev` ou `npm start`)

---

## 🧪 Testes de Fluxo Completo

### 1️⃣ SETUP INICIAL (Admin)

#### 1.1 Criar Período de Avaliação
- [ ] Login como admin
- [ ] Navegar para módulo de Avaliações
- [ ] Criar novo período com:
  - [ ] Nome: "Teste Ciclo Automático Q1"
  - [ ] Descrição: "Teste do sistema de detecção automática"
  - [ ] Data Início: **Hoje** (ou data passada)
  - [ ] Data Fim: **Hoje + 30 dias**
  - [ ] Data Limite Autoavaliação: **Hoje + 15 dias**
  - [ ] Ativo: ✅ **Marcado**
- [ ] Salvar período
- [ ] Anotar UUID do período: `_______________________`

#### 1.2 Configurar Colaborador-Gerente
- [ ] No admin, ir para "Gerenciar Colaborador-Gerente"
- [ ] Selecionar:
  - [ ] Colaborador de teste
  - [ ] Gerente de teste
  - [ ] Período criado (ou deixar null para global)
- [ ] Salvar mapeamento
- [ ] Anotar UUID do colaborador: `_______________________`
- [ ] Anotar UUID do gerente: `_______________________`

---

### 2️⃣ DETECÇÃO AUTOMÁTICA (Colaborador)

#### 2.1 Verificar Dashboard
- [ ] Fazer logout do admin
- [ ] Login como **colaborador de teste**
- [ ] Navegar para `/avaliacao`
- [ ] **Verificar seção "Períodos Ativos - Preencha Sua Avaliação"**
  - [ ] Card do período criado está visível
  - [ ] Nome do período está correto
  - [ ] Descrição aparece
  - [ ] Datas estão formatadas em pt-BR

#### 2.2 Verificar Badge do Card
- [ ] Badge mostra status correto:
  - [ ] 🟢 "Período Ativo" (se >7 dias restantes)
  - [ ] 🟠 "Encerra em X dias" (se 4-7 dias)
  - [ ] 🔴 "Encerra em X dias" (se ≤3 dias)
- [ ] Ícone do badge está visível
- [ ] Cor do badge corresponde ao status

#### 2.3 Verificar Informações do Card
- [ ] Período exibido com ícone de calendário
- [ ] Data início formatada: `dd/MM/yyyy`
- [ ] Data fim formatada: `dd/MM/yyyy`
- [ ] Prazo autoavaliação exibido (se configurado)
- [ ] Botão "Iniciar Minha Avaliação" habilitado
- [ ] Botão com ícone ▶ (Play)
- [ ] Hover no botão muda aparência

---

### 3️⃣ CRIAR AVALIAÇÃO (Colaborador)

#### 3.1 Iniciar Avaliação
- [ ] Clicar no botão "Iniciar Minha Avaliação"
- [ ] Verificar loading spinner aparece
- [ ] **Aguardar redirecionamento para `/avaliacao/preencher/[id]`**
- [ ] URL contém UUID da avaliação
- [ ] Anotar UUID da avaliação: `_______________________`

#### 3.2 Verificar Validações da API
**Teste com período inativo**:
- [ ] Admin: Desativar período (`ativo = false`)
- [ ] Colaborador: Tentar iniciar
- [ ] Deve mostrar: "Período não encontrado ou inativo"

**Teste com período futuro**:
- [ ] Admin: Mudar `data_inicio` para amanhã
- [ ] Colaborador: Tentar iniciar
- [ ] Deve mostrar: "Este período ainda não iniciou"
- [ ] Mensagem deve incluir data de início

**Teste sem gerente**:
- [ ] Admin: Deletar mapping colaborador-gerente
- [ ] Colaborador: Tentar iniciar
- [ ] Deve mostrar: "Gerente não configurado"
- [ ] Mensagem deve incluir hint para contatar admin

---

### 4️⃣ PREENCHER AUTOAVALIAÇÃO (Colaborador)

#### 4.1 Verificar Página de Preenchimento
- [ ] URL: `/avaliacao/preencher/[id]`
- [ ] **Cabeçalho**:
  - [ ] Título: "Autoavaliação"
  - [ ] Botão "Voltar" funcional
  - [ ] Período exibido
  - [ ] Nome do colaborador exibido
- [ ] **Box de Instruções**:
  - [ ] 📋 Título "Instruções"
  - [ ] Lista de passos para colaborador
  - [ ] Fundo azul claro
  - [ ] Border azul

#### 4.2 Verificar Seção de Autoavaliação
- [ ] **Seção "Autoavaliação (Colaborador)" visível**
- [ ] Ícone de usuário azul
- [ ] Texto: "Questões 11-14 • Sua percepção sobre seu desempenho"
- [ ] Seção está expandida por padrão
- [ ] Clique no header recolhe/expande seção (animação suave)

#### 4.3 Verificar Questões Q11-Q14
- [ ] **4 cards de questão visíveis**
- [ ] Cada card tem:
  - [ ] Número da questão (badge gradiente azul-roxo)
  - [ ] Texto da pergunta em negrito
  - [ ] Descrição/contexto (se houver)
  - [ ] Sistema de estrelas (5 estrelas)
  - [ ] Campo de comentário (textarea)
  - [ ] Indicador "* Campo obrigatório" (se aplicável)

#### 4.4 Testar Avaliação por Estrelas
- [ ] **Questão Q11**: Clicar em diferentes estrelas
  - [ ] Estrelas preenchem até a selecionada
  - [ ] Hover mostra tooltip com descrição da nota
  - [ ] Cor amarela quando selecionada
  - [ ] Contador "X / 5" aparece
- [ ] Repetir para Q12, Q13, Q14

#### 4.5 Testar Comentários
- [ ] **Q11**: Digitar comentário de teste
  - [ ] Textarea aceita texto
  - [ ] Placeholder visível quando vazio
  - [ ] Texto não excede limite (se houver)
- [ ] Repetir para Q12, Q13, Q14

#### 4.6 Salvar Rascunho
- [ ] Preencher **apenas Q11 e Q12** (parcial)
- [ ] Clicar "Salvar Rascunho"
- [ ] **Verificar**:
  - [ ] Loading spinner no botão
  - [ ] Mensagem de sucesso (verde) aparece
  - [ ] Mensagem desaparece após 3 segundos
  - [ ] Status continua "pendente_autoavaliacao"
- [ ] Recarregar página (`F5`)
- [ ] **Verificar persistência**:
  - [ ] Q11 e Q12 mantêm valores salvos
  - [ ] Q13 e Q14 estão vazias

#### 4.7 Validação de Campos Obrigatórios
- [ ] Deixar Q13 vazia
- [ ] Clicar "Enviar para Aprovação"
- [ ] **Verificar**:
  - [ ] Mensagem de erro (vermelha) aparece
  - [ ] Erro indica qual questão está incompleta
  - [ ] Não redireciona
  - [ ] Status não muda

#### 4.8 Enviar para Aprovação
- [ ] Preencher **todas as questões Q11-Q14**
  - [ ] Q11: 5 estrelas + comentário
  - [ ] Q12: 4 estrelas + comentário
  - [ ] Q13: 5 estrelas + comentário
  - [ ] Q14: 4 estrelas + comentário
- [ ] Clicar "Enviar para Aprovação"
- [ ] **Verificar**:
  - [ ] Loading spinner no botão
  - [ ] **Redireciona para `/avaliacao/ver/[id]`**
  - [ ] Status mudou para "pendente_aprovacao_gerente"
  - [ ] URL tem `?success=true`

#### 4.9 Verificar Bloqueio Pós-Envio
- [ ] Tentar acessar `/avaliacao/preencher/[id]` novamente
- [ ] **Deve redirecionar para `/avaliacao/ver/[id]`**
- [ ] Mensagem: "Você não pode mais editar esta avaliação"

---

### 5️⃣ REVISÃO GERENCIAL (Gerente)

#### 5.1 Login como Gerente
- [ ] Fazer logout do colaborador
- [ ] Login como **gerente de teste**
- [ ] Navegar para `/avaliacao`

#### 5.2 Encontrar Avaliação Pendente
- [ ] **Lista de avaliações**:
  - [ ] Avaliação criada está visível
  - [ ] Status: "Pendente Aprovação Gerente"
  - [ ] Badge amarelo/azul
  - [ ] Nome do colaborador correto
  - [ ] Período correto

#### 5.3 Acessar Preenchimento Gerencial
- [ ] Clicar na avaliação
- [ ] Redireciona para visualização
- [ ] Clicar "Editar" ou ir direto para `/avaliacao/preencher/[id]`

#### 5.4 Verificar Página do Gerente
- [ ] URL: `/avaliacao/preencher/[id]`
- [ ] **Cabeçalho**:
  - [ ] Título: "Avaliação Gerencial"
  - [ ] Texto: "Sua função: Gestor Avaliador"
  - [ ] Colaborador exibido
- [ ] **Instruções para Gerente**:
  - [ ] Texto: "Avalie o desempenho nas questões 15-17"
  - [ ] Texto: "Revise a autoavaliação (11-14)"
  - [ ] Texto: "Forneça feedback construtivo"

#### 5.5 Verificar Seção de Autoavaliação (Read-Only)
- [ ] **Seção "Autoavaliação (Colaborador)" visível**
- [ ] Pode expandir/recolher
- [ ] Questões Q11-Q14 visíveis
- [ ] Estrelas mostram notas do colaborador (preenchidas)
- [ ] Comentários do colaborador visíveis
- [ ] **Campos NÃO editáveis** (read-only)

#### 5.6 Verificar Seção Gerencial
- [ ] **Seção "Avaliação Gerencial" visível**
- [ ] Ícone de usuários (roxo)
- [ ] Texto: "Questões 15-17 • Avaliação do gestor direto"
- [ ] Seção expandida por padrão
- [ ] **3 cards de questão (Q15, Q16, Q17)**

#### 5.7 Preencher Avaliação Gerencial
- [ ] **Q15**: Selecionar 5 estrelas + comentário
- [ ] **Q16**: Selecionar 4 estrelas + comentário
- [ ] **Q17**: Selecionar 5 estrelas + comentário
- [ ] Verificar tooltips funcionam
- [ ] Verificar contadores "X / 5" aparecem

#### 5.8 Salvar Rascunho (Gerente)
- [ ] Preencher apenas Q15
- [ ] Clicar "Salvar Rascunho"
- [ ] Mensagem de sucesso
- [ ] Status continua "pendente_aprovacao_gerente"
- [ ] Recarregar página
- [ ] Q15 mantém valor, Q16/Q17 vazias

#### 5.9 Finalizar Avaliação
- [ ] Preencher **todas Q15-Q17**
- [ ] Clicar "Finalizar Avaliação"
- [ ] **Verificar**:
  - [ ] Loading spinner
  - [ ] **Redireciona para `/avaliacao/ver/[id]`**
  - [ ] Status mudou para "concluida"
  - [ ] **`nota_final` calculada** (média de Q11-Q17)

#### 5.10 Verificar Cálculo de Nota Final
- [ ] Abrir avaliação concluída
- [ ] **Nota Final exibida**:
  - [ ] Média correta: `(5+4+5+4+5+4+5) / 7 = 4.57`
  - [ ] Formato: 2 casas decimais
  - [ ] Localização: Card de resumo ou header

#### 5.11 Verificar Bloqueio Pós-Conclusão
- [ ] Tentar acessar `/avaliacao/preencher/[id]` novamente
- [ ] **Deve bloquear com mensagem**:
  - [ ] "Avaliação já foi concluída"
  - [ ] Ou redirecionar para visualização

---

### 6️⃣ VALIDAÇÕES DE PERMISSÃO

#### 6.1 Colaborador Tenta Editar Após Enviar
- [ ] Login como colaborador
- [ ] Tentar `PATCH /api/avaliacao/[id]` com status "pendente_aprovacao_gerente"
- [ ] **Deve retornar erro 400**:
  - [ ] "Você não pode mais editar esta avaliação"
  - [ ] Hint: "Já foi enviada para aprovação do gerente"

#### 6.2 Gerente Tenta Editar Antes do Colaborador
- [ ] Criar nova avaliação (status "pendente_autoavaliacao")
- [ ] Login como gerente
- [ ] Tentar acessar `/avaliacao/preencher/[id]`
- [ ] **Deve redirecionar com erro**:
  - [ ] "Aguardando o colaborador finalizar a autoavaliação"

#### 6.3 Usuário Não Relacionado
- [ ] Criar 3º usuário (não é colaborador nem gerente)
- [ ] Login como 3º usuário
- [ ] Tentar acessar `/avaliacao/preencher/[id]`
- [ ] **Deve redirecionar com erro 403**:
  - [ ] "Você não tem permissão para acessar esta avaliação"

#### 6.4 Transição de Status Inválida
- [ ] Tentar mudar status de "pendente_autoavaliacao" direto para "concluida"
- [ ] **Deve retornar erro 400**:
  - [ ] "Transição de status inválida"
  - [ ] Listar transições permitidas

---

### 7️⃣ TESTES DE UI/UX

#### 7.1 Responsividade
- [ ] **Desktop (>1024px)**:
  - [ ] Cards em grid 3 colunas
  - [ ] Questionário legível
  - [ ] Botões bem posicionados
- [ ] **Tablet (768-1024px)**:
  - [ ] Cards em grid 2 colunas
  - [ ] Layout ajusta
- [ ] **Mobile (<768px)**:
  - [ ] Cards em coluna única
  - [ ] Estrelas clicáveis
  - [ ] Botões ocupam largura total

#### 7.2 Animações
- [ ] Cards aparecem sequencialmente (delay 0.05s * index)
- [ ] Seções expandem/recolhem suavemente
- [ ] Botões têm feedback de hover/tap
- [ ] Transições entre páginas sem flickering

#### 7.3 Acessibilidade
- [ ] Tab navigation funciona
- [ ] Focus visible em botões/inputs
- [ ] Labels associados a inputs
- [ ] Mensagens de erro anunciáveis

#### 7.4 Mensagens de Feedback
- [ ] Sucesso (verde): aparece e some automaticamente
- [ ] Erro (vermelho): persiste até próxima ação
- [ ] Loading states claros
- [ ] Hints informativos quando aplicável

---

### 8️⃣ TESTES DE EDGE CASES

#### 8.1 Período Próximo (Não Iniciado)
- [ ] Admin: Criar período com `data_inicio = amanhã`
- [ ] Colaborador: Verificar dashboard
- [ ] **Card aparece em "Próximos Períodos"**:
  - [ ] Badge azul: "Inicia em 1 dia"
  - [ ] Botão: "Disponível em breve" (desabilitado)
  - [ ] Clicar não faz nada

#### 8.2 Período Expirando
- [ ] Admin: Mudar `data_limite_autoavaliacao` para hoje+2 dias
- [ ] Colaborador: Verificar card
- [ ] **Badge vermelho**: "Encerra em 2 dias"
- [ ] Cor de alerta (border vermelho)

#### 8.3 Avaliação Existente
- [ ] Criar avaliação para período X
- [ ] Clicar "Iniciar" novamente no card
- [ ] **API deve retornar avaliação existente**:
  - [ ] `isNew: false`
  - [ ] Redireciona para mesma avaliação

#### 8.4 Múltiplos Períodos Ativos
- [ ] Admin: Criar 3 períodos ativos simultâneos
- [ ] Colaborador: Verificar dashboard
- [ ] **Deve mostrar 3 cards** na seção "Períodos Ativos"
- [ ] Cada um independente

#### 8.5 Sem Períodos
- [ ] Admin: Desativar todos os períodos
- [ ] Colaborador: Verificar dashboard
- [ ] **Seção "Períodos Ativos" vazia ou mensagem**:
  - [ ] "Nenhum período ativo no momento"

---

### 9️⃣ TESTES DE INTEGRAÇÃO DB

#### 9.1 Verificar Dados Salvos
```sql
-- Executar no Supabase SQL Editor
SELECT 
  id,
  funcionario_id,
  gerente_id,
  periodo_id,
  status,
  respostas,
  nota_final,
  created_at,
  updated_at
FROM avaliacoes_desempenho
WHERE id = 'uuid-da-avaliacao-criada';
```
- [ ] `funcionario_id` correto
- [ ] `gerente_id` correto
- [ ] `periodo_id` correto
- [ ] `status` atualizado conforme fluxo
- [ ] `respostas` é JSONB válido
- [ ] `nota_final` calculado quando concluído
- [ ] `updated_at` atualiza a cada PATCH

#### 9.2 Verificar Estrutura JSONB
```sql
SELECT respostas FROM avaliacoes_desempenho WHERE id = 'uuid';
```
**Estrutura esperada**:
```json
{
  "Q11": { "nota": 5, "comentario": "..." },
  "Q12": { "nota": 4, "comentario": "..." },
  "Q13": { "nota": 5, "comentario": "..." },
  "Q14": { "nota": 4, "comentario": "..." },
  "Q15": { "nota": 5, "comentario": "..." },
  "Q16": { "nota": 4, "comentario": "..." },
  "Q17": { "nota": 5, "comentario": "..." }
}
```
- [ ] Todas as chaves Q11-Q17 presentes
- [ ] Cada uma tem `nota` e `comentario`
- [ ] Tipos corretos (número e string)

#### 9.3 Verificar RLS Policies
- [ ] Colaborador consegue SELECT sua própria avaliação
- [ ] Gerente consegue SELECT avaliações de seus colaboradores
- [ ] Usuário não relacionado NÃO consegue SELECT
- [ ] Ambos conseguem UPDATE respeitando permissões de status

---

### 🔟 TESTES DE PERFORMANCE

#### 10.1 Tempo de Carregamento
- [ ] Dashboard (`/avaliacao`) carrega em <2s
- [ ] Página de preenchimento carrega em <1s
- [ ] API `/iniciar-periodo` responde em <500ms
- [ ] PATCH `/api/avaliacao/[id]` responde em <300ms

#### 10.2 Otimizações
- [ ] Cards usam `initial/animate` do Framer Motion (lazy)
- [ ] Queries Supabase fazem joins eficientes
- [ ] Sem re-renders desnecessários no client

---

## 📊 Resumo de Resultados

### Cobertura de Testes
- [ ] **Setup Inicial**: ___% completo
- [ ] **Detecção Automática**: ___% completo
- [ ] **Criação de Avaliação**: ___% completo
- [ ] **Preenchimento Colaborador**: ___% completo
- [ ] **Revisão Gerencial**: ___% completo
- [ ] **Validações de Permissão**: ___% completo
- [ ] **UI/UX**: ___% completo
- [ ] **Edge Cases**: ___% completo
- [ ] **Integração DB**: ___% completo
- [ ] **Performance**: ___% completo

### Bugs Encontrados
| # | Descrição | Severidade | Status |
|---|-----------|------------|--------|
| 1 |           | [ ] Alta [ ] Média [ ] Baixa | [ ] Corrigido |
| 2 |           | [ ] Alta [ ] Média [ ] Baixa | [ ] Corrigido |
| 3 |           | [ ] Alta [ ] Média [ ] Baixa | [ ] Corrigido |

### Notas Adicionais
```
[Espaço para observações durante o teste]









```

---

## ✅ Aprovação Final

- [ ] **Todos os testes passaram**
- [ ] **Sem bugs bloqueadores**
- [ ] **Performance aceitável**
- [ ] **UX aprovada pela equipe**
- [ ] **Documentação atualizada**
- [ ] **Pronto para deploy em staging**

**Testado por**: ______________________  
**Data**: ___/___/2025  
**Versão**: 1.0.0  

---

**Próximos Passos**:
1. Deploy em ambiente de staging
2. Teste com usuários reais (UAT)
3. Ajustes finais baseados em feedback
4. Deploy em produção
5. Monitoramento pós-deploy
