# 🔧 GUIA DE IMPLEMENTAÇÃO - Sistema de Avaliação com Escala 1-5

## ✅ Alterações Implementadas

### 1. **StarRating Component** (`src/components/StarRating.tsx`)
- ✅ Adicionadas props `showLabel` e `showTooltip`
- ✅ Implementado tooltip com descrição da escala ao passar o mouse
- ✅ Exibição do label abaixo das estrelas com a descrição completa
- ✅ Suporte a i18n para labels em PT-BR e EN-US

### 2. **Traduções i18n**
- ✅ **pt-BR.ts**: Escala completa em português
  - 1 ⭐ - Frequentemente não alcançou a expectativa
  - 2 ⭐⭐ - Não alcançou a expectativa
  - 3 ⭐⭐⭐ - Alcançou a expectativa
  - 4 ⭐⭐⭐⭐ - Frequentemente excedeu a expectativa
  - 5 ⭐⭐⭐⭐⭐ - Consistentemente excedeu a expectativa

- ✅ **en-US.ts**: Escala completa em inglês
  - 1 ⭐ - Frequently did not meet expectations
  - 2 ⭐⭐ - Did not meet expectations
  - 3 ⭐⭐⭐ - Met expectations
  - 4 ⭐⭐⭐⭐ - Frequently exceeded expectations
  - 5 ⭐⭐⭐⭐⭐ - Consistently exceeded expectations

### 3. **Interface CriterioAvaliacao** (`src/data/criterios-avaliacao.ts`)
- ✅ Adicionado campo `codigo: string` para identificadores legíveis
- ✅ Mantido `id: string` como UUID para chave primária
- ✅ Todos os critérios atualizados com campo `codigo`

### 4. **QuestionarioAvaliacaoCardBased** (`src/components/avaliacao/QuestionarioAvaliacaoCardBased.tsx`)
- ✅ Integrado com novo componente `StarRating`
- ✅ Removido código duplicado de renderização de estrelas
- ✅ Habilitado `showLabel` e `showTooltip` para melhor UX

---

## 🗄️ MIGRAÇÃO DO BANCO DE DADOS

### ⚠️ EXECUTAR MANUALMENTE NO SUPABASE SQL EDITOR

Como a função `exec_sql` não está disponível, execute os seguintes comandos **DIRETAMENTE no Supabase SQL Editor**:

