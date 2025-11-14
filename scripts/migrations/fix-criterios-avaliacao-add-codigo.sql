-- ============================================
-- Migration: Add codigo column to criterios_avaliacao and fix UUID error
-- Permite usar códigos legíveis como 'q11-pontos-fortes' mantendo UUID como PK
-- ============================================

-- Step 1: Add codigo column to criterios_avaliacao
ALTER TABLE criterios_avaliacao 
ADD COLUMN IF NOT EXISTS codigo VARCHAR(100) UNIQUE;

-- Step 2: Create index on codigo for fast lookups
CREATE INDEX IF NOT EXISTS idx_criterios_avaliacao_codigo 
ON criterios_avaliacao(codigo);

-- Step 3: Drop existing data if any (fresh start)
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

-- Step 5: Verify data inserted
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

-- Step 6: Show summary
SELECT 
  tipo,
  categoria,
  COUNT(*) as total
FROM criterios_avaliacao
GROUP BY tipo, categoria
ORDER BY tipo, categoria;
