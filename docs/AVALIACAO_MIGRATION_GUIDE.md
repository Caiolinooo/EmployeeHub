# Guia de Migração - Módulo de Avaliação de Desempenho

## Problema

O sistema está reportando o erro: `Could not find the function public.execute_sql(sql) in the schema cache`

Isso ocorre porque a função `execute_sql` não está disponível no banco de dados Supabase. Esta função é usada para executar comandos SQL dinamicamente.

## Solução Recomendada: Execução Manual

Como a função `execute_sql` não está disponível, você precisará executar a migração SQL manualmente através do Supabase Dashboard.

### Passo a Passo

#### 1. Acesse o Supabase Dashboard
- Faça login no [Supabase Dashboard](https://app.supabase.com)
- Selecione o seu projeto

#### 2. Abra o SQL Editor
- No menu lateral, clique em **SQL Editor**
- Clique em **New query** para criar uma nova consulta

#### 3. Cole o SQL da Migração
Você tem duas opções:

**Opção A: Usar o arquivo de migração**
- Abra o arquivo: `/supabase/migrations/20251110_avaliacao_desempenho_migration.sql`
- Copie todo o conteúdo
- Cole no SQL Editor do Supabase

**Opção B: Usar o botão no painel de admin**
- Acesse o painel de admin no sistema
- Vá para a seção de Avaliação de Desempenho
- Clique em "Executar Migration"
- O sistema irá gerar o SQL e mostrar um botão "Copiar SQL"
- Copie o SQL e cole no SQL Editor do Supabase

#### 4. Execute a Migration
- Clique em **Run** ou pressione `Ctrl+Enter` (Windows/Linux) ou `Cmd+Enter` (Mac)
- Aguarde a confirmação de sucesso

#### 5. Verifique o Resultado
Você deverá ver uma mensagem de sucesso confirmando que:
- As colunas foram adicionadas à tabela `funcionarios`
- A tabela `periodos_avaliacao` foi criada
- As colunas foram adicionadas à tabela `avaliacoes_desempenho`
- Os índices foram criados
- As políticas RLS foram configuradas

## O que a Migration Faz

Esta migration adiciona os seguintes recursos ao banco de dados:

### 1. Novos Campos em `funcionarios`
- `is_gerente_avaliacao`: Indica se o funcionário é gerente de avaliação
- `is_lider`: Indica se o funcionário é líder de equipe

### 2. Nova Tabela `periodos_avaliacao`
Gerencia os períodos de avaliação de desempenho:
- `id`: Identificador único
- `nome`: Nome do período
- `descricao`: Descrição do período
- `data_inicio`: Data de início
- `data_fim`: Data de término
- `data_limite_autoavaliacao`: Data limite para autoavaliação
- `data_limite_aprovacao`: Data limite para aprovação
- `ativo`: Se o período está ativo
- `created_at`: Data de criação
- `updated_at`: Data de atualização

### 3. Novos Campos em `avaliacoes_desempenho`
- `comentario_avaliador`: Comentário do avaliador (Q15)
- `status_aprovacao`: Status do workflow (pendente, aprovado, rejeitado)
- `data_autoavaliacao`: Data da autoavaliação
- `data_aprovacao`: Data da aprovação
- `aprovado_por`: ID do usuário que aprovou

### 4. Índices para Performance
- Índice para gerentes de avaliação
- Índice para líderes
- Índice para períodos ativos
- Índice para status de aprovação

### 5. Políticas de Segurança (RLS)
- Todos podem ver períodos ativos
- Admins podem ver e gerenciar todos os períodos

## Solução Alternativa: Criar a Função `execute_sql`

Se você preferir criar a função `execute_sql` para facilitar futuras migrations:

### 1. Execute no SQL Editor do Supabase:

```sql
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Dar permissões adequadas
GRANT EXECUTE ON FUNCTION execute_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql(text) TO service_role;
```

### 2. Após criar a função:
- Volte ao painel de admin
- Tente executar a migration novamente
- Agora deve funcionar automaticamente

## Observações de Segurança

⚠️ **IMPORTANTE**: A função `execute_sql` com `SECURITY DEFINER` permite executar qualquer SQL. Por motivos de segurança:
- Certifique-se de que apenas usuários admin possam chamar esta função
- Considere adicionar validações adicionais
- Monitore o uso desta função

## Problemas Comuns

### Erro: "relation does not exist"
Se você receber erros sobre tabelas que não existem:
1. Verifique se as tabelas `funcionarios` e `avaliacoes_desempenho` existem
2. Se não existirem, você precisará criá-las primeiro
3. Consulte a documentação de setup inicial

### Erro: "column already exists"
Se alguma coluna já existir:
- Não é um problema! A migration usa `ADD COLUMN IF NOT EXISTS`
- O erro é esperado e seguro
- Continue com o resto da migration

### Erro de Permissão
Se você receber erros de permissão:
1. Certifique-se de que está usando o Supabase Dashboard como proprietário do projeto
2. Ou use o Service Role Key no backend

## Contato e Suporte

Se você encontrar problemas:
1. Verifique os logs do Supabase para detalhes do erro
2. Consulte a documentação do Supabase sobre SQL Editor
3. Entre em contato com o administrador do sistema
