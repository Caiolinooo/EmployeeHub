# Correções do Módulo de Avaliação

## Resumo das Correções

Este documento descreve as correções realizadas no módulo de avaliação para resolver os problemas reportados.

## Problemas Identificados e Corrigidos

### 1. ✅ Modal de Visualização e Edição Não Aparece

**Problema:** As páginas de visualização (`/ver/[id]`) e edição (`/editar/[id]`) estavam usando a tabela antiga `avaliacoes` em vez de `avaliacoes_desempenho`.

**Solução:**
- Atualizado `/src/app/avaliacao/ver/[id]/page.tsx` para usar `avaliacoes_desempenho`
- Atualizado `/src/app/avaliacao/editar/[id]/page.tsx` para usar `avaliacoes_desempenho`
- Corrigidos os joins com a tabela `funcionarios` usando os foreign keys corretos

**Arquivos modificados:**
- `src/app/avaliacao/ver/[id]/page.tsx`
- `src/app/avaliacao/editar/[id]/page.tsx`

### 2. ✅ Lógica de Permissões

**Problema:** As permissões não estavam funcionando corretamente devido à inconsistência de tabelas.

**Solução:**
- As permissões já estão corretamente implementadas no código:
  - **Usuário comum:** Pode ver suas próprias avaliações
  - **Gerentes:** Podem ver suas avaliações e as dos funcionários que avaliam
  - **Admins:** Podem ver todas as avaliações
- A correção das tabelas resolve o problema de visualização

**Implementação:**
- RLS (Row Level Security) configurado na tabela `avaliacoes_desempenho`
- Filtros corretos nas queries baseados em `isAdmin` e `isManager`

### 3. ✅ Avaliações Não Iam para a Lixeira

**Problema:** A página de lixeira estava usando a tabela `avaliacoes` em vez de `avaliacoes_desempenho`.

**Solução:**
- Atualizado `/src/app/avaliacao/lixeira/page.tsx` para usar `avaliacoes_desempenho`
- Corrigido status de avaliações arquivadas de `'archived'` para `'arquivada'` (consistente com a tabela)
- Soft delete funciona através do campo `deleted_at`

**Arquivos modificados:**
- `src/app/avaliacao/lixeira/page.tsx`

### 4. ✅ Sistema de 30 Dias na Lixeira

**Problema:** Não havia implementação para remover automaticamente avaliações após 30 dias na lixeira.

**Solução:**
- Criada API de limpeza automática: `/api/avaliacao/cleanup-trash`
- Suporta dois métodos:
  - **GET:** Para cron jobs (com autenticação via `CRON_SECRET`)
  - **POST:** Para admins executarem limpeza manual
- Adiciona indicador visual de dias restantes na página de lixeira
- Botão para admins executarem limpeza manual

**Novos recursos:**
- Badge colorido mostrando dias restantes:
  - 🔴 Vermelho: 7 dias ou menos
  - 🟡 Amarelo: 8-15 dias
  - 🔵 Azul: 16-30 dias
- Botão "Executar Limpeza Automática" (apenas para admins)

**Arquivos criados/modificados:**
- `src/app/api/avaliacao/cleanup-trash/route.ts` (novo)
- `src/app/avaliacao/lixeira/page.tsx` (modificado)

### 5. ✅ Lista de Funcionários

**Problema:** Verificada preocupação sobre uso de tabela `unified_users`.

**Solução:**
- A tabela `funcionarios` já está corretamente configurada com `user_id` referenciando `users`
- O join com `users:user_id(id, role)` está funcionando corretamente
- A página de edição agora filtra avaliadores baseado no `role` do usuário (ADMIN/MANAGER)

**Implementação:**
- Página de edição usa join `funcionarios -> users` para verificar roles
- Filtro correto de avaliadores: apenas ADMIN e MANAGER

## Configuração para Limpeza Automática

### Opção 1: Cron Job Manual

Adicione ao seu cron:

```bash
# Executar diariamente à 3h da manhã
0 3 * * * curl -H "Authorization: Bearer SEU_CRON_SECRET" https://seu-dominio.com/api/avaliacao/cleanup-trash
```

### Opção 2: Vercel Cron Jobs

Adicione ao `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/avaliacao/cleanup-trash",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### Opção 3: GitHub Actions

Crie `.github/workflows/cleanup-trash.yml`:

```yaml
name: Cleanup Trash
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Execute cleanup
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://seu-dominio.com/api/avaliacao/cleanup-trash
```

### Variáveis de Ambiente

Adicione ao `.env`:

```bash
CRON_SECRET=seu-segredo-super-secreto-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-chave-de-servico-supabase
```

## Fluxo de Avaliações

```
1. Avaliação Criada
   └─> Status: 'pendente'
   └─> Tabela: avaliacoes_desempenho
   └─> deleted_at: NULL

2. Avaliação Deletada (Soft Delete)
   └─> Status: 'arquivada'
   └─> deleted_at: <data_atual>
   └─> Aparece na lixeira

3. Após 30 dias
   └─> Limpeza automática
   └─> Pontuações deletadas (CASCADE)
   └─> Avaliação deletada permanentemente
```

## Testes Recomendados

1. **Teste de Visualização:**
   - ✅ Admin pode ver todas as avaliações
   - ✅ Gerente pode ver suas avaliações e dos subordinados
   - ✅ Usuário comum pode ver apenas suas avaliações

2. **Teste de Edição:**
   - ✅ Admin pode editar todas as avaliações
   - ✅ Gerente pode editar avaliações onde é avaliador
   - ✅ Lista de funcionários carrega corretamente
   - ✅ Lista de avaliadores mostra apenas ADMIN/MANAGER

3. **Teste de Lixeira:**
   - ✅ Avaliações deletadas aparecem na lixeira
   - ✅ Dias restantes são exibidos corretamente
   - ✅ Restauração funciona
   - ✅ Exclusão permanente funciona
   - ✅ Limpeza automática (manual) funciona

4. **Teste de Limpeza Automática:**
   - ✅ API GET funciona com CRON_SECRET
   - ✅ API POST funciona para admins
   - ✅ Avaliações com 30+ dias são excluídas
   - ✅ Pontuações relacionadas são excluídas

## Tabelas Envolvidas

### avaliacoes_desempenho
- `id`: UUID (PK)
- `funcionario_id`: UUID (FK -> funcionarios)
- `avaliador_id`: UUID (FK -> funcionarios)
- `periodo`: TEXT
- `status`: TEXT (pendente, em_andamento, concluida, arquivada)
- `deleted_at`: TIMESTAMP (soft delete)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### funcionarios
- `id`: UUID (PK)
- `nome`: TEXT
- `user_id`: UUID (FK -> users)
- `deleted_at`: TIMESTAMP

### users
- `id`: UUID (PK)
- `role`: TEXT (ADMIN, MANAGER, USER)

## Status Válidos

- `pendente`: Avaliação criada, aguardando preenchimento
- `em_andamento`: Avaliação sendo preenchida
- `concluida`: Avaliação finalizada
- `arquivada`: Avaliação movida para lixeira (soft delete)