\`\`\`sql
-- Step 1: Add codigo column to criterios_avaliacao
ALTER TABLE criterios_avaliacao 
ADD COLUMN IF NOT EXISTS codigo VARCHAR(100) UNIQUE;

-- Step 2: Create index on codigo for fast lookups
CREATE INDEX IF NOT EXISTS idx_criterios_avaliacao_codigo 
ON criterios_avaliacao(codigo);

-- Step 3: Drop existing data (CUIDADO: Isso apaga todos os dados!)
TRUNCATE TABLE criterios_avaliacao CASCADE;

-- Step 4: Insert criteria with proper UUIDs and codigo fields
INSERT INTO criterios_avaliacao (id, codigo, nome, descricao, categoria, apenas_lideres, tipo, ordem, pontuacao_maxima, ativo) VALUES
-- Questões do colaborador (11-14) - Autoavaliação
(gen_random_uuid(), 'q11-pontos-fortes', 'Pontos Fortes', 'Questão 11: Pontos fortes - Descrição feita pelo colaborador', 'Autoavaliação', FALSE, 'colaborador', 11, 5, TRUE),
(gen_random_uuid(), 'q12-areas-melhoria', 'Áreas de Melhoria', 'Questão 12: Áreas de melhoria - Descrição feita pelo colaborador', 'Autoavaliação', FALSE, 'colaborador', 12, 5, TRUE),
(gen_random_uuid(), 'q13-objetivos-alcancados', 'Objetivos Alcançados', 'Questão 13: Objetivos alcançados - Descrição feita pelo colaborador', 'Autoavaliação', FALSE, 'colaborador', 13, 5, TRUE),
(gen_random_uuid(), 'q14-planos-desenvolvimento', 'Planos de Desenvolvimento', 'Questão 14: Planos de desenvolvimento - Descrição feita pelo colaborador', 'Autoavaliação', FALSE, 'colaborador', 14, 5, TRUE),

-- Competências do gerente (avaliação do funcionário) - Todos os funcionários
(gen_random_uuid(), 'pontualidade-comprometimento', 'Pontualidade e Comprometimento', 'Cumpre prazos, horários e demonstra engajamento com as metas e atividades da equipe e empresa.', 'Comportamento', FALSE, 'gerente', 1, 5, TRUE),
(gen_random_uuid(), 'autonomia-proatividade', 'Autonomia e Proatividade', 'Realiza as tarefas diárias sem a necessidade de intervenção da liderança.', 'Comportamento', FALSE, 'gerente', 2, 5, TRUE),
(gen_random_uuid(), 'comunicacao-colaboracao', 'Comunicação, Colaboração e Relacionamento', 'Possui uma comunicação clara. Pensa no coletivo e ajuda no aprendizado e conhecimento da equipe. Demonstra bom relacionamento com os colegas.', 'Habilidades Interpessoais', FALSE, 'gerente', 3, 5, TRUE),
(gen_random_uuid(), 'conhecimento-atividades', 'Conhecimento das atividades', 'Demonstra domínio das atividades que desempenha e compartilha boas ideias e conhecimentos técnicos com o time.', 'Competências Técnicas', FALSE, 'gerente', 4, 5, TRUE),
(gen_random_uuid(), 'resolucao-problemas', 'Resolução de problemas', 'Resolve problemas relacionados à sua rotina de trabalho. Utiliza a criatividade para encontrar soluções. Quando necessário, propõe soluções para a tomada de decisão da liderança.', 'Competências Técnicas', FALSE, 'gerente', 5, 5, TRUE),
(gen_random_uuid(), 'inteligencia-emocional', 'Inteligência Emocional e Solução de conflitos', 'Lida bem com situações de conflito, demonstrando equilíbrio quando há adversidades.', 'Habilidades Interpessoais', FALSE, 'gerente', 6, 5, TRUE),

-- Competências de liderança (apenas para líderes)
(gen_random_uuid(), 'lideranca-delegar', 'Liderança - Delegar', 'Capacidade de delegar tarefas e responsabilidades de forma eficaz, desenvolvendo a equipe.', 'Liderança', TRUE, 'gerente', 7, 5, TRUE),
(gen_random_uuid(), 'lideranca-desenvolvimento-equipe', 'Liderança - Desenvolvimento de Equipe', 'Capacidade de desenvolver, orientar e capacitar membros da equipe para alcançar melhores resultados.', 'Liderança', TRUE, 'gerente', 8, 5, TRUE),

-- Questão 15 - Comentário do avaliador
(gen_random_uuid(), 'q15-comentario-avaliador', 'Comentário do Avaliador', 'Questão 15: Comentário detalhado do gerente sobre o desempenho do colaborador', 'Avaliação do Gerente', FALSE, 'gerente', 15, 5, TRUE)

ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  apenas_lideres = EXCLUDED.apenas_lideres,
  tipo = EXCLUDED.tipo,
  ordem = EXCLUDED.ordem,
  pontuacao_maxima = EXCLUDED.pontuacao_maxima,
  ativo = EXCLUDED.ativo,
  updated_at = NOW();

-- Verify data inserted
SELECT 
  codigo, 
  nome, 
  categoria, 
  tipo, 
  CASE WHEN apenas_lideres THEN 'SIM' ELSE 'NÃO' END as "Apenas Líderes",
  ordem,
  pontuacao_maxima
FROM criterios_avaliacao 
ORDER BY ordem;
\`\`\`

---

## 📋 Checklist de Implementação

### ✅ Código
- [x] StarRating component atualizado com labels
- [x] i18n PT-BR com escala 1-5
- [x] i18n EN-US com escala 1-5
- [x] Interface CriterioAvaliacao com campo `codigo`
- [x] criterios-avaliacao.ts atualizado
- [x] QuestionarioAvaliacaoCardBased usando novo StarRating

### ⚠️ Banco de Dados (Pendente - Executar Manualmente)
- [ ] Adicionar coluna `codigo` em `criterios_avaliacao`
- [ ] Criar índice em `codigo`
- [ ] Inserir critérios com códigos legíveis
- [ ] Verificar dados inseridos

---

## 🎯 Como Testar

### 1. Após executar a migração SQL:

\`\`\`bash
# Verificar se a coluna foi criada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'criterios_avaliacao';

# Verificar critérios inseridos
SELECT codigo, nome, tipo, apenas_lideres 
FROM criterios_avaliacao 
ORDER BY ordem;
\`\`\`

### 2. Testar o frontend:

1. Acessar uma página de avaliação
2. Verificar se as estrelas aparecem corretamente
3. Passar o mouse sobre as estrelas - deve aparecer tooltip
4. Selecionar uma estrela - deve aparecer label abaixo
5. Verificar tradução em PT-BR e EN-US

---

## 📊 Resultado Esperado

### Interface de Avaliação:
- ⭐⭐⭐⭐⭐ (5 estrelas)
- Tooltip ao passar mouse: "5 - Consistentemente excedeu a expectativa"
- Label abaixo: "5 - Consistentemente excedeu a expectativa"
- Valor numérico: "5/5"

### Banco de Dados:
- Coluna `codigo` criada com sucesso
- 13 critérios inseridos (4 colaborador + 9 gerente)
- Códigos legíveis como `q11-pontos-fortes`, `pontualidade-comprometimento`
- UUIDs gerados automaticamente

---

## 🚀 Próximos Passos

1. **Executar SQL no Supabase** (copiar de `scripts/migrations/fix-criterios-avaliacao-add-codigo.sql`)
2. **Testar criação de nova avaliação**
3. **Verificar se gerentes conseguem avaliar com escala 1-5**
4. **Confirmar tradução em ambos idiomas**
5. **Validar tooltips e labels**

---

## 📝 Notas Importantes

- ✅ A escala 1-5 está padronizada em todo o sistema
- ✅ Labels aparecem em PT-BR e EN-US automaticamente
- ✅ Tooltips melhoram UX durante preenchimento
- ⚠️ TRUNCATE apaga dados existentes - use com cuidado!
- 💡 Sempre teste em ambiente de desenvolvimento primeiro

---

## 📞 Suporte

Se houver problemas:
1. Verificar se todas as traduções foram adicionadas em `i18n/locales/`
2. Confirmar que `codigo` column existe no banco
3. Checar console do navegador para erros
4. Validar que componente StarRating está sendo importado corretamente
