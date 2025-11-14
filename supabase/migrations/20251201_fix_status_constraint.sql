-- Migration: Corrigir constraint de status na tabela avaliacoes_desempenho
-- Data: 2025-12-01

-- Remover constraint antiga
ALTER TABLE avaliacoes_desempenho 
DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_status_check;

-- Adicionar nova constraint com status corretos
ALTER TABLE avaliacoes_desempenho
ADD CONSTRAINT avaliacoes_desempenho_status_check 
CHECK (status IN (
  'pendente',
  'em_andamento', 
  'aguardando_aprovacao',
  'concluida',
  'devolvida',
  'cancelada'
));

-- Comentário
COMMENT ON CONSTRAINT avaliacoes_desempenho_status_check ON avaliacoes_desempenho 
IS 'Status permitidos: pendente, em_andamento, aguardando_aprovacao, concluida, devolvida, cancelada';
