-- Migration: Adicionar coluna respostas na tabela avaliacoes_desempenho
-- Data: 2025-12-01
-- Descrição: Adiciona coluna JSONB para armazenar respostas do questionário

-- Adicionar coluna respostas se não existir
ALTER TABLE avaliacoes_desempenho
ADD COLUMN IF NOT EXISTS respostas JSONB DEFAULT '{}'::jsonb;

-- Adicionar índice GIN para melhor performance em queries JSONB
CREATE INDEX IF NOT EXISTS idx_avaliacoes_respostas ON avaliacoes_desempenho USING GIN (respostas);

-- Comentário para documentação
COMMENT ON COLUMN avaliacoes_desempenho.respostas IS 'Respostas do questionário de avaliação em formato JSON';
