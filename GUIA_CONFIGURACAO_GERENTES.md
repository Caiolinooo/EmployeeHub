# 🎯 GUIA COMPLETO: Configuração de Gerentes - Sistema de Avaliação

## 📋 Resumo das Correções Implementadas

### ✅ O Que Foi Corrigido

1. **Página `/admin/avaliacao/gerentes` Completamente Reescrita**
   - ❌ **Antes**: Usava API errada, tinha campo `lider_id` inexistente, salvamento não funcionava
   - ✅ **Agora**: Usa `/api/admin/gerentes-avaliacao`, mostra estatísticas, salvamento individual funcional

2. **Endpoint `/api/avaliacao/criterios` Corrigido**
   - ❌ **Antes**: Erro 500 por usar cliente Supabase sem permissões
   - ✅ **Agora**: Usa `getSupabaseAdminClient()` com logs detalhados

3. **Validação Anti-Autogerenciamento**
   - ✅ Não permite configurar alguém como gerente de si mesmo
   - ✅ Validação tanto no frontend quanto na função de salvamento

4. **UI Melhorada**
   - ✅ Cards de estatísticas (Total Usuários, Gerentes, Mapeados)
   - ✅ Badges de status (Configurado/Pendente)
   - ✅ Filtros por departamento e cargo
   - ✅ Busca por nome/email
   - ✅ Exibe gerente atual de cada colaborador

---

## 🚀 Como Usar o Sistema (2 Formas)

### **Opção 1: Pela Interface Web (Recomendado)**

#### Passo 1: Acessar a Página de Configuração
```
http://localhost:3000/admin/avaliacao/gerentes
```

#### Passo 2: Visualizar Estatísticas
Você verá 3 cards no topo:
- **Total de Usuários**: Todos os usuários ativos e autorizados
- **Gerentes Configurados**: Quantos usuários são gerentes de pelo menos 1 colaborador
- **Colaboradores Mapeados**: Quantos colaboradores têm um gerente definido

#### Passo 3: Configurar Gerentes
1. **Buscar Colaborador**: Use a barra de busca ou filtros
2. **Selecionar Gerente**: No dropdown da coluna "Gerente (Avaliador)", escolha quem avaliará este colaborador
3. **Repetir**: Configure todos os colaboradores necessários
4. **Salvar**: Clique em "Salvar Todas Alterações" (canto superior direito)

#### Passo 4: Verificar Status
- ✅ **Badge Verde "Configurado"**: Colaborador tem gerente
- ⚠️ **Badge Amarelo "Pendente"**: Colaborador SEM gerente (não receberá avaliações!)

---

### **Opção 2: Pelo Banco de Dados (SQL)**

Se você preferir ou tiver muitos usuários para configurar, use o SQL:

#### Passo 1: Abrir SQL Editor no Supabase
```
Dashboard → SQL Editor → New Query
```

#### Passo 2: Ver Usuários Disponíveis
```sql
SELECT 
  id, 
  first_name, 
  last_name, 
  email, 
  role,
  position
FROM users_unified 
WHERE active = true 
  AND is_authorized = true
ORDER BY role DESC, first_name ASC;
```

#### Passo 3: Criar Mapeamento
```sql
INSERT INTO avaliacao_colaborador_gerente (
  colaborador_id,
  gerente_id,
  ativo,
  periodo_id
) VALUES (
  'UUID_DO_COLABORADOR',  -- ← Cole o ID do colaborador aqui
  'UUID_DO_GERENTE',      -- ← Cole o ID do gerente aqui
  true,
  NULL  -- NULL = vale para todos os períodos
)
ON CONFLICT (colaborador_id, periodo_id) 
WHERE periodo_id IS NULL
DO UPDATE SET 
  gerente_id = EXCLUDED.gerente_id,
  ativo = true,
  updated_at = NOW();
```

#### Passo 4: Verificar Mapeamentos
```sql
SELECT 
  c.first_name || ' ' || c.last_name as colaborador,
  g.first_name || ' ' || g.last_name as gerente,
  acg.ativo,
  acg.created_at
FROM avaliacao_colaborador_gerente acg
JOIN users_unified c ON c.id = acg.colaborador_id
JOIN users_unified g ON g.id = acg.gerente_id
WHERE acg.ativo = true
ORDER BY c.first_name;
```

---

## 🔧 Resolução de Problemas Comuns

### ❌ Problema: "Gerente não configurado para este usuário"

**Causa**: O colaborador não tem registro na tabela `avaliacao_colaborador_gerente`

**Solução**:
1. Acesse `/admin/avaliacao/gerentes`
2. Procure o usuário na lista
3. Selecione um gerente no dropdown
4. Clique em "Salvar Todas Alterações"

OU use o SQL de configuração rápida em `CONFIGURAR_GERENTE_RAPIDO.sql`

---

### ❌ Problema: "Erro 500 em /api/avaliacao/criterios"

**Causa**: Tabela `criterios_avaliacao` não existe ou RLS está bloqueando

