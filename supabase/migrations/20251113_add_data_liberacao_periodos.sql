-- Migration: Adicionar campo data_liberacao em periodos_avaliacao
-- Data: 2025-11-13
-- Descrição: Adiciona campo para controlar quando os usuários devem ser notificados 
--            sobre a disponibilidade de preenchimento da avaliação

-- Adicionar coluna data_liberacao
ALTER TABLE periodos_avaliacao
ADD COLUMN IF NOT EXISTS data_liberacao DATE;

-- Adicionar comentário explicativo
COMMENT ON COLUMN periodos_avaliacao.data_liberacao IS 
'Data em que os usuários serão notificados para preencher a avaliação. Se NULL, notifica na data_inicio.';

-- Criar índice para consultas de períodos liberados hoje
CREATE INDEX IF NOT EXISTS idx_periodos_data_liberacao 
ON periodos_avaliacao(data_liberacao) 
WHERE ativo = TRUE AND data_liberacao IS NOT NULL;

-- Atualizar períodos existentes: data_liberacao = data_inicio (comportamento atual)
UPDATE periodos_avaliacao
SET data_liberacao = data_inicio
WHERE data_liberacao IS NULL;
