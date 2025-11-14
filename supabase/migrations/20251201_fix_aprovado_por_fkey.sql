-- Corrigir foreign key da coluna aprovado_por para apontar para users_unified
-- Problema: constraint aponta para tabela 'users' mas sistema usa 'users_unified'

-- Remover constraint antiga
ALTER TABLE avaliacoes_desempenho 
DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_aprovado_por_fkey;

-- Adicionar constraint correta apontando para users_unified
ALTER TABLE avaliacoes_desempenho 
ADD CONSTRAINT avaliacoes_desempenho_aprovado_por_fkey 
FOREIGN KEY (aprovado_por) REFERENCES users_unified(id) ON DELETE SET NULL;

-- Comentário explicativo
COMMENT ON CONSTRAINT avaliacoes_desempenho_aprovado_por_fkey ON avaliacoes_desempenho 
IS 'Foreign key corrigida para apontar para users_unified ao invés de users';
