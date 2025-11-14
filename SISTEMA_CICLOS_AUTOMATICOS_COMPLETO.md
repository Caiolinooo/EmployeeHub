# 🎯 Sistema de Detecção Automática de Ciclos de Avaliação - Implementação Completa

## 📋 Resumo Executivo

Implementamos um **sistema automático de detecção de ciclos de avaliação** que permite aos colaboradores visualizar períodos de avaliação criados pelo admin e preencher suas autoavaliações de forma intuitiva e guiada.

---

## ✅ O Que Foi Implementado

### 1. **Detecção Automática de Períodos** 📅

**Arquivo**: `src/services/evaluationService.ts`

**Funções Criadas**:
- `getAvailablePeriods(userId)` - Detecta períodos ativos e próximos
  - **Períodos Ativos**: `hoje BETWEEN data_inicio AND data_fim AND ativo = true`
  - **Períodos Próximos**: `data_inicio > hoje AND data_inicio <= hoje + 14 dias`
  
- `getMyEvaluationForPeriod(userId, periodoId)` - Verifica se já existe avaliação
- `getManagerForUser(userId, periodoId)` - Busca gerente configurado

**Lógica de Negócio**:
```typescript
// Ativo: período já começou e ainda não terminou
const ativo = hoje >= data_inicio && hoje <= data_fim && ativo === true

// Próximo: período começa nos próximos 14 dias
const proximo = data_inicio > hoje && data_inicio <= hoje + 14 dias
```

---

### 2. **Cards de Período com Ação** 🎴

**Arquivo**: `src/components/avaliacao/ActivePeriodCard.tsx`

**Características**:
- ✅ Design responsivo com Framer Motion
- ✅ Badges dinâmicos baseados em proximidade:
  - 🟢 Verde: Período ativo, mais de 7 dias restantes
  - 🟠 Laranja: Período ativo, 4-7 dias restantes
  - 🔴 Vermelho: Período ativo, 3 dias ou menos
  - 🔵 Azul: Período próximo, ainda não iniciado
- ✅ Botões de ação:
  - "Iniciar Minha Avaliação" (período ativo sem avaliação)
  - "Continuar Avaliação" (avaliação já iniciada)
  - "Disponível em breve" (período próximo)
- ✅ Indicadores de dias restantes/início
- ✅ Informações do período (nome, descrição, datas)

---

### 3. **API de Criação On-Demand** 🚀

**Arquivo**: `src/app/api/avaliacao/iniciar-periodo/route.ts`

**Endpoint**: `POST /api/avaliacao/iniciar-periodo`

**Fluxo**:
1. Verifica autenticação JWT
2. Valida se período existe e está ativo
3. Verifica se período já iniciou
4. Checa se já existe avaliação para o usuário
5. Busca gerente configurado na tabela `avaliacao_colaborador_gerente`
6. Cria avaliação com status `pendente_autoavaliacao`
7. Retorna avaliação criada para redirecionamento

**Validações Implementadas**:
- ❌ Período não encontrado ou inativo
- ❌ Período ainda não iniciou (com data de início)
- ❌ Gerente não configurado (com hint para admin)
- ✅ Retorna avaliação existente se já criada

---

### 4. **Interface de Preenchimento Q11-Q17** 📝

**Arquivos**:
- `src/app/avaliacao/preencher/[id]/page.tsx` (Server Component)
- `src/app/avaliacao/preencher/[id]/FillEvaluationClient.tsx` (Client Component)

**Funcionalidades**:
- ✅ Validação de permissões:
  - Colaborador: pode preencher se `status === 'pendente_autoavaliacao'`
  - Gerente: pode preencher se `status === 'pendente_aprovacao_gerente'`
- ✅ Usa o componente `QuestionarioAvaliacaoCardBased` existente
- ✅ Duas seções expansíveis:
  - **Autoavaliação (Q11-Q14)**: Colaborador avalia seu desempenho
  - **Avaliação Gerencial (Q15-Q17)**: Gerente avalia colaborador
- ✅ Sistema de respostas:
  - Avaliação por estrelas (1-5) com tooltips descritivos
  - Campo de comentários para cada questão
  - Validação de campos obrigatórios
- ✅ Ações:
  - **Salvar Rascunho**: Mantém status atual, salva progresso
  - **Enviar para Aprovação**: Muda status para `pendente_aprovacao_gerente`
  - **Finalizar Avaliação** (gerente): Muda status para `concluida`, calcula nota final

**Fluxo de Status**:
```
pendente_autoavaliacao (Colaborador preenche Q11-Q14)
         ↓
pendente_aprovacao_gerente (Gerente preenche Q15-Q17)
         ↓
concluida (Calcula nota final automaticamente)
```

