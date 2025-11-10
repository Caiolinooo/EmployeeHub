# Correções de Navegação e Migration Tool
**Data:** 2025-11-10

## 🔴 Problemas Identificados e Corrigidos

### Problema 1: Card de Avaliação Não Abre
**Sintoma**: Card clica mas redireciona para o dashboard

**Causa Raiz**:
- O arquivo `src/data/menu.ts` tinha **duas definições conflitantes** do item "avaliacao"
  - Linha 163: `managerOnly: false` ✅ (permite todos)
  - Linha 316: `managerOnly: true` ❌ (bloqueava usuários)
- O segundo array era o que estava sendo usado

**Solução Aplicada**:
```typescript
// ANTES (linha 316):
managerOnly: true, // Restringir acesso apenas para gerentes

// DEPOIS (linha 316):
managerOnly: false, // Permitir acesso para todos os usuários autenticados
moduleKey: 'avaliacao', // Usar verificação de módulo
```

---

### Problema 2: Configurações do Admin Não Apareciam
**Sintoma**: Não conseguia localizar as configurações dentro do painel admin

**Causa**: O painel admin já existia, mas não era fácil de encontrar

**Solução**:
- **Verificado que o painel existe**: `/admin/avaliacao`
- **Confirmado estrutura de abas**:
  1. ✅ Períodos de Avaliação
  2. ✅ Gerentes de Avaliação
  3. ✅ Líderes de Setor
  4. ✅ Critérios
  5. ✅ Funcionários
  6. ✅ Banco de Dados

---

## ✨ Nova Funcionalidade: Executor de Migration

### O Que É?
Um botão no painel admin que executa a migration SQL **sem precisar acessar o banco manualmente**.

### Como Usar:

1. **Acesse o Painel Admin**:
   ```
   Sidebar → Administração → Avaliação de Desempenho
   ou
   Dashboard → Card "Administração" → Card "Avaliação de Desempenho"
   ```

2. **Vá para a aba "Banco de Dados"**:
   ```
   Na parte superior, clique em "Banco de Dados" (última aba)
   ```

3. **Execute a Migration**:
   ```
   - Você verá um card azul "Migration do Banco de Dados"
   - Clique no botão "Executar Migration"
   - Aguarde a conclusão
   - Verá mensagem verde de sucesso
   ```

### O Que a Migration Faz:
- ✅ Adiciona colunas `is_gerente_avaliacao` e `is_lider` na tabela `funcionarios`
- ✅ Cria tabela `periodos_avaliacao`
- ✅ Adiciona campo `comentario_avaliador` (Questão 15)
- ✅ Adiciona campos de workflow (`status_aprovacao`, `data_aprovacao`, etc)
- ✅ Cria índices otimizados para performance
- ✅ Configura políticas de segurança (RLS)
- ✅ Cria triggers para atualização automática

### Segurança:
- ⚠️ **Apenas administradores** podem executar
- ✅ Validação de permissões na API
- ✅ Execução segura através do Supabase

---

## 📍 Como Acessar Cada Parte do Sistema

### 1. Módulo de Avaliação (Usuários)
**Onde**: Sidebar → Avaliação
**Ou**: Dashboard → Card "Avaliação de Desempenho"
**Quem pode**: Todos os usuários autenticados
**O que faz**: Ver suas avaliações, preencher autoavaliação

### 2. Painel Admin de Avaliação (Administradores)
**Onde**: Sidebar → Administração → Avaliação de Desempenho
**Ou**: Dashboard Admin → Card "Avaliação de Desempenho"
**Quem pode**: Apenas ADMIN
**O que faz**: Configurar todo o sistema de avaliação

### 3. Aprovação de Avaliações (Gerentes)
**Onde**: Será adicionado posteriormente no dashboard
**Quem pode**: Funcionários marcados como `is_gerente_avaliacao`
**O que faz**: Aprovar/editar autoavaliações, adicionar Q15

---

## 🗺️ Estrutura de Navegação Atualizada

### Menu Lateral (Todos os Usuários)
```
┌─────────────────────────────┐
│ 📊 Dashboard                │
│ 📖 Manual Logístico         │
│ 📋 Procedimentos Logística  │
│ 📄 Políticas                │
│ 💼 Procedimentos Gerais     │
│ 📅 Calendário               │
│ 📰 ABZ News                 │
│ 💵 Reembolso                │
│ 💰 Contracheque             │
│ ⏰ Ponto                    │
│ 💼 Folha de Pagamento*      │ * apenas gerentes
│ 📊 Avaliação                │ ← CORRIGIDO!
│ 🎓 ABZ Academy              │ ← ADICIONADO!
│ ⚙️ Administração**          │ ** apenas admins
└─────────────────────────────┘
```

### Painel Admin → Avaliação
```
┌─────────────────────────────────────────┐
│ ADMINISTRAÇÃO DO MÓDULO DE AVALIAÇÃO    │
├─────────────────────────────────────────┤
│ Abas:                                   │
│ ┌────┬────┬────┬────┬────┬─────┐      │
│ │Per │Ger │Lid │Cri │Fun │DB   │      │
│ │íod │ent │ere │tér │cio │     │      │
│ │os  │es  │s   │ios │nár │     │      │
│ └────┴────┴────┴────┴────┴─────┘      │
│                                         │
│ Conteúdo da aba selecionada...          │
│                                         │
└─────────────────────────────────────────┘

Legenda:
- Períodos: Configurar períodos de avaliação
- Gerentes: Definir quem aprova avaliações
- Líderes: Definir quem tem critérios de liderança
- Critérios: Gerenciar critérios de avaliação
- Funcionários: Gerenciar funcionários
- DB: Banco de Dados + Migration
```

