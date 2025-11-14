-- ==========================================
-- CORREÇÃO DE POLÍTICAS RLS PARA AVALIACOES_DESEMPENHO
-- ==========================================
-- Este script configura as políticas de Row Level Security (RLS)
-- para a tabela avaliacoes_desempenho
-- Data: 2025-11-11
-- ==========================================

-- 1. Desabilitar RLS temporariamente para fazer limpeza
ALTER TABLE IF EXISTS avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Permitir visualização de avaliações" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "Permitir criação de avaliações" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "Permitir atualização de avaliações" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "Permitir exclusão de avaliações" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_select_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_insert_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_update_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_delete_policy" ON avaliacoes_desempenho;

-- 3. Reabilitar RLS
ALTER TABLE avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;

-- 4. Criar função helper para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica se o usuário atual é admin na tabela users_unified
  RETURN EXISTS (
    SELECT 1
    FROM users_unified
    WHERE id = auth.uid()
    AND role = 'ADMIN'
    AND active = TRUE
    AND is_authorized = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar função helper para verificar se usuário é gerente de avaliação
CREATE OR REPLACE FUNCTION is_gerente_avaliacao()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica se o usuário está na tabela de gerentes de avaliação
  RETURN EXISTS (
    SELECT 1
    FROM gerentes_avaliacao
    WHERE usuario_id = auth.uid()
    AND ativo = TRUE
    AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Política de SELECT (Visualização)
-- Permite que:
-- - Admins vejam todas as avaliações
-- - Gerentes de avaliação vejam todas as avaliações
-- - Funcionários vejam suas próprias avaliações (como avaliado ou avaliador)
CREATE POLICY "avaliacoes_select_policy"
ON avaliacoes_desempenho
FOR SELECT
USING (
  is_admin_user()
  OR is_gerente_avaliacao()
  OR funcionario_id = auth.uid()
  OR avaliador_id = auth.uid()
);

-- 7. Política de INSERT (Criação)
-- Permite que:
-- - Admins criem qualquer avaliação
-- - Gerentes de avaliação criem qualquer avaliação
-- - Service role (backend) crie qualquer avaliação
CREATE POLICY "avaliacoes_insert_policy"
ON avaliacoes_desempenho
FOR INSERT
WITH CHECK (
  is_admin_user()
  OR is_gerente_avaliacao()
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- 8. Política de UPDATE (Atualização)
-- Permite que:
-- - Admins atualizem qualquer avaliação
-- - Gerentes de avaliação atualizem qualquer avaliação
-- - Avaliadores atualizem avaliações onde são o avaliador
CREATE POLICY "avaliacoes_update_policy"
ON avaliacoes_desempenho
FOR UPDATE
USING (
  is_admin_user()
  OR is_gerente_avaliacao()
  OR avaliador_id = auth.uid()
)
WITH CHECK (
  is_admin_user()
  OR is_gerente_avaliacao()
  OR avaliador_id = auth.uid()
);

-- 9. Política de DELETE (Exclusão)
-- Permite que:
-- - Admins excluam qualquer avaliação
-- - Gerentes de avaliação excluam qualquer avaliação
CREATE POLICY "avaliacoes_delete_policy"
ON avaliacoes_desempenho
FOR DELETE
USING (
  is_admin_user()
  OR is_gerente_avaliacao()
);

-- 10. Garantir que a tabela tem RLS habilitado
ALTER TABLE avaliacoes_desempenho FORCE ROW LEVEL SECURITY;

-- 11. Configurar políticas para tabelas relacionadas (se existirem)

-- Pontuações de avaliação
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pontuacoes_avaliacao') THEN
    ALTER TABLE pontuacoes_avaliacao ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "pontuacoes_select_policy" ON pontuacoes_avaliacao;
    DROP POLICY IF EXISTS "pontuacoes_insert_policy" ON pontuacoes_avaliacao;
    DROP POLICY IF EXISTS "pontuacoes_update_policy" ON pontuacoes_avaliacao;
    DROP POLICY IF EXISTS "pontuacoes_delete_policy" ON pontuacoes_avaliacao;

    -- SELECT: Mesmas regras das avaliações
    CREATE POLICY "pontuacoes_select_policy" ON pontuacoes_avaliacao
    FOR SELECT
    USING (
      is_admin_user()
      OR is_gerente_avaliacao()
      OR EXISTS (
        SELECT 1 FROM avaliacoes_desempenho a
        WHERE a.id = pontuacoes_avaliacao.avaliacao_id
        AND (a.funcionario_id = auth.uid() OR a.avaliador_id = auth.uid())
      )
    );

    -- INSERT: Admins, gerentes e service role
    CREATE POLICY "pontuacoes_insert_policy" ON pontuacoes_avaliacao
    FOR INSERT
    WITH CHECK (
      is_admin_user()
      OR is_gerente_avaliacao()
      OR auth.jwt() ->> 'role' = 'service_role'
    );

    -- UPDATE: Admins, gerentes e avaliadores da avaliação relacionada
    CREATE POLICY "pontuacoes_update_policy" ON pontuacoes_avaliacao
    FOR UPDATE
    USING (
      is_admin_user()
      OR is_gerente_avaliacao()
      OR EXISTS (
        SELECT 1 FROM avaliacoes_desempenho a
        WHERE a.id = pontuacoes_avaliacao.avaliacao_id
        AND a.avaliador_id = auth.uid()
      )
    );

    -- DELETE: Apenas admins e gerentes
    CREATE POLICY "pontuacoes_delete_policy" ON pontuacoes_avaliacao
    FOR DELETE
    USING (
      is_admin_user()
      OR is_gerente_avaliacao()
    );
  END IF;
END $$;

-- 12. Critérios de avaliação (tabela criterios)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'criterios') THEN
    ALTER TABLE criterios ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "criterios_select_policy" ON criterios;
    DROP POLICY IF EXISTS "criterios_insert_policy" ON criterios;
    DROP POLICY IF EXISTS "criterios_update_policy" ON criterios;
    DROP POLICY IF EXISTS "criterios_delete_policy" ON criterios;

    -- SELECT: Todos os usuários autenticados podem ver critérios ativos
    CREATE POLICY "criterios_select_policy" ON criterios
    FOR SELECT
    USING (
      auth.uid() IS NOT NULL
      AND ativo = TRUE
      AND deleted_at IS NULL
    );

    -- INSERT/UPDATE/DELETE: Apenas admins e gerentes
    CREATE POLICY "criterios_insert_policy" ON criterios
    FOR INSERT
    WITH CHECK (is_admin_user() OR is_gerente_avaliacao());

    CREATE POLICY "criterios_update_policy" ON criterios
    FOR UPDATE
    USING (is_admin_user() OR is_gerente_avaliacao());

    CREATE POLICY "criterios_delete_policy" ON criterios
    FOR DELETE
    USING (is_admin_user() OR is_gerente_avaliacao());
  END IF;
END $$;

-- 13. Resumo das políticas criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('avaliacoes_desempenho', 'pontuacoes_avaliacao', 'criterios')
ORDER BY tablename, policyname;

-- 14. Log de conclusão
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS configuradas com sucesso para avaliacoes_desempenho';
  RAISE NOTICE '✅ Políticas RLS configuradas com sucesso para pontuacoes_avaliacao';
  RAISE NOTICE '✅ Políticas RLS configuradas com sucesso para criterios';
  RAISE NOTICE '✅ Funções helper criadas: is_admin_user(), is_gerente_avaliacao()';
END $$;