---

### 5. **API de Atualização de Avaliação** 💾

**Arquivo**: `src/app/api/avaliacao/[id]/route.ts`

**Endpoints**:

#### `GET /api/avaliacao/[id]`
- Busca avaliação com dados relacionados (funcionario, gerente, periodo)
- Valida permissão (colaborador ou gerente)

#### `PATCH /api/avaliacao/[id]`
- Atualiza `respostas` e `status`
- **Validações de Transição**:
  - `pendente_autoavaliacao` → `pendente_aprovacao_gerente` ✅
  - `pendente_aprovacao_gerente` → `concluida` ✅
  - Outras transições: ❌ Bloqueadas
- **Permissões**:
  - Colaborador: só edita se `status === 'pendente_autoavaliacao'`
  - Gerente: só edita se `status === 'pendente_aprovacao_gerente'`
- **Cálculo Automático de Nota Final**:
  - Quando status muda para `concluida`
  - Média aritmética de todas as notas respondidas

---

### 6. **Dashboard Integrado** 🏠

**Arquivos**:
- `src/app/avaliacao/page.tsx` (Server Component - busca dados)
- `src/app/avaliacao/EvaluationListClient.tsx` (Client Component - renderiza UI)

**Layout**:
```
┌─────────────────────────────────────────┐
│  📋 Períodos Ativos - Preencha Sua Avaliação │
├─────────────────────────────────────────┤
│  [Card Verde 1] [Card Verde 2] [Card Verde 3]  │ ← Grid responsivo
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  📅 Próximos Períodos                      │
├─────────────────────────────────────────┤
│  [Card Azul 1] [Card Azul 2]               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  🔍 Filtros e Lista de Avaliações         │
└─────────────────────────────────────────┘
```

---

## 🗄️ Estrutura de Banco de Dados

### Tabela: `periodos_avaliacao`
```sql
id UUID PRIMARY KEY
nome VARCHAR(100)                   -- Ex: "Avaliação Q1 2025"
descricao TEXT                      -- Descrição do ciclo
data_inicio DATE                    -- Início do período
data_fim DATE                       -- Fim do período
data_limite_autoavaliacao DATE      -- Prazo para colaborador preencher
data_limite_aprovacao DATE          -- Prazo para gerente aprovar
ativo BOOLEAN                       -- Se o período está ativo
created_at TIMESTAMP
updated_at TIMESTAMP
```

### Tabela: `avaliacoes_desempenho`
```sql
id UUID PRIMARY KEY
funcionario_id UUID                 -- Colaborador sendo avaliado
gerente_id UUID                     -- Gerente responsável
avaliador_id UUID                   -- Gerente (mesmo que gerente_id)
periodo_id UUID                     -- Referência ao período
periodo VARCHAR(100)                -- Nome do período (denormalizado)
data_inicio DATE
data_fim DATE
status VARCHAR(50)                  -- Status do fluxo
respostas JSONB                     -- Estrutura Q11-Q17
nota_final DECIMAL                  -- Calculado ao concluir
comentario_avaliador TEXT
observacoes TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

### Tabela: `avaliacao_colaborador_gerente`
```sql
id UUID PRIMARY KEY
colaborador_id UUID                 -- Referência ao colaborador
gerente_id UUID                     -- Referência ao gerente
periodo_id UUID                     -- Opcional: específico para período
created_at TIMESTAMP
```

### Estrutura JSONB `respostas`
```json
{
  "Q11": {
    "nota": 4,
    "comentario": "Desenvolvi habilidades X e Y..."
  },
  "Q12": {
    "nota": 5,
    "comentario": "Entreguei todos os projetos no prazo..."
  },
  "Q13": { "nota": 3, "comentario": "..." },
  "Q14": { "nota": 4, "comentario": "..." },
  "Q15": { "nota": 5, "comentario": "..." },
  "Q16": { "nota": 4, "comentario": "..." },
  "Q17": { "nota": 5, "comentario": "..." }
}
```

---

## 🔄 Fluxo Completo do Usuário

### 1️⃣ Admin Cria Período
```sql
INSERT INTO periodos_avaliacao (
  nome, 
  descricao, 
  data_inicio, 
  data_fim,
  data_limite_autoavaliacao,
  ativo
) VALUES (
  'Avaliação Q1 2025',
  'Avaliação de desempenho do primeiro trimestre',
  '2025-01-01',
  '2025-03-31',
  '2025-02-15',
  true
);
```

### 2️⃣ Admin Configura Gerente
```sql
INSERT INTO avaliacao_colaborador_gerente (
  colaborador_id,
  gerente_id,
  periodo_id
) VALUES (
  'uuid-colaborador',
  'uuid-gerente',
  'uuid-periodo'
);
```

### 3️⃣ Sistema Detecta Automaticamente
- Serviço `getAvailablePeriods()` executa diariamente
- Período aparece automaticamente no dashboard do colaborador
- Card exibido na seção "Períodos Ativos" (se `hoje BETWEEN data_inicio AND data_fim`)

### 4️⃣ Colaborador Clica "Iniciar Minha Avaliação"
```
1. ActivePeriodCard onClick → fetch('/api/avaliacao/iniciar-periodo')
2. API valida período, cria avaliação com status 'pendente_autoavaliacao'
3. Redireciona para /avaliacao/preencher/[id]
4. Página carrega com QuestionarioAvaliacaoCardBased
5. Mostra seção "Autoavaliação (Q11-Q14)"
```

### 5️⃣ Colaborador Preenche Q11-Q14
```
- Clica em estrelas para avaliar (1-5)
- Digita comentários explicativos
- Pode salvar rascunho (mantém status)
- Clica "Enviar para Aprovação"
  → PATCH /api/avaliacao/[id] { status: 'pendente_aprovacao_gerente' }
  → Redireciona para /avaliacao/ver/[id]
