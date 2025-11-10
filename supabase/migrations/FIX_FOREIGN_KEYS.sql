-- ============================================
-- SQL PARA VERIFICAR E CRIAR FOREIGN KEYS
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- PASSO 1: Verificar se as foreign keys já existem
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname IN (
    'avaliacoes_desempenho_funcionario_id_fkey',
    'avaliacoes_desempenho_avaliador_id_fkey'
);

-- Se a query acima retornar resultados, as foreign keys JÁ EXISTEM
-- Se não retornar nada, execute o PASSO 2 abaixo

-- ============================================
-- PASSO 2: CRIAR AS FOREIGN KEYS
-- ============================================

-- Remover constraints antigas se existirem (só por segurança)
ALTER TABLE avaliacoes_desempenho
DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_funcionario_id_fkey;

ALTER TABLE avaliacoes_desempenho
DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_avaliador_id_fkey;

-- Criar foreign key para funcionario_id
ALTER TABLE avaliacoes_desempenho
ADD CONSTRAINT avaliacoes_desempenho_funcionario_id_fkey
FOREIGN KEY (funcionario_id)
REFERENCES funcionarios(id)
ON DELETE CASCADE;

-- Criar foreign key para avaliador_id
ALTER TABLE avaliacoes_desempenho
ADD CONSTRAINT avaliacoes_desempenho_avaliador_id_fkey
FOREIGN KEY (avaliador_id)
REFERENCES funcionarios(id)
ON DELETE SET NULL;

-- ============================================
-- PASSO 3: VERIFICAR SE FORAM CRIADAS
-- ============================================

SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname IN (
    'avaliacoes_desempenho_funcionario_id_fkey',
    'avaliacoes_desempenho_avaliador_id_fkey'
);

-- Você deve ver 2 linhas no resultado:
-- 1. avaliacoes_desempenho_funcionario_id_fkey
-- 2. avaliacoes_desempenho_avaliador_id_fkey
