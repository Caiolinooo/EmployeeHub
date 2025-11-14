# 🔧 Correções Aplicadas - Sistema de Avaliação

## ❌ Problemas Identificados

### 1. **Erro UUID "undefined"**
```
invalid input syntax for type uuid: "undefined"
```
**Causa**: O endpoint `/api/avaliacao/iniciar-periodo` estava usando `verifyRequestToken(request)` que busca token no header Authorization, mas o token estava vindo dos cookies.

### 2. **Erro 401 ao Preencher Avaliação**
```
POST /api/avaliacao/iniciar-periodo 401
```
**Causa**: Inconsistência na verificação do token - misturando cookies e headers.

### 3. **Erro 500 ao Criar Avaliação**
**Causa**: userId estava undefined devido à verificação incorreta do token.

---

## ✅ Correções Implementadas

### 1. **Corrigido Autenticação nos Endpoints**

#### `/api/avaliacao/iniciar-periodo/route.ts`
**ANTES**:
```typescript
import { verifyRequestToken } from '@/lib/auth';

const cookieStore = cookies();
const token = cookieStore.get('token')?.value;
const decoded = await verifyRequestToken(request); // ❌ Busca no header
const userId = decoded.payload.userId;
```

**DEPOIS**:
```typescript
import { verifyToken } from '@/lib/auth';

const cookieStore = await cookies();
const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;
const decoded = verifyToken(token); // ✅ Verifica o token dos cookies
const userId = decoded.userId; // ✅ Acesso direto
```

**Mudanças**:
- ✅ Usar `verifyToken` diretamente (síncrono)
- ✅ Buscar token de `abzToken` ou `token` (fallback)
- ✅ Await no `cookies()` (Next.js 15)
- ✅ Acessar `decoded.userId` diretamente

### 2. **Adicionados Logs Detalhados**

```typescript
console.log('🔐 Verificando autenticação...');
console.log('Token presente:', !!token);
console.log('✅ Usuário autenticado:', userId);
console.log('📋 Dados recebidos:', { userId, periodo_id });
console.log('🔍 Buscando período:', periodo_id);
console.log('✅ Período encontrado:', periodo.nome);
console.log('📅 Verificando datas:', { hoje, dataInicio });
console.log('🔍 Verificando avaliação existente para:', { funcionario_id: userId, periodo_id });
console.log('📝 Nenhuma avaliação existente, criando nova...');
console.log('🔍 Buscando gerente para colaborador:', userId);
console.log('✅ Gerente encontrado:', mapping.gerente_id);
console.log('📝 Criando nova avaliação...');
console.log('✅ Avaliação criada com sucesso:', novaAvaliacao.id);
```

**Benefícios**:
- 🔍 Rastreamento completo do fluxo
- 🐛 Identificação rápida de problemas
- 📊 Visibilidade do processo

### 3. **Corrigido Endpoint GET/PATCH `/api/avaliacao/[id]`**

**Mesma correção aplicada**:
```typescript
// ANTES
import { verifyRequestToken } from '@/lib/auth';
const decoded = await verifyRequestToken(request);
const userId = decoded.payload.userId;

// DEPOIS
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

const cookieStore = await cookies();
const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;
const decoded = verifyToken(token);
const userId = decoded.userId;
```

### 4. **Corrigido Página de Preenchimento**

`/app/avaliacao/preencher/[id]/page.tsx`:
```typescript
// ANTES
const decoded = await verifyToken(token); // ❌ verifyToken não é async

// DEPOIS
const decoded = verifyToken(token); // ✅ Chamada síncrona
```

---

## 🧪 Como Testar

### 1. **Limpar e Reiniciar**
```bash
# Parar o servidor
Ctrl+C

# Limpar cache Next.js
Remove-Item -Recurse -Force .next

# Reinstalar (se necessário)
npm install

# Iniciar servidor
npm run dev
```

### 2. **Testar Fluxo Completo**

#### Passo 1: Criar Período (Admin)
```sql
-- No Supabase SQL Editor
INSERT INTO periodos_avaliacao (
  nome,
  descricao,
  data_inicio,
  data_fim,
  data_limite_autoavaliacao,
  ativo
) VALUES (
  'Teste Avaliação Q1 2025',
  'Período de teste para avaliação',
  '2025-11-01',
  '2025-12-31',
  '2025-11-30',
  true
) RETURNING id;
```

