-- Adicionar coluna nota_final se não existir
ALTER TABLE avaliacoes_desempenho 
ADD COLUMN IF NOT EXISTS nota_final DECIMAL(3,2);

COMMENT ON COLUMN avaliacoes_desempenho.nota_final IS 
'Nota final da avaliação calculada com base em todas as notas (gerente + notas do gerente para colaborador)';