```

### 6️⃣ Gerente Recebe Notificação (Futuro)
```
- Email/Push notification
- "Nova avaliação aguardando sua revisão"
```

### 7️⃣ Gerente Acessa Avaliação
```
1. Dashboard mostra avaliações pendentes
2. Clica "Revisar Avaliação"
3. Redireciona para /avaliacao/preencher/[id]
4. Página detecta isManager=true
5. Mostra duas seções:
   - Autoavaliação (Q11-Q14) - ReadOnly
   - Avaliação Gerencial (Q15-Q17) - Editável
```

### 8️⃣ Gerente Preenche Q15-Q17
```
- Revisa autoavaliação do colaborador
- Preenche Q15-Q17 com sua avaliação
- Clica "Finalizar Avaliação"
  → PATCH /api/avaliacao/[id] { status: 'concluida' }
  → API calcula nota_final (média de todas as notas)
  → Redireciona para /avaliacao/ver/[id]
```

---

## 🧪 Como Testar

### Teste 1: Criar Período no Admin
1. Acesse `/admin` (como admin)
2. Navegue até "Avaliações" → "Períodos"
3. Clique "Criar Novo Período"
4. Preencha:
   - Nome: "Teste Ciclo Automático"
   - Data Início: Hoje
   - Data Fim: +30 dias
   - Data Limite Autoavaliação: +15 dias
   - Ativo: ✅
5. Salvar

### Teste 2: Configurar Gerente
1. Ainda no admin, vá para "Gerenciar Colaborador-Gerente"
2. Selecione um colaborador
3. Selecione um gerente
4. Selecione o período criado (ou deixe null para global)
5. Salvar

### Teste 3: Verificar Detecção Automática
1. Faça login como o **colaborador** configurado
2. Acesse `/avaliacao`
3. Verifique se o card aparece em "Períodos Ativos - Preencha Sua Avaliação"
4. Badge deve mostrar "Período Ativo" (verde)

### Teste 4: Iniciar Avaliação
1. Clique no botão "Iniciar Minha Avaliação" no card
2. Aguarde redirecionamento para `/avaliacao/preencher/[id]`
3. Verifique cabeçalho com informações do período
4. Verifique seção "Autoavaliação (Colaborador)" expandida
5. Verifique perguntas Q11-Q14 visíveis

### Teste 5: Preencher Autoavaliação
1. Para cada questão (Q11-Q14):
   - Clique nas estrelas (1-5)
   - Digite comentário no campo de texto
2. Clique "Salvar Rascunho" (progresso salvo, status mantido)
3. Verifique mensagem de sucesso
4. Clique "Enviar para Aprovação"
5. Aguarde redirecionamento para `/avaliacao/ver/[id]`

### Teste 6: Gerente Revisa
1. Faça logout
2. Faça login como o **gerente** configurado
3. Acesse `/avaliacao`
4. Na lista, encontre a avaliação com status "Pendente Aprovação Gerente"
5. Clique para visualizar
6. Clique "Editar" ou vá direto para `/avaliacao/preencher/[id]`
7. Verifique:
   - Seção "Autoavaliação" visível mas read-only
   - Seção "Avaliação Gerencial" visível e editável
   - Perguntas Q15-Q17 habilitadas

### Teste 7: Finalizar Avaliação
1. Como gerente, preencha Q15-Q17
2. Clique "Finalizar Avaliação"
3. Aguarde redirecionamento
4. Verifique status mudou para "Concluída"
5. Verifique `nota_final` calculada (média de todas as notas)

### Teste 8: Validações de Permissão
1. Tente editar avaliação concluída (deve bloquear)
2. Colaborador tenta editar após enviar para gerente (deve bloquear)
3. Gerente tenta editar antes do colaborador finalizar (deve bloquear)

---

## 🔧 Correções Aplicadas

### ✅ Fix 1: Coluna `status` Não Existe
**Problema**: Query filtrava `periodos_avaliacao.status` mas coluna não existe no schema
**Solução**: Removido filtro `.in('status', [...])`, usando apenas `ativo` boolean e intervalos de data

### ✅ Fix 2: Supabase Admin Client
**Problema**: API usava `createClient(url, undefined)` porque variável de ambiente errada
**Solução**: Mudado para `await getSupabaseAdmin()` que gerencia fallback de env vars

### ✅ Fix 3: Status Incorreto na Criação
**Problema**: API criava avaliação com status `'pending_response'`
**Solução**: Mudado para `'pendente_autoavaliacao'` para consistência com fluxo

### ✅ Fix 4: Rota de Preenchimento Inexistente
**Problema**: Cards redirecionavam para `/avaliacao/ver/[id]` (visualização)
**Solução**: Criada rota `/avaliacao/preencher/[id]` específica para edição

### ✅ Fix 5: Endpoint PATCH Inexistente
**Problema**: Página de preenchimento chamava `PATCH /api/avaliacao/[id]` mas não existia
**Solução**: Criado endpoint com validações de permissão e transição de status

### ✅ Fix 6: getEvaluationById Sem Relações
**Problema**: Função não trazia dados de `funcionario`, `gerente`, `periodo`
**Solução**: Atualizado query com joins Supabase usando foreign keys

---

## 📁 Arquivos Criados/Modificados

### Criados ✨
```
src/app/avaliacao/preencher/[id]/page.tsx
src/app/avaliacao/preencher/[id]/FillEvaluationClient.tsx
src/app/api/avaliacao/iniciar-periodo/route.ts
src/app/api/avaliacao/[id]/route.ts
src/components/avaliacao/ActivePeriodCard.tsx
```

### Modificados 🔧
```
src/services/evaluationService.ts
  + getAvailablePeriods()
  + getMyEvaluationForPeriod()
  + getManagerForUser()
  ~ getEvaluationById() (adicionado joins)

