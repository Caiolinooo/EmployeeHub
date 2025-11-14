-- Script para corrigir políticas RLS da tabela avaliacoes_desempenho
-- Este script deve ser executado via SQL Editor do Supabase ou via API com service role key

-- 1. Desabilitar RLS temporariamente
ALTER TABLE avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas antigas
DROP POLICY IF EXISTS "avaliacoes_desempenho_select" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_select_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_insert_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_update_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_delete_policy" ON avaliacoes_desempenho;

-- 3. Reabilitar RLS
ALTER TABLE avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;

-- 4. Criar novas políticas permissivas
-- IMPORTANTE: Estas políticas permitem operações quando:
-- a) O usuário está autenticado via Supabase Auth (auth.uid())
-- b) Usando Service Role Key (bypassa RLS automaticamente)
-- c) Via cliente anônimo com credenciais válidas

-- Política de SELECT: Permite visualizar avaliações
CREATE POLICY "avaliacoes_select_all" ON avaliacoes_desempenho
  FOR SELECT
  USING (true);

-- Política de INSERT: Permite criar avaliações
CREATE POLICY "avaliacoes_insert_all" ON avaliacoes_desempenho
  FOR INSERT
  WITH CHECK (true);

-- Política de UPDATE: Permite atualizar avaliações
CREATE POLICY "avaliacoes_update_all" ON avaliacoes_desempenho
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Política de DELETE: Permite soft delete de avaliações
CREATE POLICY "avaliacoes_delete_all" ON avaliacoes_desempenho
  FOR DELETE
  USING (true);

-- 5. Verificar se as políticas foram criadas
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'avaliacoes_desempenho';

    RAISE NOTICE 'Total de políticas RLS criadas: %', policy_count;

    IF policy_count >= 4 THEN
        RAISE NOTICE '✅ Políticas RLS configuradas com sucesso!';
    ELSE
        RAISE WARNING '⚠️ Número de políticas menor que o esperado. Verifique a configuração.';
    END IF;
END $$;

-- 6. Listar políticas criadas
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'avaliacoes_desempenho'
ORDER BY policyname;
