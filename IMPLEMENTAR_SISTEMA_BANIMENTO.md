# 🚫 SISTEMA DE BANIMENTO DE USUÁRIOS

## ✅ **IMPLEMENTAÇÃO COMPLETA**

### 📋 **Como Funciona**

1. **REJEITAR USUÁRIO** = **Banimento Permanente**
   - Usuário é adicionado à tabela `banned_users`
   - Não pode mais se cadastrar com email, telefone ou CPF
   - Status: `authorization_status = 'rejected'`

2. **DELETAR USUÁRIO** = **Remove Banimento**
   - Usuário é removido da tabela `banned_users`
   - Pode se cadastrar novamente e passar por nova aprovação
   - Permite "segunda chance"

3. **NÃO FAZER NADA** = **Aprovação Automática**
   - Usuário pode completar cadastro normalmente
   - Recebe role `USER` padrão

### 🗄️ **Estrutura do Banco**

#### Tabela `banned_users`:
```sql
- id (UUID, PK)
- email (TEXT)
- phone_number (TEXT)
- cpf (TEXT)
- banned_at (TIMESTAMP)
- banned_by (UUID, FK para users_unified)
- ban_reason (TEXT)
- original_user_id (UUID)
- first_name (TEXT)
- last_name (TEXT)
```

### 🔧 **Arquivos Implementados**

#### **1. Scripts SQL**
- `scripts/create-banned-users-table.sql` - Criar tabela e políticas

#### **2. Biblioteca de Funções**
- `src/lib/banned-users.ts` - Funções para gerenciar banimentos

#### **3. APIs Modificadas**
- `src/app/api/admin/users/[id]/reject/route.ts` - Adiciona à lista de banidos
- `src/app/api/users/[id]/route.ts` - Remove da lista de banidos ao deletar
- `src/app/api/auth/quick-register/route.ts` - Verifica banimento no registro
- `src/app/api/auth/register-supabase/route.ts` - Verifica banimento no registro

#### **4. Nova API de Gerenciamento**
- `src/app/api/admin/banned-users/route.ts` - CRUD de usuários banidos

#### **5. Interface de Administração**
- `src/components/admin/BannedUsersManager.tsx` - Componente de gerenciamento
- `src/app/admin/banned-users/page.tsx` - Página de usuários banidos
- Menu adicionado no layout de administração

### 🚀 **Como Usar**

#### **Para Administradores:**

1. **Banir Usuário:**
   - Vá em "Configurações de Aprovação" ou "Gerenciamento de Usuários"
   - Clique em "Rejeitar" no usuário desejado
   - ✅ Usuário é banido permanentemente

2. **Remover Banimento:**
   - **Opção 1:** Deletar o usuário (permite novo cadastro)
   - **Opção 2:** Ir em "Usuários Banidos" e clicar "Desbanir"

3. **Visualizar Banidos:**
   - Menu Admin → "Usuários Banidos"
   - Lista todos os usuários banidos com detalhes

#### **Para Usuários:**
- Se tentar se cadastrar e estiver banido, receberá erro 403
- Mensagem: "Este usuário foi banido permanentemente..."

### 📝 **Passos para Implementar**

1. **Execute o SQL no Supabase:**
```bash
# Copie e execute o conteúdo de:
scripts/create-banned-users-table.sql
```

2. **Teste o Sistema:**
   - Cadastre um usuário teste
   - Rejeite o usuário (deve ser banido)
   - Tente cadastrar novamente (deve dar erro)
   - Delete o usuário (deve remover banimento)
   - Cadastre novamente (deve funcionar)

### 🔍 **Verificações de Segurança**

- ✅ Verifica email, telefone E CPF para banimento
- ✅ RLS habilitado (apenas admins podem gerenciar)
- ✅ Logs de quem aplicou o banimento
- ✅ Histórico completo de banimentos
- ✅ Interface amigável para administradores

### 🎯 **Fluxo Completo**

```
USUÁRIO SE CADASTRA
        ↓
ADMIN VÊ SOLICITAÇÃO
        ↓
┌─────────────────┬─────────────────┬─────────────────┐
│   APROVAR       │   REJEITAR      │   IGNORAR       │
│                 │                 │                 │
│ ✅ Usuário      │ 🚫 Usuário      │ ⏳ Usuário      │
│ vira ativo      │ é BANIDO        │ pode completar  │
│                 │ permanentemente │ cadastro        │
└─────────────────┴─────────────────┴─────────────────┘
                          │
                          ↓
                  ADMIN PODE DELETAR
                          │
                          ↓
                  🔄 REMOVE BANIMENTO
                  (permite novo cadastro)
```

### 🚨 **Importante**

- **SEMPRE** execute o script SQL primeiro
- **TESTE** em ambiente de desenvolvimento
- **BACKUP** do banco antes de aplicar em produção
- **DOCUMENTE** os banimentos para auditoria
