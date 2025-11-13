-- ========================================
-- FIX: Adicionar coluna configurado_por
-- Data: 2025-01-27
-- Descrição: Adiciona coluna opcional para rastrear quem configurou o mapeamento
-- ========================================

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'avaliacao_colaborador_gerente'
    AND column_name = 'configurado_por'
  ) THEN
    ALTER TABLE avaliacao_colaborador_gerente
    ADD COLUMN configurado_por UUID REFERENCES users_unified(id);
    
    RAISE NOTICE 'Coluna configurado_por adicionada com sucesso';
  ELSE
    RAISE NOTICE 'Coluna configurado_por já existe, nenhuma alteração necessária';
  END IF;
END $$;

-- Adicionar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_colaborador_gerente_configurado_por 
ON avaliacao_colaborador_gerente(configurado_por);

-- Comentário explicativo
COMMENT ON COLUMN avaliacao_colaborador_gerente.configurado_por IS 'ID do usuário admin que configurou este mapeamento';

-- Validar estrutura final
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'avaliacao_colaborador_gerente'
ORDER BY ordinal_position;