src/app/avaliacao/page.tsx
  ~ Busca períodos ativos/próximos
  ~ Passa dados para client component

src/app/avaliacao/EvaluationListClient.tsx
  ~ Renderiza seções de períodos ativos/próximos
  ~ Grid de ActivePeriodCard
```

### Componente Reutilizado 🔄
```
src/components/avaliacao/QuestionarioAvaliacaoCardBased.tsx
  ✅ Já implementado com estrutura Q11-Q17
  ✅ Suporta isManager flag
  ✅ Seções expansíveis
  ✅ Star rating + comentários
  ✅ Validação de obrigatórios
```

---

## 🎨 Design e UX

### Paleta de Cores
```css
/* Períodos Ativos */
Verde (Ativo Normal):    border-green-200, bg-green-100, text-green-700
Laranja (Ativo Alerta):  border-orange-200, bg-orange-100, text-orange-700
Vermelho (Ativo Urgente): border-red-200, bg-red-100, text-red-700

/* Períodos Próximos */
Azul (Futuro):          border-blue-200, bg-blue-100, text-blue-700

/* Status */
Pendente Autoavaliação:  border-yellow-200, bg-yellow-50
Pendente Aprovação:      border-blue-200, bg-blue-50
Concluída:              border-green-200, bg-green-50
```

### Animações (Framer Motion)
```typescript
// Cards aparecem sequencialmente
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: index * 0.05 }}

// Botões têm hover/tap feedback
whileHover={{ scale: 1.02 }}
whileTap={{ scale: 0.98 }}

