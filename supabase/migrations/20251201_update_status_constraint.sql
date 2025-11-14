-- Atualizar constraint de status para incluir novos status do fluxo
-- Adicionar: aprovada_aguardando_comentario, aguardando_finalizacao

-- Remover constraint antiga
ALTER TABLE avaliacoes_desempenho 
DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_status_check;

-- Adicionar constraint atualizada
ALTER TABLE avaliacoes_desempenho 
ADD CONSTRAINT avaliacoes_desempenho_status_check 
CHECK (status IN (
  'pendente', 
  'em_andamento', 
  'aguardando_aprovacao', 
  'aprovada_aguardando_comentario',
  'aguardando_finalizacao',
  'concluida', 
  'devolvida', 
  'cancelada'
));

COMMENT ON CONSTRAINT avaliacoes_desempenho_status_check ON avaliacoes_desempenho 
IS 'Status válidos incluindo novos status do fluxo de aprovação com comentário final';