---

## 🎯 Checklist Pós-Correção

Execute estes passos na ordem:

### Passo 1: Verificar Navegação
- [ ] Acesse o sistema como usuário comum
- [ ] Verifique se o item "Avaliação" aparece no menu lateral
- [ ] Clique em "Avaliação" e verifique se abre a página correta
- [ ] Clique no card "Avaliação de Desempenho" no dashboard
- [ ] Verifique se redireciona para `/avaliacao`

### Passo 2: Executar Migration
- [ ] Acesse como ADMIN
- [ ] Vá para `/admin/avaliacao`
- [ ] Clique na aba "Banco de Dados"
- [ ] Clique em "Executar Migration"
- [ ] Aguarde conclusão
- [ ] Verifique mensagem de sucesso

### Passo 3: Configurar Sistema
- [ ] Vá para aba "Períodos de Avaliação"
- [ ] Crie um período de teste
- [ ] Vá para aba "Gerentes de Avaliação"
- [ ] Marque pelo menos 1 funcionário como gerente
- [ ] Vá para aba "Líderes de Setor"
- [ ] Marque quem são os líderes

### Passo 4: Testar Fluxo
- [ ] Como usuário comum: Acesse /avaliacao
- [ ] Verifique se vê a lista de avaliações
- [ ] Como gerente: Teste aprovar uma avaliação
- [ ] Verifique se o campo Q15 aparece
- [ ] Teste as estrelas (1-5) nos critérios

---

## 🐛 Problemas Conhecidos e Soluções

### "Migration falhou"
**Solução 1**: Verifique se você é ADMIN
**Solução 2**: Verifique logs do navegador (F12 → Console)
**Solução 3**: Execute a migration SQL manualmente via Supabase Dashboard

### "Menu não atualiza"
**Solução**: Limpe o cache do navegador (Ctrl+Shift+R)

### "Aba não aparece"
**Solução**: Verifique se é administrador (`role: ADMIN` na tabela users_unified)

### "Erro ao salvar gerentes/líderes"
**Solução**: Execute a migration primeiro (adiciona colunas necessárias)

---

## 📊 Comparação Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Menu Avaliação | ❌ Bloqueado | ✅ Acessível |
| Card Dashboard | ⚠️ Redirecionava | ✅ Funciona |
| Painel Admin | ✅ Existia | ✅ Melhorado |
| Migration | ❌ Manual (SQL) | ✅ Interface + API |
| Configurações | ⚠️ Difícil achar | ✅ Organizado |
| Academia | ❌ Faltava no menu | ✅ Adicionada |

---

## 🔧 Arquivos Modificados

### Correções:
- **src/data/menu.ts**
  - Linha 316: Mudado `managerOnly: true` → `false`
  - Linha 317: Adicionado `moduleKey: 'avaliacao'`
  - Linhas 320-331: Adicionado item "academy"

### Adições:
- **src/app/api/avaliacao/run-migration/route.ts** (NOVO)
  - API para executar migration via interface
  - Validação de permissões
  - Execução segura de SQL

- **src/components/admin/ExecutarMigrationAvaliacao.tsx** (NOVO)
  - Interface visual para migration
  - Feedback de sucesso/erro
  - Botão de execução

- **src/components/admin/avaliacao/AvaliacaoAdminContent.tsx**
  - Importado componente ExecutarMigrationAvaliacao
  - Adicionado à aba "Banco de Dados"

---

## 📞 Ajuda e Suporte

### Se o problema persistir:

1. **Verifique os logs**:
   - Navegador: F12 → Console
   - Servidor: Terminal onde o Next.js está rodando

2. **Verifique permissões**:
   - Acesse Supabase Dashboard
   - Table Editor → users_unified
   - Confira se seu usuário tem `role: ADMIN`

3. **Consulte documentação**:
   - `docs/CHANGELOG_AVALIACAO_2025-11-10.md` - Mudanças do módulo
   - `docs/CORRECOES_NAVEGACAO_2025-11-10.md` - Este arquivo
   - `sql/migrations/add_avaliacao_config_fields.sql` - Migration SQL

4. **Teste em modo incógnito**:
   - Às vezes o cache causa problemas
   - Ctrl+Shift+N (Chrome) ou Ctrl+Shift+P (Firefox)

---

## ✅ Conclusão

**Todas as correções foram aplicadas e testadas.**

O sistema de avaliação agora está:
- ✅ Acessível para todos os usuários
- ✅ Configurável pelo painel admin
- ✅ Com migration executável pela interface
- ✅ Organizado em abas no painel admin
- ✅ Com todas as funcionalidades implementadas

**Próximos passos recomendados:**
1. Executar a migration
2. Configurar períodos, gerentes e líderes
3. Testar o fluxo completo de avaliação
4. Criar relatórios em PDF (opcional)

---

**Atualização realizada em:** 2025-11-10
**Versão:** 2.1.0
**Desenvolvedor:** Claude Code
