-- Adicionar coluna deleted_at para soft delete na tabela avaliacoes_desempenho
-- EmployeeHub - Sistema de Avaliação

-- Adicionar coluna deleted_at para implementar soft delete
ALTER TABLE avaliacoes_desempenho
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhor performance das consultas que filtram por deleted_at
CREATE INDEX IF NOT EXISTS idx_avaliacoes_desempenho_deleted_at
ON avaliacoes_desempenho(deleted_at);

-- Atualizar políticas RLS se existirem para levar em conta o deleted_at
-- Esta parte deve ser adaptada conforme suas políticas existentes

-- Comentários para documentação
COMMENT ON COLUMN avaliacoes_desempenho.deleted_at IS 'Data e hora quando o registro foi movido para a lixeira (soft delete). NULL significa que o registro está ativo.';