# Sistema de Automação - Painel ABZ

Este documento explica como funcionam os sistemas automáticos de tradução e sincronização de dados implementados no Painel ABZ.

## 🚀 Visão Geral

O sistema de automação resolve dois problemas principais:

1. **Tradução Manual**: Elimina a necessidade de traduzir manualmente cada string
2. **Sincronização Cards/Menus**: Unifica o gerenciamento de cards e menus

## 🌐 Sistema de Tradução Automática

### Como Funciona

O sistema detecta automaticamente quando uma tradução não existe e:

1. **Detecta** strings não traduzidas
2. **Gera** traduções usando algoritmos inteligentes
3. **Salva** no cache para uso futuro
4. **Atualiza** a interface automaticamente

### Configuração

```typescript
import { autoTranslationService } from '@/lib/autoTranslationService';

// Configurar o serviço
autoTranslationService.configure({
  enabled: true,
  provider: 'mock', // ou 'google' com API key
  autoSave: true,
  cacheExpiry: 24 * 7 // 7 dias
});
```

### Uso em Componentes

```typescript
import { useI18n } from '@/contexts/I18nContext';

function MyComponent() {
  const { t, tAsync, autoTranslationEnabled } = useI18n();

  // Tradução síncrona (com auto-tradução em background)
  const title = t('cards.newFeature', 'Nova Funcionalidade');

  // Tradução assíncrona (aguarda auto-tradução)
  const description = await tAsync('cards.newFeatureDesc');

  return (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
```

### Providers de Tradução

#### Mock Provider (Padrão)
- Usa traduções baseadas em regras simples
- Ideal para desenvolvimento
- Não requer configuração adicional

#### Google Translate Provider
- Usa Google Translate API
- Requer API key
- Melhor qualidade de tradução

```typescript
// Configurar Google Translate
autoTranslationService.configure({
  provider: 'google',
  apiKey: 'sua-api-key-aqui'
});
```

## 🔄 Sistema Unificado Cards/Menus

### Como Funciona

O sistema centraliza o gerenciamento de cards e menus:

1. **Fonte Única**: Dados vêm de uma API unificada
2. **Sincronização**: Automática entre Supabase e dados hardcoded
3. **Fallback**: Usa dados hardcoded se Supabase falhar
4. **Permissões**: Aplicação consistente de regras de acesso

### Configuração

```typescript
import { unifiedDataService } from '@/lib/unifiedDataService';

// Configurar o serviço
unifiedDataService.configure({
  enableSupabaseSync: true,
  enableAutoTranslation: true,
  cacheExpiry: 30, // 30 minutos
  fallbackToHardcoded: true
});
```

### Uso com Hooks

```typescript
import { useDashboardCards, useMenuItems } from '@/hooks/useUnifiedData';

function Dashboard() {
  const { items: cards, loading, error, refresh } = useDashboardCards(true);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(card => (
        <Card key={card.id} {...card} />
      ))}
    </div>
  );
}
```

### Estrutura de Dados Unificada

```typescript
interface UnifiedItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: IconType;
  iconName: string;
  
  // Configurações de exibição
  showInDashboard?: boolean;
  showInMenu?: boolean;
  showInAdminMenu?: boolean;
  
  // Permissões
  adminOnly?: boolean;
  managerOnly?: boolean;
  allowedRoles?: string[];
  
  // Metadados
  source?: 'supabase' | 'hardcoded';
  enabled: boolean;
  order: number;
}
```

## ⚙️ Configuração via Interface

### Página de Administração

Acesse `/admin/automation` para configurar:

- ✅ Ativar/desativar tradução automática
- ✅ Configurar sistema unificado
- ✅ Limpar caches
- ✅ Sincronizar dados
- ✅ Visualizar estatísticas

### Componente de Configuração

```typescript
import AutomationSettings from '@/components/AutomationSettings';

function AdminPage() {
  return (
    <div>
      <h1>Configurações</h1>
      <AutomationSettings />
    </div>
  );
}
```

## 🔧 Hooks Disponíveis

### useUnifiedData
Hook principal para dados unificados:

```typescript
const { items, loading, error, refresh, stats } = useUnifiedData({
  type: 'dashboard', // 'dashboard' | 'menu' | 'admin'
  autoRefresh: true,
  refreshInterval: 300 // segundos
});
```

### useDashboardCards
Hook específico para cards do dashboard:

```typescript
const { items: cards, loading, error, refresh } = useDashboardCards(true);
```

### useAutoTranslation
Hook para tradução automática:

```typescript
const { 
  t, 
  tAsync, 
  translateMultiple,
  autoTranslationEnabled,
  setAutoTranslationEnabled 
} = useAutoTranslation();
```

### useAutomationSettings
Hook para gerenciar configurações:

```typescript
const { settings, updateSettings } = useAutomationSettings();

// Atualizar configurações
updateSettings({
  autoTranslationEnabled: true,
  cacheExpiry: 60
});
```

## 📊 Monitoramento e Debug

### Estatísticas

```typescript
// Estatísticas de tradução
const translationStats = autoTranslationService.getStats();
console.log('Cache size:', translationStats.cacheSize);
console.log('Queue size:', translationStats.queueSize);

// Estatísticas de dados unificados
const unifiedStats = unifiedDataService.getStats();
console.log('Cache size:', unifiedStats.cacheSize);
console.log('Hardcoded items:', unifiedStats.hardcodedCount);
```

### Logs

O sistema gera logs detalhados:

```
🌐 Auto-translated 'cards.newFeature' to 'en-US': 'New Feature'
🔄 Using hardcoded items as fallback
🔄 Syncing hardcoded items to Supabase...
```

### Modo Debug

Em desenvolvimento, componentes mostram informações de debug:

```typescript
// Ativar debug no componente
<AutomatedDashboard className="debug-mode" />
```

## 🚨 Troubleshooting

### Traduções não aparecem
1. Verificar se `autoTranslationEnabled` está ativo
2. Limpar cache de traduções
3. Verificar logs no console

### Cards não sincronizam
1. Verificar conexão com Supabase
2. Limpar cache de dados unificados
3. Forçar sincronização manual

### Performance lenta
1. Reduzir `cacheExpiry`
2. Desativar `autoRefresh` se não necessário
3. Usar `useMemo` em componentes pesados

## 🔮 Próximos Passos

### Melhorias Planejadas

1. **API de Tradução Avançada**: Integração com mais providers
2. **Sincronização Real-time**: WebSockets para atualizações instantâneas
3. **Interface de Aprovação**: Sistema para aprovar traduções automáticas
4. **Analytics**: Métricas de uso e performance
5. **Backup Automático**: Backup de traduções e configurações

### Contribuindo

Para contribuir com melhorias:

1. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
2. Implemente as mudanças
3. Teste com `npm run test`
4. Faça commit: `git commit -m "feat: nova funcionalidade"`
5. Abra um Pull Request

## 📝 Changelog

### v1.0.0 (Atual)
- ✅ Sistema de tradução automática
- ✅ Sistema unificado cards/menus
- ✅ Interface de configuração
- ✅ Hooks para facilitar uso
- ✅ Documentação completa

---

**Desenvolvido para o Painel ABZ** 🚀
