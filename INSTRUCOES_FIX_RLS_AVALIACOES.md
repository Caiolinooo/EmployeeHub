# Instruções para Corrigir Políticas RLS da Tabela avaliacoes_desempenho

## Problema Identificado

A tabela `avaliacoes_desempenho` possui políticas RLS (Row Level Security) que estão impedindo a criação de novas avaliações. O erro retornado é:

```
new row violates row-level security policy for table "avaliacoes_desempenho"
```

## Correções Já Realizadas

✅ **1. Múltiplas instâncias do GoTrueClient corrigidas** em `unifiedDataService.ts`
✅ **2. Campos da página de avaliação corrigidos** - agora usa `periodo` (TEXT) ao invés de `periodo_id` (UUID)
✅ **3. Verificação de avaliações existentes corrigida**

## Solução: Executar SQL Manualmente no Supabase

Como não é possível executar comandos SQL arbitrários via API por questões de segurança, você precisa executar o seguinte SQL manualmente no **SQL Editor do Supabase**.

### Passo a Passo

1. **Acesse o Supabase Dashboard**: https://supabase.com/dashboard
2. **Navegue até seu projeto**
3. **Vá para SQL Editor** (ícone de código SQL no menu lateral)
4. **Copie e cole o SQL abaixo**
5. **Clique em RUN**

### SQL para Executar

```sql
-- ============================================
-- CORREÇÃO DE POLÍTICAS RLS - AVALIACOES_DESEMPENHO
-- ============================================

-- 1. Desabilitar RLS temporariamente
ALTER TABLE avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas antigas
DROP POLICY IF EXISTS "avaliacoes_desempenho_select" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_select_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_insert_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_update_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_delete_policy" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_select_all" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_insert_all" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_update_all" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_delete_all" ON avaliacoes_desempenho;

-- 3. Reabilitar RLS
ALTER TABLE avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas PERMISSIVAS para todos os usuários
-- ATENÇÃO: Estas políticas são MUITO permissivas e devem ser ajustadas depois

-- Política de SELECT: Permite visualizar todas as avaliações
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

-- Política de DELETE: Permite deletar avaliações
CREATE POLICY "avaliacoes_delete_all" ON avaliacoes_desempenho
  FOR DELETE
  USING (true);

-- 5. Verificar políticas criadas
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    CASE
        WHEN qual IS NOT NULL THEN 'USING presente'
        ELSE 'Sem USING'
    END as qual_status,
    CASE
        WHEN with_check IS NOT NULL THEN 'WITH CHECK presente'
        ELSE 'Sem WITH CHECK'
    END as check_status
FROM pg_policies
WHERE tablename = 'avaliacoes_desempenho'
ORDER BY policyname;
```

### Verificando o Resultado

Após executar o SQL acima, você deverá ver **4 políticas** criadas:
- `avaliacoes_select_all` - Para SELECT
- `avaliacoes_insert_all` - Para INSERT
- `avaliacoes_update_all` - Para UPDATE
- `avaliacoes_delete_all` - Para DELETE

Todas com `permissive = true`.

## Testando a Correção

Após executar o SQL:

1. **Reinicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

2. **Acesse a página de criar nova avaliação**:
   ```
   http://localhost:3000/avaliacao/nova
   ```

3. **Tente criar uma avaliação**:
   - Selecione um período
   - Selecione um funcionário
   - Selecione um gerente de avaliação
   - Clique em "Criar Avaliação"

4. **Se funcionar**: O erro de RLS foi resolvido! ✅

5. **Se ainda tiver erro**: Verifique o console do navegador e os logs do servidor para mais detalhes.

## Alternativa: Desabilitar RLS Temporariamente

Se você quiser **apenas testar** sem as políticas de segurança (NÃO RECOMENDADO para produção):

```sql
-- DESABILITAR RLS (apenas para testes)
ALTER TABLE avaliacoes_desempenho DISABLE ROW LEVEL SECURITY;
```

Isso removerá todas as restrições de segurança. **LEMBRE-SE DE REABILITAR** depois!

## Problemas Comuns

### Erro: "permission denied"
- Certifique-se de estar usando uma conta com permissões de administrador no Supabase
- Ou execute como superusuário

### Erro: "table does not exist"
- Verifique se a tabela `avaliacoes_desempenho` realmente existe
- Execute: `SELECT * FROM information_schema.tables WHERE table_name = 'avaliacoes_desempenho';`

### As políticas não aparecem
- Aguarde alguns segundos e execute novamente o SELECT de verificação
- Limpe o cache do Supabase (Dashboard > Settings > Clear Cache)

## Próximos Passos

Após resolver o problema de RLS, você poderá:

1. ✅ Criar novas avaliações sem erros
2. 🔒 Ajustar as políticas RLS para serem mais restritivas (recomendado)
3. 🧪 Implementar testes automatizados para as políticas RLS
4. 📝 Documentar as permissões de cada tipo de usuário

## Políticas RLS Mais Seguras (Para Produção)

Depois que tudo estiver funcionando, você pode substituir as políticas permissivas por políticas mais seguras:

```sql
-- Exemplo de políticas mais restritivas
DROP POLICY IF EXISTS "avaliacoes_select_all" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_insert_all" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_update_all" ON avaliacoes_desempenho;
DROP POLICY IF EXISTS "avaliacoes_delete_all" ON avaliacoes_desempenho;

-- SELECT: Usuários podem ver suas próprias avaliações ou avaliações que estão avaliando
CREATE POLICY "avaliacoes_select_own" ON avaliacoes_desempenho
  FOR SELECT
  USING (
    funcionario_id = auth.uid() OR
    avaliador_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- INSERT: Apenas admins e managers podem criar avaliações
CREATE POLICY "avaliacoes_insert_admin" ON avaliacoes_desempenho
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- UPDATE: Avaliadores podem atualizar suas avaliações
CREATE POLICY "avaliacoes_update_own" ON avaliacoes_desempenho
  FOR UPDATE
  USING (
    avaliador_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- DELETE: Apenas admins podem deletar
CREATE POLICY "avaliacoes_delete_admin" ON avaliacoes_desempenho
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users_unified
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );
```

## Contato

Se você tiver problemas ou dúvidas, consulte:
- Documentação do Supabase sobre RLS: https://supabase.com/docs/guides/auth/row-level-security
- Issues do repositório do projeto

---

**Nota**: Este arquivo foi gerado automaticamente pelo sistema de correção de bugs.
Data: 2025-11-11
