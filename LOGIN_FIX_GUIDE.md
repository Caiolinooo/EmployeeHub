# 🔧 Guia de Correção de Problemas de Login

## 📋 Problema Identificado

Após a correção da vulnerabilidade de segurança que permitia login com qualquer senha, alguns usuários regulares (como ludimila e karla) **não conseguem fazer login mesmo com a senha correta**.

## 🔍 Possíveis Causas

1. **Senhas armazenadas em plaintext** - Senhas não estão hasheadas com bcrypt no banco de dados
2. **Senhas desconhecidas** - As senhas reais desses usuários não são conhecidas
3. **Contas bloqueadas** - Múltiplas tentativas falhas de login bloquearam as contas
4. **Campo de senha incorreto** - Senha está no campo errado (`password` vs `password_hash`)

## 🛠️ Ferramentas de Diagnóstico

### 1️⃣ Verificar Estado das Senhas

**Via API (recomendado):**
```bash
# Em desenvolvimento
curl http://localhost:3000/api/debug/check-passwords

# Em produção
curl https://seu-dominio.com/api/debug/check-passwords
```

**Via Script:**
```bash
node scripts/check-user-passwords.js
```

**O que isso mostra:**
- ✅ Quais usuários têm senhas bcrypt válidas
- ❌ Quais usuários têm senhas em plaintext
- ⚠️  Quais usuários não têm senha definida
- 📊 Estatísticas gerais do banco

### 2️⃣ Resetar Senha de Usuário

**Via API:**
```bash
# Por email
curl -X POST http://localhost:3000/api/debug/reset-user-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ludimila@example.com",
    "newPassword": "NovaSenha123!"
  }'

# Por telefone
curl -X POST http://localhost:3000/api/debug/reset-user-password \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+5522999999999",
    "newPassword": "NovaSenha123!"
  }'
```

**O que isso faz:**
1. ✅ Hash da senha com bcrypt (seguro)
2. ✅ Atualiza campos `password` e `password_hash`
3. ✅ Reseta contador de tentativas falhas (`failed_login_attempts`)
4. ✅ Remove bloqueio de conta (`lock_until`)
5. ✅ Atualiza `password_last_changed`

## 📝 Passo a Passo para Corrigir Ludimila e Karla

### Opção 1: Usando a API (Recomendado)

1. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

2. **Verifique o estado atual das senhas:**
   ```bash
   curl http://localhost:3000/api/debug/check-passwords | jq
   ```

3. **Resete as senhas:**
   ```bash
   # Para Ludimila
   curl -X POST http://localhost:3000/api/debug/reset-user-password \
     -H "Content-Type: application/json" \
     -d '{
       "email": "ludimila.email@dominio.com",
       "newPassword": "SenhaSegura123!"
     }'

   # Para Karla
   curl -X POST http://localhost:3000/api/debug/reset-user-password \
     -H "Content-Type: application/json" \
     -d '{
       "email": "karla.email@dominio.com",
       "newPassword": "SenhaSegura123!"
     }'
   ```

4. **Teste o login:**
   - Acesse a página de login
   - Use o email e a nova senha
   - O login deve funcionar normalmente

### Opção 2: Via Supabase Dashboard

1. **Acesse o Supabase Dashboard:**
   - URL: https://arzvingdtnttiejcvucs.supabase.co

2. **Vá para Table Editor > users_unified**

3. **Para cada usuário (ludimila e karla):**
   - Clique no botão de editar
   - Gere um hash bcrypt da nova senha usando:
     ```javascript
     // No console do navegador
     const bcrypt = require('bcryptjs');
     const hash = await bcrypt.hash('SuaSenha123!', 10);
     console.log(hash);
     ```
   - Atualize os campos:
     - `password`: Cole o hash gerado
     - `password_hash`: Cole o hash gerado
     - `failed_login_attempts`: 0
     - `lock_until`: null
     - `password_last_changed`: data atual

### Opção 3: Via Script SQL Direto

```sql
-- Substitua 'user@email.com' e o hash pela senha desejada
-- Para gerar o hash: bcrypt.hash('SuaSenha', 10)

UPDATE users_unified
SET
  password = '$2a$10$HASH_GERADO_AQUI',
  password_hash = '$2a$10$HASH_GERADO_AQUI',
  failed_login_attempts = 0,
  lock_until = NULL,
  password_last_changed = NOW(),
  updated_at = NOW()
WHERE email = 'ludimila@example.com';
```

## 🔐 Sobre os Dois Caminhos de Login

O sistema atualmente tem **DOIS** caminhos de autenticação:

### 1️⃣ Admin (Plaintext) - Linhas 1192-1266 em `src/lib/auth.ts`
```typescript
if (isAdmin) {
  if (password === adminPassword) {  // Comparação PLAINTEXT
    // Login bem-sucedido
  }
}
```
**Por que funciona:** O admin usa comparação direta da senha com `process.env.ADMIN_PASSWORD`

### 2️⃣ Usuários Regulares (Bcrypt) - Linhas 1621-1644 em `src/lib/auth.ts`
```typescript
// Tenta campo 'password'
let isPasswordValid = await bcrypt.compare(password, user.password);

// Se falhar, tenta campo 'password_hash'
if (!isPasswordValid && user.password_hash) {
  isPasswordValid = await bcrypt.compare(password, user.password_hash);
}
```
**Por que pode falhar:** Requer que a senha esteja **hasheada com bcrypt** no banco

## ⚠️ IMPORTANTE: Segurança

### ✅ O que está correto agora:
1. ✅ Vulnerabilidade de bypass de autenticação CORRIGIDA
2. ✅ Login rejeita senhas incorretas corretamente
3. ✅ Senhas hasheadas com bcrypt para novos usuários
4. ✅ Sistema de bloqueio após múltiplas tentativas

### ⚠️ O que precisa melhorar:
1. ⚠️  Admin ainda usa comparação plaintext (deveria usar bcrypt)
2. ⚠️  Endpoints de debug devem ser protegidos ou removidos em produção
3. ⚠️  Considerar migração de todos os usuários para bcrypt

## 📊 Logs Úteis para Depuração

Os logs a seguir ajudam a entender problemas de login:

```
✅ Senha correta: "✅ Senha correta, gerando token"
❌ Senha errada: "❌ Senha incorreta"
⚠️  Sem senha: "Usuário não possui senha definida"
🔒 Conta bloqueada: "Conta do usuário está bloqueada"
```

## 🎯 Próximos Passos Recomendados

1. **Resetar senhas de ludimila e karla** usando a API de reset
2. **Testar login** com as novas senhas
3. **Verificar logs** para confirmar que a autenticação está funcionando
4. **Considerar remover endpoints de debug** em produção (ou proteger com autenticação de admin)
5. **Migrar admin para bcrypt** para consistência e segurança

## 📞 Suporte

Se o problema persistir após seguir este guia:

1. Verifique os logs do servidor durante a tentativa de login
2. Use a API `/api/debug/check-passwords` para verificar o estado do banco
3. Confirme que a senha está sendo inserida corretamente (sem espaços extras, caps lock, etc.)
4. Verifique se a conta não está bloqueada (`lock_until` no banco)

---

**Última atualização:** 2025-11-07
