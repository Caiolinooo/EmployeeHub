-- Adicionar coluna apenas_lideres à tabela criterios
ALTER TABLE criterios ADD COLUMN IF NOT EXISTS apenas_lideres BOOLEAN DEFAULT FALSE;

-- Atualizar critérios existentes para remover pesos (definir todos como 1.0)
UPDATE criterios SET peso = 1.0 WHERE peso != 1.0;

-- Limpar critérios duplicados mantendo apenas um de cada nome/categoria
WITH criterios_unicos AS (
  SELECT DISTINCT ON (nome, categoria) 
    id, nome, descricao, categoria, peso, pontuacao_maxima, ativo
  FROM criterios 
  ORDER BY nome, categoria, created_at
)
DELETE FROM criterios 
WHERE id NOT IN (SELECT id FROM criterios_unicos);

-- Atualizar critério de Comprometimento para incluir Pontualidade
UPDATE criterios 
SET 
  nome = 'Comprometimento e Pontualidade',
  descricao = 'Avalia o nível de comprometimento com os objetivos da empresa e o cumprimento de prazos e horários estabelecidos'
WHERE nome = 'Comprometimento';

-- Remover critério de Pontualidade separado (se existir)
DELETE FROM criterios WHERE nome = 'Pontualidade';

-- Atualizar critério de Liderança para "Liderança - Delegar"
UPDATE criterios 
SET 
  nome = 'Liderança - Delegar',
  descricao = 'Avalia a capacidade de delegar tarefas de forma eficaz e acompanhar resultados',
  apenas_lideres = TRUE
WHERE nome = 'Liderança';

-- Inserir novo critério "Liderança - Desenvolvimento da Equipe"
INSERT INTO criterios (id, nome, descricao, categoria, peso, pontuacao_maxima, ativo, apenas_lideres)
VALUES (
  '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
  'Liderança - Desenvolvimento da Equipe',
  'Avalia a capacidade de desenvolver e capacitar membros da equipe',
  'Liderança',
  1.0,
  5,
  TRUE,
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- Comentários sobre as mudanças
COMMENT ON COLUMN criterios.apenas_lideres IS 'Indica se o critério deve ser aplicado apenas para usuários com função de liderança';
