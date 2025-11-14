-- Adicionar coluna para armazenar notas do gerente nas questões do colaborador
-- Permite que o gerente dê notas (1-5) para cada resposta do colaborador

ALTER TABLE avaliacoes_desempenho 
ADD COLUMN IF NOT EXISTS notas_gerente JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN avaliacoes_desempenho.notas_gerente IS 
'Notas (1-5) que o gerente atribui para cada questão respondida pelo colaborador. Formato: {"q11": 4, "q12": 5, ...}';
