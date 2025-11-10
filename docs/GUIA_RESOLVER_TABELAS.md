# Guia Rápido: Resolver Erro de Tabelas

## 🔴 Erro Atual

```
Erro de configuração do banco de dados: Tabelas não encontradas:
funcionarios, criterios, avaliacoes_desempenho, periodos_avaliacao, pontuacoes
```

---

## ✅ Solução Rápida (3 Passos)

### Passo 1: Criar Tabela de Critérios
```
1. Acesse: /admin/avaliacao
2. Clique na aba "Banco de Dados" (última aba)
3. Procure o card "Create Criterios Table"
4. Clique em "Create Criterios Table"
5. Aguarde a confirmação
```

### Passo 2: Importar Critérios Padrão
```
1. Na mesma aba "Banco de Dados"
2. Procure o card "Import Default Criterios"
3. Clique em "Import Criterios"
4. Aguarde a importação dos 10 critérios
```

### Passo 3: Executar Migration
```
1. Na mesma aba "Banco de Dados"
2. Procure o card "Migration do Banco de Dados"
3. Clique em "Executar Migration"
4. Aguarde a conclusão (mensagem verde)
```

---

## 📋 O Que Cada Passo Faz

### Passo 1 - Create Criterios Table
Cria as seguintes tabelas:
- ✅ `criterios` - Critérios de avaliação
- ✅ `avaliacoes_desempenho` - Avaliações
- ✅ `pontuacoes` - Pontuações das avaliações
- ✅ `funcionarios` - Funcionários (se não existir)

### Passo 2 - Import Criterios
Importa 10 critérios padrão:
1. Conhecimento Técnico
2. Produtividade
3. Trabalho em Equipe
4. Comunicação
5. Resolução de Problemas
6. Iniciativa
7. Comprometimento e Pontualidade
8. Adaptabilidade
9. **Liderança - Delegar** (apenas líderes)
10. **Liderança - Desenvolvimento da Equipe** (apenas líderes)

### Passo 3 - Executar Migration
Adiciona campos novos:
- ✅ `is_gerente_avaliacao` em funcionarios
- ✅ `is_lider` em funcionarios
- ✅ `comentario_avaliador` (Q15) em avaliacoes_desempenho
- ✅ Tabela `periodos_avaliacao`
- ✅ Índices otimizados
- ✅ Políticas de segurança (RLS)

---

## 🎯 Como Acessar /admin/avaliacao

### Opção 1: Menu Lateral (NOVO!)
```
1. Acesse /admin
2. No menu lateral esquerdo, procure:
   "Avaliação de Desempenho" 📊
3. Clique no link
```

### Opção 2: Card do Dashboard
```
1. Acesse /admin
2. Role até encontrar o card:
   "Avaliação de Desempenho"
3. Clique no card
```

### Opção 3: URL Direta
```
Digite na barra de endereço:
/admin/avaliacao
```

---

## 🗂️ Estrutura do Painel Admin

Quando acessar `/admin/avaliacao`, você verá 6 abas:

```
┌─────────────────────────────────────────────────┐
│ ADMINISTRAÇÃO DO MÓDULO DE AVALIAÇÃO            │
├─────────────────────────────────────────────────┤
│ 📅 Períodos | 👔 Gerentes | 🏆 Líderes | ...    │
│                                                  │
│ [Aba Banco de Dados]                            │
│                                                  │
│ ┌─────────────────────────────────────┐        │
│ │ 🗄️ Migration do Banco de Dados      │        │
│ │ Execute a migration para adicionar   │        │
│ │ os novos campos e tabelas            │        │
│ │                                       │        │
│ │ [Executar Migration] ← CLIQUE AQUI  │        │
│ └─────────────────────────────────────┘        │
│                                                  │
│ ┌─────────────────────────────────────┐        │
│ │ 📊 Create Criterios Table            │        │
│ │ [Create Criterios Table]             │        │
│ └─────────────────────────────────────┘        │
│                                                  │
│ ┌─────────────────────────────────────┐        │
│ │ 📥 Import Default Criterios          │        │
│ │ [Import Criterios]                   │        │
│ └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

---

## ⚠️ Problemas Comuns

### "Erro ao executar migration"
**Causa**: Tabela criterios não existe
**Solução**: Execute Passo 1 primeiro

### "Migration executada mas ainda dá erro"
**Causa**: Cache do navegador
**Solução**: Ctrl+Shift+R ou Ctrl+F5

### "Não consigo acessar /admin/avaliacao"
**Causa**: Você não é ADMIN
**Solução**: Verifique role na tabela users_unified

### "Card/Menu não aparece"
**Causa**: Cache ou você não é admin
**Solução**:
1. Limpar cache (Ctrl+Shift+Del)
2. Verificar role = 'ADMIN'

---

## 🎉 Como Saber Se Funcionou

### Sucesso:
1. ✅ Mensagem verde "Migration executada com sucesso!"
2. ✅ Ao voltar para /avaliacao, não há mais erro
3. ✅ Lista de avaliações carrega (mesmo que vazia)
4. ✅ Botão "Nova Avaliação" aparece (se for admin/gerente)

### Ainda com Erro:
- Verifique console do navegador (F12)
- Verifique se executou os 3 passos na ordem
- Tente limpar cache e recarregar

---

## 📞 Comandos Úteis

### Verificar se é Admin:
```sql
SELECT id, email, role FROM users_unified WHERE email = 'seu@email.com';
```

### Verificar tabelas criadas:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%avalia%';
```

### Verificar critérios importados:
```sql
SELECT COUNT(*) FROM criterios WHERE ativo = true;
-- Deve retornar: 10
```

---

## ✅ Checklist Final

Após executar os 3 passos:

- [ ] Migration mostrou mensagem verde de sucesso
- [ ] /avaliacao não mostra mais erro de tabelas
- [ ] /admin/avaliacao tem 6 abas funcionando
- [ ] Aba "Períodos" mostra interface vazia (pronta para configurar)
- [ ] Aba "Gerentes" mostra lista de funcionários
- [ ] Aba "Líderes" mostra lista de funcionários
- [ ] Aba "Critérios" tem link para gerenciar
- [ ] Aba "Banco de Dados" mostra botões de setup

---

**Pronto!** Após executar esses 3 passos simples, o módulo de avaliação estará 100% funcional.

Próximo passo: Configurar períodos, gerentes e líderes! 🚀
