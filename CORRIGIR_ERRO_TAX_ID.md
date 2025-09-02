# 🔧 CORREÇÃO: Erro "Could not find the 'tax_id' column"

## ❌ **Erro Atual:**
```
Falha ao reconciliar criando users_unified: {
  code: 'PGRST204',
  details: null,
  hint: null,
  message: "Could not find the 'tax_id' column of 'users_unified' in the schema cache"
}
```

## 🔍 **Causa do Problema:**
- A coluna `tax_id` não existe na tabela `users_unified` no banco de dados Supabase
- O código está tentando inserir dados na coluna que não foi criada
- A migração para adicionar esta coluna não foi executada

## ✅ **SOLUÇÃO RÁPIDA - Execute no Supabase:**

### **Passo 1: Acesse o Supabase Dashboard**
1. Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá para **SQL Editor** no menu lateral

### **Passo 2: Execute o Script de Correção**
Copie e cole o seguinte script no SQL Editor:

```sql
-- CORREÇÃO: Adicionar coluna tax_id
BEGIN;

-- Adicionar coluna tax_id se não existir
ALTER TABLE users_unified
  ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_unified_tax_id ON users_unified(tax_id);

-- Adicionar comentário para documentação
COMMENT ON COLUMN users_unified.tax_id IS 'CPF/CNPJ ou outro número de identificação fiscal';

COMMIT;

-- Verificar se funcionou
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users_unified' AND column_name = 'tax_id';
```

### **Passo 3: Clique em "Run" para executar**

### **Passo 4: Verificar o Resultado**
Você deve ver uma linha mostrando:
```
column_name | data_type | is_nullable
tax_id      | text      | YES
```

## 🔄 **SOLUÇÃO ALTERNATIVA - Via Arquivo:**

Se preferir usar o arquivo criado:

1. **Abra o arquivo:** `FIX_TAX_ID_COLUMN.sql`
2. **Copie todo o conteúdo**
3. **Cole no SQL Editor do Supabase**
4. **Execute o script**

## 🧪 **Testar a Correção:**

Após executar o script:

1. **Teste o registro novamente:**
   - Acesse: `http://localhost:3000/register`
   - Preencha os campos (incluindo CPF)
   - Envie o formulário

2. **Resultado esperado:**
   - ✅ Registro bem-sucedido
   - ✅ Sem erro de coluna não encontrada
   - ✅ CPF salvo corretamente no banco

## 📋 **Verificação Adicional:**

Para confirmar que tudo está funcionando, execute no SQL Editor:

```sql
-- Verificar estrutura da tabela
\d users_unified;

-- Ou usar este comando alternativo:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users_unified'
ORDER BY ordinal_position;
```

## 🎯 **Colunas Esperadas na Tabela users_unified:**

Após a correção, a tabela deve ter estas colunas principais:
- ✅ `id` (UUID)
- ✅ `email` (TEXT)
- ✅ `first_name` (TEXT)
- ✅ `last_name` (TEXT)
- ✅ `phone_number` (TEXT)
- ✅ `tax_id` (TEXT) ← **NOVA COLUNA**
- ✅ `role` (TEXT)
- ✅ `position` (TEXT)
- ✅ `department` (TEXT)
- ✅ `active` (BOOLEAN)
- ✅ `created_at` (TIMESTAMP)
- ✅ `updated_at` (TIMESTAMP)

## 🚨 **Se o Erro Persistir:**

1. **Limpe o cache do Supabase:**
   - No dashboard do Supabase, vá para Settings
   - Procure por "Reset" ou "Clear Cache"

2. **Reinicie o servidor local:**
   ```bash
   # Pare o servidor (Ctrl+C)
   # Reinicie
   npm run dev
   ```

3. **Verifique se a migração foi aplicada:**
   ```sql
   SELECT * FROM information_schema.columns 
   WHERE table_name = 'users_unified' AND column_name = 'tax_id';
   ```

## 🎉 **Resultado Final:**

Após aplicar a correção:
- ✅ Coluna `tax_id` criada na tabela `users_unified`
- ✅ Registro de usuários funcionando com CPF
- ✅ Sem mais erros de coluna não encontrada
- ✅ Sistema completamente funcional

**⚡ EXECUTE O SCRIPT NO SUPABASE AGORA PARA RESOLVER O PROBLEMA!**
