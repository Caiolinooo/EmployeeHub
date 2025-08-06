# 🚨 Problemas de Autenticação em Produção - Diagnóstico e Soluções

## 📋 **Problemas Identificados**

### 1. **❌ Dados Hardcoded no Código**
**Localização**: `src/lib/auth.ts` (linhas 1142-1144)
```javascript
const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
const adminPassword = process.env.ADMIN_PASSWORD || 'Caio@2122@';
```

**Problema**: Credenciais hardcoded como fallback podem causar problemas em produção.

### 2. **❌ URLs e Chaves Hardcoded**
**Localização**: `src/lib/supabase.ts` (linhas 9-10)
```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://arzvingdtnttiejcvucs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Problema**: Chaves expostas no código fonte.

### 3. **❌ Possível Problema com Hash de Senha**
**Localização**: Sistema de autenticação
**Problema**: Usuário admin pode não ter senha definida ou hash incorreto no Supabase.

### 4. **❌ Falta de Migração de Dados**
**Problema**: Dados importantes ainda não migrados para o Supabase.

## 🔧 **Soluções Implementadas**

### 1. **✅ Scripts de Diagnóstico Criados**
- `scripts/fix-production-auth.js` - Diagnóstico completo
- `scripts/check-admin-password.js` - Verificação específica de senha
- `scripts/migrate-hardcoded-data.js` - Migração de dados hardcoded

### 2. **✅ Código Corrigido**
- Atualizado `src/lib/auth.ts` para buscar credenciais do Supabase
- Atualizado `src/lib/supabase.ts` para configuração dinâmica

### 3. **✅ Sistema de Credenciais Seguras**
- Implementado sistema para buscar credenciais da tabela `app_secrets`
- Fallback para variáveis de ambiente

## 🚀 **Passos para Corrigir em Produção**

### **Passo 1: Executar Scripts de Diagnóstico**
```bash
# Verificar senha do admin
node scripts/check-admin-password.js

# Diagnóstico completo
node scripts/fix-production-auth.js

# Migrar dados hardcoded
node scripts/migrate-hardcoded-data.js
```

### **Passo 2: Verificar Tabela users_unified**
1. Acessar Supabase Dashboard
2. Verificar se tabela `users_unified` existe
3. Verificar se usuário admin existe com:
   - Email: `caio.correia@groupabz.com`
   - Phone: `+5522997847289`
   - Role: `ADMIN`
   - Active: `true`
   - Password: hash bcrypt da senha

### **Passo 3: Configurar Variáveis de Ambiente no Netlify**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://arzvingdtnttiejcvucs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database
DATABASE_URL=postgresql://postgres.arzvingdtnttiejcvucs:Caio%402122%40@aws-0-us-east-2.pooler.supabase.com:6543/postgres

# Admin
ADMIN_EMAIL=caio.correia@groupabz.com
ADMIN_PHONE_NUMBER=+5522997847289
ADMIN_PASSWORD=Caio@2122@
ADMIN_FIRST_NAME=Caio
ADMIN_LAST_NAME=Correia

# JWT
JWT_SECRET=f033ca87f66377b65a90b4b510ff899fdb4c9bd1c5bc2b32731d97759c3815a8

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=apiabzgroup@gmail.com
EMAIL_PASSWORD=zbli vdst fmco dtfc
EMAIL_FROM=apiabzgroup@gmail.com
```

### **Passo 4: Criar Usuário Admin Manualmente (se necessário)**
Execute no SQL Editor do Supabase:
```sql
-- Verificar se usuário existe
SELECT * FROM users_unified WHERE email = 'caio.correia@groupabz.com';

-- Se não existir, criar usuário admin
INSERT INTO users_unified (
  email,
  phone_number,
  first_name,
  last_name,
  password,
  password_hash,
  role,
  position,
  department,
  active,
  is_authorized,
  authorization_status,
  password_last_changed,
  access_permissions,
  created_at,
  updated_at
) VALUES (
  'caio.correia@groupabz.com',
  '+5522997847289',
  'Caio',
  'Correia',
  '$2a$10$hash_da_senha_aqui', -- Use bcrypt para gerar o hash
  '$2a$10$hash_da_senha_aqui', -- Mesmo hash para compatibilidade
  'ADMIN',
  'Administrador do Sistema',
  'TI',
  true,
  true,
  'active',
  NOW(),
  '{"modules":{"dashboard":true,"manual":true,"procedimentos":true,"politicas":true,"calendario":true,"noticias":true,"reembolso":true,"contracheque":true,"ponto":true,"admin":true,"avaliacao":true}}',
  NOW(),
  NOW()
);
```

### **Passo 5: Gerar Hash da Senha**
Use este código Node.js para gerar o hash:
```javascript
const bcrypt = require('bcryptjs');
const password = 'Caio@2122@';
const hash = bcrypt.hashSync(password, 10);
console.log('Hash da senha:', hash);
```

## 🔍 **Verificação Final**

### **Teste de Login Local**
1. Executar `npm run dev`
2. Acessar `/login`
3. Tentar login com:
   - Email: `caio.correia@groupabz.com`
   - Senha: `Caio@2122@`

### **Teste de Login em Produção**
1. Acessar site em produção
2. Tentar login com as mesmas credenciais
3. Verificar logs do Netlify para erros

## 📝 **Checklist de Verificação**

- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Tabela `users_unified` existe no Supabase
- [ ] Usuário admin existe com dados corretos
- [ ] Senha do admin está com hash correto
- [ ] Teste de login local funciona
- [ ] Teste de login em produção funciona
- [ ] Dados hardcoded removidos do código
- [ ] Sistema de credenciais seguras implementado

## 🚨 **Problemas Comuns e Soluções**

### **Erro: "Usuário não encontrado"**
- Verificar se usuário admin existe na tabela `users_unified`
- Verificar se email/telefone estão corretos

### **Erro: "Senha incorreta"**
- Verificar se hash da senha está correto
- Regenerar hash da senha se necessário

### **Erro: "Supabase connection failed"**
- Verificar variáveis de ambiente do Supabase
- Verificar se chaves estão corretas

### **Erro: "Table doesn't exist"**
- Executar script de criação da tabela `users_unified`
- Verificar se migração foi executada corretamente

## 🎯 **Próximos Passos**

1. **Executar scripts de correção**
2. **Configurar variáveis no Netlify**
3. **Testar login em produção**
4. **Implementar monitoramento de autenticação**
5. **Documentar processo de recuperação**
