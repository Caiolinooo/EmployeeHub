-- Função opcional execute_sql
-- Esta função facilita a execução de migrations via API
-- ATENÇÃO: Esta função deve ser usada com cuidado por motivos de segurança

-- Criar a função execute_sql
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validação básica: não permitir comandos perigosos
  IF sql ~* '(DROP\s+DATABASE|DROP\s+SCHEMA|TRUNCATE\s+TABLE.*CASCADE)' THEN
    RAISE EXCEPTION 'Operação não permitida por motivos de segurança';
  END IF;

  EXECUTE sql;
END;
$$;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION execute_sql(text) IS
'Função para executar SQL dinâmico. USE COM CUIDADO! Apenas para migrations automáticas.';

-- Dar permissões apropriadas
-- IMPORTANTE: Ajuste estas permissões conforme suas necessidades de segurança
GRANT EXECUTE ON FUNCTION execute_sql(text) TO service_role;

-- Se você quiser permitir que usuários autenticados executem (NÃO RECOMENDADO em produção):
-- GRANT EXECUTE ON FUNCTION execute_sql(text) TO authenticated;

-- Para revogar permissões se necessário:
-- REVOKE EXECUTE ON FUNCTION execute_sql(text) FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION execute_sql(text) FROM anon;