**Solução**:
```sql
-- Verificar se a tabela existe
SELECT * FROM criterios_avaliacao LIMIT 1;

-- Se não existir, criar critérios padrão
INSERT INTO criterios_avaliacao (nome, descricao, categoria, tipo, ordem, peso, ativo) VALUES
('Qualidade do Trabalho', 'Precisão, profundidade e qualidade das entregas', 'desempenho', 'gerente', 1, 1, true),
('Produtividade', 'Volume e velocidade de entregas', 'desempenho', 'gerente', 2, 1, true),
('Iniciativa', 'Proatividade e busca de soluções', 'comportamento', 'gerente', 3, 1, true),
('Trabalho em Equipe', 'Colaboração e comunicação', 'comportamento', 'gerente', 4, 1, true),
('Pontualidade', 'Cumprimento de prazos', 'desempenho', 'gerente', 5, 1, true);
```

---

### ❌ Problema: "Não consigo setar quem o gerente gerencia"

**Explicação**: A UI funciona ao contrário do que você espera:
- ❌ Não se escolhe "quem este gerente gerencia"
- ✅ Se escolhe "quem é o gerente deste colaborador"

**Como Fazer Corretamente**:
1. Procure o **COLABORADOR** na lista (não o gerente!)
2. Na linha do colaborador, selecione quem será o **GERENTE** dele
3. Salve

**Exemplo**:
```
João Silva (colaborador) → Selecionar gerente: Maria Santos
Pedro Costa (colaborador) → Selecionar gerente: Maria Santos
Ana Souza (colaborador) → Selecionar gerente: Carlos Oliveira
```

Resultado: Maria Santos é gerente de João e Pedro. Carlos é gerente de Ana.

---

### ❌ Problema: "Erro: Um usuário não pode ser gerente de si mesmo"

**Causa**: Você tentou selecionar o próprio colaborador como gerente dele

**Solução**: Escolha outro usuário. A validação impede loops e autoavaliação indevida.

---

## 📊 Como Funciona o Fluxo de Avaliação

### 1. **Período Ativo Criado** (Admin cria em `/admin/avaliacao/periodos`)
```
Ciclo Q4 2025
Data Início: 01/11/2025
Data Fim: 31/12/2025
```

### 2. **Gerentes Configurados** (Admin em `/admin/avaliacao/gerentes`)
```
João Silva → Gerente: Maria Santos
Pedro Costa → Gerente: Maria Santos
```

### 3. **Sistema Cria Avaliações Automaticamente**
- Cron job roda diariamente
- Verifica períodos ativos
- Busca colaboradores com gerente configurado
- Cria avaliações com status `pendente_autoavaliacao`

### 4. **Colaborador Vê Período Disponível**
```
/avaliacao → Card "Ciclo Q4 2025" → Botão "Iniciar Minha Avaliação"
```

### 5. **Colaborador Preenche Autoavaliação**
```
Perguntas Q11-Q14 (notas 1-5 + comentários)
Envia → Status muda para "pendente_aprovacao_gerente"
```

### 6. **Gerente Revisa e Completa**
```
Vê respostas Q11-Q14 do colaborador
Preenche Q15-Q17 (avaliação do gerente)
Envia → Status muda para "concluida"
```

### 7. **Nota Final Calculada**
```
Média das 7 perguntas (Q11-Q17)
PDF gerado automaticamente
Notificações enviadas
```

---

## 🔐 Permissões e Regras

### **Quem Pode Fazer O Quê**

| Ação | Colaborador | Gerente | Admin |
|------|-------------|---------|-------|
| Ver própria avaliação | ✅ | ✅ | ✅ |
| Preencher Q11-Q14 (autoavaliação) | ✅ | ❌ | ❌ |
| Preencher Q15-Q17 (avaliação gerente) | ❌ | ✅ | ✅ |
| Ver avaliações de outros | ❌ | ✅ (seus liderados) | ✅ |
| Configurar gerentes | ❌ | ❌ | ✅ |
| Criar períodos | ❌ | ❌ | ✅ |

### **Regras de Status**

| Status | Quem Pode Editar | Próxima Ação |
|--------|------------------|--------------|
| `pendente_autoavaliacao` | Colaborador | Preencher Q11-Q14 e enviar |
| `pendente_aprovacao_gerente` | Gerente | Preencher Q15-Q17 e enviar |
| `concluida` | Ninguém | Visualizar PDF/Relatório |
| `cancelada` | Ninguém | - |

---

## 🛠️ Troubleshooting Técnico

### **Logs no Console**

Agora todos os endpoints têm logs com emojis:

```javascript
// /api/avaliacao/iniciar-periodo
🔐 Verificando autenticação...
✅ Usuário autenticado: 75abe69b-...
📋 Dados recebidos: { userId, periodo_id }
✅ Período encontrado: Ciclo Q4 2025
🔍 Buscando gerente para colaborador: 75abe69b-...
✅ Gerente encontrado: abc123-...
📝 Criando nova avaliação...
✅ Avaliação criada com sucesso: def456-...

// /api/avaliacao/criterios
🔍 Buscando critérios de avaliação...
✅ 5 critérios encontrados
```