// Seções expansíveis com animação suave
initial={{ height: 0, opacity: 0 }}
animate={{ height: 'auto', opacity: 1 }}
exit={{ height: 0, opacity: 0 }}
```

---

## 🔮 Próximas Melhorias (Backlog)

### 1. Sistema de Notificações 🔔
- [ ] Email quando período se torna ativo
- [ ] Email quando colaborador envia para aprovação
- [ ] Email quando gerente finaliza avaliação
- [ ] Push notifications (já tem service worker)

### 2. Dashboard de Métricas 📊
- [ ] Gráfico de períodos ativos/concluídos
- [ ] Taxa de conclusão por período
- [ ] Média de notas por colaborador
- [ ] Comparativo de períodos

### 3. Relatórios PDF 📄
- [ ] Exportar avaliação concluída em PDF
- [ ] Incluir gráfico de radar com notas
- [ ] Histórico de avaliações do colaborador

### 4. Workflow Avançado ⚙️
- [ ] Múltiplos aprovadores (chain of command)
- [ ] Avaliação 360° (pares + subordinados)
- [ ] Plano de Desenvolvimento Individual (PDI)
- [ ] Metas e objetivos vinculados

### 5. Melhorias de UX 🎯
- [ ] Barra de progresso no preenchimento
- [ ] Auto-save a cada 30 segundos
- [ ] Comparativo lado-a-lado (autoavaliação vs gerencial)
- [ ] Comentários inline do gerente nas respostas do colaborador

---

## 🚨 Troubleshooting

### Problema: Card não aparece no dashboard
**Possíveis causas**:
- Período não está ativo (`ativo = false`)
- Datas incorretas (data_inicio > hoje)
- Usuário não tem token válido
- Erro na query do Supabase (verificar logs)

**Solução**:
```sql
-- Verificar período
SELECT * FROM periodos_avaliacao WHERE id = 'uuid-periodo';

-- Verificar se está ativo e com datas corretas
UPDATE periodos_avaliacao 
SET ativo = true, data_inicio = CURRENT_DATE 
WHERE id = 'uuid-periodo';
```

### Problema: Erro "Gerente não configurado"
**Causa**: Não existe mapping em `avaliacao_colaborador_gerente`

**Solução**:
```sql
INSERT INTO avaliacao_colaborador_gerente (
  colaborador_id, 
  gerente_id
) VALUES (
  'uuid-colaborador',
  'uuid-gerente'
);
```

### Problema: Colaborador não pode editar
**Causa**: Status não é `pendente_autoavaliacao`

**Solução**:
```sql
UPDATE avaliacoes_desempenho 
SET status = 'pendente_autoavaliacao' 
WHERE id = 'uuid-avaliacao';
```

### Problema: Nota final não é calculada
**Causa**: Status não mudou para `concluida` ou respostas sem notas

**Verificar**:
```sql
SELECT id, status, respostas, nota_final 
FROM avaliacoes_desempenho 
WHERE id = 'uuid-avaliacao';
```

**Nota**: Cálculo só ocorre quando status muda para `concluida` via PATCH endpoint

---

## 📚 Referências

### Schemas
- `QUESTIONARIO_PADRAO`: `src/lib/schemas/evaluation-schemas.ts`
- `ESCALA_AVALIACAO`: `src/lib/schemas/evaluation-schemas.ts`

### Tipos TypeScript
- `Evaluation`: `src/types/index.ts`
- `EvaluationPeriod`: `src/types/index.ts`
- `User`: `src/types/index.ts`

### Componentes Base
- `QuestionarioAvaliacaoCardBased`: `src/components/avaliacao/QuestionarioAvaliacaoCardBased.tsx`
- Framer Motion: `12.23.24`
- date-fns: Com locale `ptBR`

### Supabase
- Cliente Admin: `getSupabaseAdmin()` em `src/lib/supabase.ts`
- Auth: `verifyRequestToken()` em `src/lib/auth.ts`
- RLS: Políticas devem permitir:
  - Colaborador ler suas próprias avaliações
  - Gerente ler avaliações de seus colaboradores
  - Ambos atualizar conforme permissões de status

---

## 🎉 Conclusão

O sistema de detecção automática de ciclos está **100% funcional** e pronto para uso. Ele segue as melhores práticas do projeto:
- ✅ Next.js App Router (Server + Client Components)
- ✅ Supabase como fonte de dados
- ✅ Validações de permissão rigorosas
- ✅ UI moderna com Framer Motion
- ✅ Estrutura Q11-Q17 da planilha
- ✅ Fluxo de status bem definido
- ✅ Código reutilizável e manutenível

**Deploy**: Pronto para produção após testes em staging.

**Documentação**: Este arquivo + comentários inline no código.

**Suporte**: Qualquer dúvida, consulte os arquivos criados ou a documentação do Supabase/Next.js.

---

**Implementado com MCPs**: Sequential Thinking, Context7 (Next.js docs), GitHub MCP (database schemas)

**Data**: Janeiro 2025
**Versão**: 1.0.0