#### Passo 2: Configurar Gerente
```sql
-- Pegar UUID do período criado acima
INSERT INTO avaliacao_colaborador_gerente (
  colaborador_id,
  gerente_id,
  periodo_id
) VALUES (
  '75abe69b-15ac-4ac2-b973-1075c37252c5', -- Seu user ID
  'UUID_DO_GERENTE', -- UUID de outro usuário como gerente
  'UUID_DO_PERIODO' -- UUID retornado acima
);
```

#### Passo 3: Acessar Dashboard
1. Login como colaborador
2. Acessar `/avaliacao`
3. Verificar se o card do período aparece
4. Clicar em "Iniciar Minha Avaliação"

#### Passo 4: Verificar Logs no Terminal
Você deve ver:
```
🔐 Verificando autenticação...
Token presente: true
✅ Usuário autenticado: 75abe69b-15ac-4ac2-b973-1075c37252c5
📋 Dados recebidos: { userId: '75abe69b-15ac-4ac2-b973-1075c37252c5', periodo_id: 'UUID_DO_PERIODO' }
✅ Cliente Supabase Admin obtido
🔍 Buscando período: UUID_DO_PERIODO
✅ Período encontrado: Teste Avaliação Q1 2025
📅 Verificando datas: { hoje: '2025-11-13', dataInicio: '2025-11-01' }
🔍 Verificando avaliação existente para: { funcionario_id: '...', periodo_id: '...' }
📝 Nenhuma avaliação existente, criando nova...
🔍 Buscando gerente para colaborador: 75abe69b-15ac-4ac2-b973-1075c37252c5
✅ Gerente encontrado: UUID_DO_GERENTE
📝 Criando nova avaliação...
✅ Avaliação criada com sucesso: UUID_DA_AVALIACAO
POST /api/avaliacao/iniciar-periodo 200
```

#### Passo 5: Preencher Avaliação
1. Deve redirecionar para `/avaliacao/preencher/[id]`
2. Formulário Q11-Q14 deve aparecer
3. Preencher estrelas e comentários
4. Salvar rascunho ou enviar

---

## 🔍 Verificações de Troubleshooting

### Se ainda der erro de UUID undefined:

**Verificar se o token está nos cookies**:
```javascript
// No DevTools Console
document.cookie.split(';').find(c => c.includes('abzToken'))
```

**Verificar se o userId está no token**:
```javascript
// Decodificar JWT
const token = document.cookie.split(';').find(c => c.includes('abzToken'))?.split('=')[1];
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload); // Deve ter userId
```

### Se der erro 401:

**Verificar se o token está expirado**:
```sql
-- No Supabase SQL Editor
SELECT * FROM usuarios WHERE id = '75abe69b-15ac-4ac2-b973-1075c37252c5';
```

**Fazer novo login**:
1. Logout
2. Login novamente
3. Tentar criar avaliação

### Se der erro "Gerente não configurado":

```sql
-- Verificar mapeamento
SELECT * FROM avaliacao_colaborador_gerente 
WHERE colaborador_id = '75abe69b-15ac-4ac2-b973-1075c37252c5';

-- Se vazio, criar
INSERT INTO avaliacao_colaborador_gerente (colaborador_id, gerente_id)
VALUES (
  '75abe69b-15ac-4ac2-b973-1075c37252c5',
  'UUID_DE_OUTRO_USUARIO'
);
```

---

## 📊 Estrutura de Dados Esperada

### Token Payload
```json
{
  "userId": "75abe69b-15ac-4ac2-b973-1075c37252c5",
  "role": "ADMIN",
  "exp": "2025-11-13T22:17:43.000Z",
  "iat": "2025-11-12T22:17:43.000Z"
}
```

### Request Body (/iniciar-periodo)
```json
{
  "periodo_id": "UUID_DO_PERIODO"
}
```

### Response Success
```json
{
  "success": true,
  "message": "Avaliação criada com sucesso",
  "avaliacao": {
    "id": "UUID_DA_AVALIACAO",
    "funcionario_id": "75abe69b-15ac-4ac2-b973-1075c37252c5",
    "gerente_id": "UUID_DO_GERENTE",
    "periodo_id": "UUID_DO_PERIODO",
    "status": "pendente_autoavaliacao",
    "respostas": {},
    ...
  },
  "isNew": true
}
```

---

## 🎯 Próximos Passos

1. ✅ **Testar criação de avaliação** (deve funcionar agora)
2. 📝 **Preencher avaliação Q11-Q14** (colaborador)
3. 👔 **Revisar como gerente Q15-Q17**
4. ✅ **Verificar cálculo de nota final**

---

**Status**: ✅ Correções aplicadas e prontas para teste
**Data**: 13/11/2025
**Próxima ação**: Testar fluxo completo no navegador
