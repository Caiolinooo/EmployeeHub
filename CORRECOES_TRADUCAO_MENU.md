# Correções de Tradução do Menu e Duplicação de Cards

## 📋 Problemas Identificados

### 1. Traduções do Menu Lateral Não Funcionam
**Causa Raiz:**
- O hook `useUnifiedData` estava removendo os campos `title_pt` e `title_en` ao processar traduções
- O `MainLayout` tentava acessar esses campos, mas eles não existiam mais no objeto retornado

**Sintomas:**
- Menu lateral sempre em português, mesmo quando o idioma é alterado para inglês
- Console mostrando `undefined` para `title_en` e `title_pt`

### 2. Cards Duplicados no Dashboard
**Causa Raiz:**
- Dashboard estava fazendo fallback para `/api/cards` quando `/api/cards/supabase` falhava
- Isso causava carregamento de cards de duas fontes diferentes
- Possível duplicação de dados entre tabelas `cards` e `Card`

**Sintomas:**
- Cards aparecendo duplicados no dashboard
- Mesmos cards com IDs diferentes

## ✅ Correções Implementadas

### 1. Hook useUnifiedData (src/hooks/useUnifiedData.ts)
**Mudança:** Preservar campos de tradução originais

```typescript
// ANTES
return {
  ...item,
  title: translatedTitle,
  description: translatedDescription
};

// DEPOIS
return {
  ...item,
  title: translatedTitle,
  description: translatedDescription,
  // Preservar campos de tradução originais
  title_pt: item.title_pt,
  title_en: item.title_en,
  description_pt: item.description_pt,
  description_en: item.description_en
};
```

### 2. MainLayout (src/components/Layout/MainLayout.tsx)
**Mudança:** Melhorar lógica de seleção de tradução

```typescript
// Usar traduções se disponíveis
if (locale === 'en-US' && itemWithTranslation.title_en) {
  displayLabel = itemWithTranslation.title_en;
} else if (locale === 'pt-BR' && itemWithTranslation.title_pt) {
  displayLabel = itemWithTranslation.title_pt;
} else if (itemWithTranslation.title) {
  // Fallback para title se não houver traduções específicas
  displayLabel = itemWithTranslation.title;
} else {
  displayLabel = item.id;
}
```

**Adicionado:** Debug logging para primeiro item do menu

### 3. Dashboard (src/app/dashboard/page.tsx)
**Mudança:** Remover fallback problemático

```typescript
// ANTES
// Se ainda falhar, usar API de fallback
if (!response.ok) {
  console.warn('⚠️ Usando API de fallback...');
  response = await fetch('/api/cards');
}

// DEPOIS
// Removido - usar apenas /api/cards/supabase
if (!response.ok) {
  throw new Error(`Failed to fetch cards: ${response.status}`);
}
```

### 4. Novas APIs Criadas

#### a) `/api/admin/menu/upgrade-table` (POST)
- Verifica se colunas `title_pt` e `title_en` existem
- Fornece SQL para adicionar colunas se necessário
- Atualiza itens existentes com traduções básicas

#### b) `/api/admin/menu/populate-translations` (POST)
- Popula todos os itens do menu com traduções corretas
- Faz upsert (cria ou atualiza) cada item
- Retorna estatísticas de criação/atualização

## 🔧 Passos para Aplicar as Correções

### Passo 1: Verificar Estrutura da Tabela menu_items
Execute no Supabase Dashboard (SQL Editor):

```sql
-- Verificar se as colunas existem
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_items';

-- Se não existirem, adicionar:
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS title_pt TEXT,
ADD COLUMN IF NOT EXISTS title_en TEXT;
```

### Passo 2: Popular Traduções
Execute via terminal ou Postman:

```bash
# Popular traduções na tabela menu_items
curl -X POST http://localhost:3000/api/admin/menu/populate-translations
```

Ou acesse diretamente no navegador (como admin):
```
http://localhost:3000/api/admin/menu/populate-translations
```

### Passo 3: Limpar Cache
No navegador, abra o console e execute:

```javascript
// Limpar cache de menu
localStorage.removeItem('unified-data-cache');
localStorage.removeItem('dashboard-cards-cache');

// Recarregar página
location.reload();
```

### Passo 4: Verificar Cards Duplicados
Execute no Supabase Dashboard:

```sql
-- Verificar se há cards duplicados
SELECT id, title, COUNT(*) as count
FROM "Card"
GROUP BY id, title
HAVING COUNT(*) > 1;

-- Se houver duplicados, remover:
DELETE FROM "Card" 
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM "Card"
  GROUP BY id
);
```

## 🧪 Testes

### Teste 1: Tradução do Menu
1. Abrir aplicação em português
2. Verificar que menu está em português
3. Mudar idioma para inglês (ícone do globo)
4. Verificar que menu mudou para inglês
5. Abrir console e verificar logs de debug

**Resultado Esperado:**
```
🔍 Menu Item Debug: {
  id: 'dashboard',
  locale: 'en-US',
  title: 'Dashboard',
  title_pt: 'Painel',
  title_en: 'Dashboard',
  hasTranslations: true
}
```

### Teste 2: Cards Não Duplicados
1. Abrir dashboard
2. Contar número de cards visíveis
3. Verificar se não há cards duplicados
4. Abrir console e verificar logs

**Resultado Esperado:**
```
✅ X cards carregados do Supabase
```
(Sem mensagens de fallback ou múltiplas fontes)

### Teste 3: Persistência de Idioma
1. Mudar idioma para inglês
2. Recarregar página
3. Verificar que idioma permanece inglês
4. Navegar para outra página
5. Verificar que idioma permanece inglês

## 📊 Checklist de Verificação

- [ ] Colunas `title_pt` e `title_en` existem na tabela `menu_items`
- [ ] Todos os itens do menu têm traduções populadas
- [ ] Menu lateral muda de idioma corretamente
- [ ] Não há cards duplicados no dashboard
- [ ] Cache foi limpo após as mudanças
- [ ] Logs de debug aparecem no console
- [ ] Idioma persiste após reload
- [ ] Idioma persiste ao navegar entre páginas

## 🐛 Troubleshooting

### Menu ainda não traduz
1. Verificar console para logs de debug
2. Verificar se `title_pt` e `title_en` estão presentes nos logs
3. Executar `/api/admin/menu/populate-translations` novamente
4. Limpar cache do navegador completamente

### Cards ainda duplicados
1. Verificar qual API está sendo chamada no console
2. Verificar se há duplicados no banco de dados
3. Executar query de limpeza de duplicados
4. Limpar cache do dashboard

### Traduções não persistem
1. Verificar localStorage no DevTools
2. Verificar se `locale` está sendo salvo
3. Verificar se I18nContext está funcionando
4. Verificar se há erros no console

## 📝 Notas Importantes

1. **Duas Tabelas de Cards:** O sistema usa tanto `cards` quanto `Card`. Considerar unificar no futuro.
2. **Cache:** O sistema usa cache agressivo. Sempre limpar após mudanças estruturais.
3. **Debug Logs:** Logs de debug foram adicionados temporariamente. Remover em produção.
4. **Fallback:** Sistema agora falha rápido em vez de usar fallbacks que causam duplicação.

## 🔄 Próximos Passos (Opcional)

1. Unificar tabelas `cards` e `Card` em uma única tabela
2. Adicionar testes automatizados para traduções
3. Criar interface admin para gerenciar traduções
4. Adicionar mais idiomas (espanhol, francês, etc.)
5. Implementar tradução automática via API

