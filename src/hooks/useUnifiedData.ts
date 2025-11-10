/**
 * Hook para usar o sistema unificado de dados
 * Facilita o uso dos serviços de tradução automática e dados unificados
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { unifiedDataService, UnifiedItem, getDashboardCards, getMenuItems } from '@/lib/unifiedDataService';
import { getCardsCached } from '@/lib/cardsCache';
import { FiGrid } from 'react-icons/fi';


interface UseUnifiedDataOptions {
  type: 'dashboard' | 'menu' | 'admin';
  autoRefresh?: boolean;
  refreshInterval?: number; // em segundos
}

interface UseUnifiedDataReturn {
  items: UnifiedItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  stats: {
    cacheSize: number;
    hardcodedCount: number;
  };
}

export function useUnifiedData(options: UseUnifiedDataOptions): UseUnifiedDataReturn {
  const { user } = useSupabaseAuth();
  const { t, locale } = useI18n();

  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ cacheSize: 0, hardcodedCount: 0 });

  // Função para carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let loadedItems: UnifiedItem[] = [];
      const userRole = user?.role?.toLowerCase();
      const userId = user?.id;

      switch (options.type) {
        case 'dashboard':
          loadedItems = await getDashboardCards(userRole, userId);
          break;
        case 'menu':
          loadedItems = await getMenuItems(userRole, userId);
          try {
            // Complementar menu com cards visíveis no dashboard (via cache compartilhado)
            if (userId) {
              const cards = await getCardsCached({ userId, userRole });
              const existing = new Set(loadedItems.map((i: any) => i.href));
              const cardItems = (cards || [])
                .filter((c: any) => c.href && c.href.trim() !== '') // Filtrar itens sem href ou com href vazio
                .map((c: any) => ({
                  id: c.id,
                  title: c.title,
                  description: c.description || '',
                  href: c.href,
                  icon: FiGrid,
                  iconName: c.iconName || c.icon || 'FiGrid',
                  external: false,
                  enabled: c.enabled !== undefined ? c.enabled : true,
                  order: c.order ?? 999,
                  adminOnly: c.adminOnly,
                  managerOnly: c.managerOnly,
                  allowedRoles: c.allowedRoles,
                  allowedUserIds: c.allowedUserIds,
                  showInMenu: true,
                  showInDashboard: true,
                  source: 'supabase' as const
                }));
              const toAdd = cardItems.filter((ci: any) => ci.enabled && !existing.has(ci.href));
              if (toAdd.length) {
                loadedItems = [...loadedItems, ...toAdd].sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999));
              }
            }
          } catch (e) {
            console.warn('Falha ao complementar menu com cards do dashboard:', e);
          }
          break;
        case 'admin':
          // Para admin, carregar todos os items
          loadedItems = await unifiedDataService.getItems({
            userRole,
            userId
          });
          break;
        default:
          loadedItems = [];
      }

      // Aplicar traduções baseadas no locale
      // IMPORTANTE: Preservar title_pt e title_en para uso no componente
      const translatedItems = await Promise.all(
        loadedItems.map(async (item: any) => {
          let translatedTitle = item.title;
          let translatedDescription = item.description;

          // Se o item tem title_pt e title_en, usar baseado no locale
          if (item.title_pt && item.title_en) {
            translatedTitle = locale === 'en-US' ? item.title_en : item.title_pt;
          }
          // Se o título parece uma chave de tradução, traduzir
          else if (item.title && (item.title.includes('.') || item.title.startsWith('cards.') || item.title.startsWith('admin.'))) {
            translatedTitle = t(item.title, item.title);
          }

          // Traduzir descrição se parecer uma chave de tradução
          if (item.description && (item.description.includes('.') || item.description.startsWith('cards.') || item.description.startsWith('admin.'))) {
            translatedDescription = t(item.description, item.description);
          }

          // Preservar campos originais de tradução para uso posterior
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
        })
      );

      setItems(translatedItems);

      // Atualizar estatísticas
      const currentStats = unifiedDataService.getStats();
      setStats(currentStats);

    } catch (err) {
      console.error('Error loading unified data:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [options.type, user, t, locale]);

  // Função de refresh manual
  const refresh = useCallback(async () => {
    // Limpar cache antes de recarregar
    unifiedDataService.clearCache();
    await loadData();
  }, [loadData]);

  // Carregar dados inicialmente
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh se habilitado
  useEffect(() => {
    if (!options.autoRefresh || !options.refreshInterval) return;

    const interval = setInterval(() => {
      loadData();
    }, options.refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, loadData]);

  // Escutar mudanças de tradução
  useEffect(() => {
    const handleTranslationUpdate = () => {
      // Recarregar dados quando traduções forem atualizadas
      loadData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('translationUpdated', handleTranslationUpdate);
      return () => {
        window.removeEventListener('translationUpdated', handleTranslationUpdate);
      };
    }
  }, [loadData]);

  return {
    items,
    loading,
    error,
    refresh,
    stats
  };
}

/**
 * Hook específico para cards do dashboard
 */
export function useDashboardCards(autoRefresh = false) {
  return useUnifiedData({
    type: 'dashboard',
    autoRefresh,
    refreshInterval: 300 // 5 minutos
  });
}

/**
 * Hook específico para items do menu
 */
export function useMenuItems(autoRefresh = false) {
  return useUnifiedData({
    type: 'menu',
    autoRefresh,
    refreshInterval: 600 // 10 minutos
  });
}

/**
 * Hook para tradução automática
 */
export function useAutoTranslation() {
  const { t, tAsync, autoTranslationEnabled, setAutoTranslationEnabled } = useI18n();

  const translateAsync = useCallback(async (key: string, defaultValue?: string) => {
    if (autoTranslationEnabled) {
      return await tAsync(key, defaultValue);
    }
    return t(key, defaultValue);
  }, [t, tAsync, autoTranslationEnabled]);

  const translateMultiple = useCallback(async (keys: string[]) => {
    const translations: Record<string, string> = {};

    if (autoTranslationEnabled) {
      // Traduzir em paralelo para melhor performance
      const promises = keys.map(async (key) => {
        const translation = await tAsync(key);
        return { key, translation };
      });

      const results = await Promise.all(promises);
      results.forEach(({ key, translation }) => {
        translations[key] = translation;
      });
    } else {
      // Tradução síncrona
      keys.forEach(key => {
        translations[key] = t(key);
      });
    }

    return translations;
  }, [t, tAsync, autoTranslationEnabled]);

  return {
    t,
    tAsync: translateAsync,
    translateMultiple,
    autoTranslationEnabled,
    setAutoTranslationEnabled
  };
}

/**
 * Hook para gerenciar configurações de automação
 */
export function useAutomationSettings() {
  const [settings, setSettings] = useState({
    autoTranslationEnabled: true,
    unifiedDataEnabled: true,
    cacheExpiry: 30,
    autoRefresh: false
  });

  // Carregar configurações do localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('automationSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading automation settings:', error);
      }
    }
  }, []);

  // Salvar configurações
  const updateSettings = useCallback((newSettings: Partial<typeof settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('automationSettings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Aplicar configurações aos serviços
  useEffect(() => {
    unifiedDataService.configure({
      enableSupabaseSync: settings.unifiedDataEnabled,
      cacheExpiry: settings.cacheExpiry,
      enableAutoTranslation: settings.autoTranslationEnabled
    });
  }, [settings]);

  return {
    settings,
    updateSettings
  };
}

export default useUnifiedData;