### **Verificar Estado do Sistema**

```sql
-- 1. Verificar períodos ativos
SELECT * FROM periodos_avaliacao WHERE ativo = true;

-- 2. Verificar mapeamentos gerente-colaborador
SELECT 
  c.first_name || ' ' || c.last_name as colaborador,
  g.first_name || ' ' || g.last_name as gerente
FROM avaliacao_colaborador_gerente acg
JOIN users_unified c ON c.id = acg.colaborador_id
JOIN users_unified g ON g.id = acg.gerente_id
WHERE acg.ativo = true;

-- 3. Verificar avaliações criadas
SELECT 
  a.id,
  a.status,
  c.first_name || ' ' || c.last_name as colaborador,
  p.nome as periodo
FROM avaliacoes_desempenho a
JOIN users_unified c ON c.id = a.funcionario_id
JOIN periodos_avaliacao p ON p.id = a.periodo_id
WHERE a.deleted_at IS NULL
ORDER BY a.created_at DESC;
```

---

## 📝 Checklist para Testar

### **Teste 1: Configurar Gerente Pela UI**
- [ ] Acessar `/admin/avaliacao/gerentes`
- [ ] Ver lista de colaboradores
- [ ] Selecionar gerente no dropdown
- [ ] Clicar em "Salvar Todas Alterações"
- [ ] Ver mensagem de sucesso
- [ ] Badge mudar de "Pendente" para "Configurado"

### **Teste 2: Criar Avaliação On-Demand**
- [ ] Fazer login como colaborador
- [ ] Acessar `/avaliacao`
- [ ] Ver card de período ativo
- [ ] Clicar em "Iniciar Minha Avaliação"
- [ ] Redirecionar para `/avaliacao/preencher/[id]`
- [ ] Ver formulário Q11-Q14

### **Teste 3: Preencher Autoavaliação**
- [ ] Preencher estrelas (1-5) em Q11-Q14
- [ ] Adicionar comentários
- [ ] Clicar em "Salvar Rascunho" (opcional)
- [ ] Clicar em "Enviar Autoavaliação"
- [ ] Ver mensagem de sucesso
- [ ] Status mudar para "Aguardando Aprovação do Gerente"

### **Teste 4: Gerente Completar Avaliação**
- [ ] Fazer login como gerente
- [ ] Acessar `/avaliacao`
- [ ] Ver avaliação com status "Pendente Aprovação"
- [ ] Clicar para abrir
- [ ] Ver respostas Q11-Q14 do colaborador
- [ ] Preencher Q15-Q17
- [ ] Enviar
- [ ] Status mudar para "Concluída"

---

## 🎓 Perguntas Frequentes (FAQ)

### **P: Posso ter mais de um gerente para o mesmo colaborador?**
R: Não atualmente. Cada colaborador tem 1 gerente por período. Se `periodo_id = NULL`, o mapeamento é global.

### **P: Como remover um gerente?**
R: Na página `/admin/avaliacao/gerentes`, selecione "Selecione um gerente" (opção vazia) e salve.

### **P: O que acontece se eu mudar o gerente depois da avaliação criada?**
R: A avaliação já criada continua com o gerente original. Novas avaliações usarão o novo gerente.

### **P: Posso configurar gerentes específicos por período?**
R: Sim! No SQL, use `periodo_id` ao invés de `NULL`. Mas a UI atual só suporta mapeamentos globais.

### **P: Como ver quem são os liderados de um gerente específico?**
R: Execute:
```sql
SELECT 
  c.first_name || ' ' || c.last_name as colaborador,
  c.email,
  c.department
FROM avaliacao_colaborador_gerente acg
JOIN users_unified c ON c.id = acg.colaborador_id
WHERE acg.gerente_id = 'UUID_DO_GERENTE'
  AND acg.ativo = true;
```

---

## 📞 Suporte

Se ainda tiver problemas:

1. **Verificar logs do terminal** (emojis 🔐 ✅ ❌ ajudam a identificar o problema)
2. **Verificar console do navegador** (F12)
3. **Executar queries de verificação SQL** (seção Troubleshooting Técnico)
4. **Criar issue no repositório** com prints dos logs

---

## 🎉 Conclusão

Agora você tem:
- ✅ UI funcional para configurar gerentes
- ✅ Validações anti-erro
- ✅ Logs detalhados para debug
- ✅ Duas formas de configurar (UI e SQL)
- ✅ Sistema de avaliação completo funcionando

**Próximos passos recomendados**:
1. Configurar gerentes de todos os colaboradores
2. Criar um período de teste
3. Testar fluxo completo (colaborador → gerente → conclusão)
4. Ajustar perguntas do questionário conforme necessário
5. Ativar cron job para criação automática de avaliações

Boa sorte! 🚀
