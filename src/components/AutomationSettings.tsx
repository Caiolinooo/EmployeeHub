'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { Switch } from '@/components/ui/switch'; // Component not found
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/contexts/I18nContext';
import { autoTranslationService } from '@/lib/autoTranslationService';
import { unifiedDataService } from '@/lib/unifiedDataService';
import { 
  FiGlobe, 
  FiLayers, 
  FiRefreshCw, 
  FiSettings, 
  FiCheck,
  FiAlertCircle,
  FiInfo
} from 'react-icons/fi';

interface AutomationSettingsProps {
  className?: string;
}

export default function AutomationSettings({
  const { t } = useI18n();
 className = '' }: AutomationSettingsProps) {
  const { t, autoTranslationEnabled, setAutoTranslationEnabled } = useI18n();
  const { toast } = useToast();
  
  // Estados
  const [unifiedDataEnabled, setUnifiedDataEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    translationCache: 0,
    translationQueue: 0,
    unifiedDataCache: 0,
    hardcodedItems: 0
  });

  // Carregar configurações e estatísticas
  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = () => {
    // Carregar configurações do localStorage
    const savedUnifiedData = localStorage.getItem('unifiedDataEnabled');
    if (savedUnifiedData !== null) {
      setUnifiedDataEnabled(savedUnifiedData === 'true');
    }
  };

  const loadStats = () => {
    const translationStats = autoTranslationService.getStats();
    const unifiedStats = unifiedDataService.getStats();
    
    setStats({
      translationCache: translationStats.cacheSize,
      translationQueue: translationStats.queueSize,
      unifiedDataCache: unifiedStats.cacheSize,
      hardcodedItems: unifiedStats.hardcodedCount
    });
  };

  const handleAutoTranslationToggle = (enabled: boolean) => {
    setAutoTranslationEnabled(enabled);
    toast({
      title: enabled ? {t('components.traducaoAutomaticaAtivada')} : {t('components.traducaoAutomaticaDesativada')},
      description: enabled 
        ? {t('components.oSistemaAgoraTraduziraAutomaticamenteTextosNaoEnco')}
        : {t('components.aTraducaoAutomaticaFoiDesabilitada')},
      duration: 3000,
    });
  };

  const handleUnifiedDataToggle = (enabled: boolean) => {
    setUnifiedDataEnabled(enabled);
    unifiedDataService.configure({ enableSupabaseSync: enabled });
    
    // Salvar no localStorage
    localStorage.setItem('unifiedDataEnabled', enabled.toString());
    
    toast({
      title: enabled ? 'Sistema Unificado Ativado' : 'Sistema Unificado Desativado',
      description: enabled 
        ? 'Cards e menus agora usam fonte de dados unificada'
        : 'Sistema voltou para dados hardcoded',
      duration: 3000,
    });
  };

  const handleClearTranslationCache = async () => {
    setIsLoading(true);
    try {
      autoTranslationService.clearCache();
      loadStats();
      toast({
        title: 'Cache Limpo',
        description: {t('components.cacheDeTraducoesFoiLimpoComSucesso')},
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: {t('components.erroAoLimparCacheDeTraducoes')},
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearUnifiedDataCache = async () => {
    setIsLoading(true);
    try {
      unifiedDataService.clearCache();
      loadStats();
      toast({
        title: 'Cache Limpo',
        description: 'Cache de dados unificados foi limpo com sucesso',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao limpar cache de dados unificados',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncHardcodedData = async () => {
    setIsLoading(true);
    try {
      await unifiedDataService.syncHardcodedToSupabase();
      loadStats();
      toast({
        title: {t('components.sincronizacaoConcluida')},
        description: 'Dados hardcoded foram sincronizados com o Supabase',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: {t('components.erroNaSincronizacao')},
        description: 'Erro ao sincronizar dados com o Supabase',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStats = () => {
    loadStats();
    toast({
      title: {t('components.estatisticasAtualizadas')},
      description: 'Dados foram recarregados com sucesso',
      duration: 2000,
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cabeçalho */}
      <div className="flex items-center space-x-3">
        <FiSettings className="h-6 w-6 text-abz-blue" />
        <h2 className="text-2xl font-bold text-gray-900">
          Configurações de Automação
        </h2>
      </div>

      {/* Tradução Automática */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FiGlobe className="h-5 w-5 text-blue-600" />
            <span>Tradução Automática</span>
            {autoTranslationEnabled && <FiCheck className="h-4 w-4 text-green-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Ativar tradução automática</p>
              <p className="text-xs text-gray-500">
                Traduz automaticamente textos não encontrados nos arquivos de locale
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoTranslationEnabled}
              onChange={(e) => handleAutoTranslationToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.translationCache}</p>
              <p className="text-xs text-gray-500">Traduções em cache</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.translationQueue}</p>
              <p className="text-xs text-gray-500">Traduções pendentes</p>
            </div>
          </div>

          <Button
            onClick={handleClearTranslationCache}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Limpar Cache de Traduções
          </Button>
        </CardContent>
      </Card>

      {/* Sistema Unificado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FiLayers className="h-5 w-5 text-purple-600" />
            <span>Sistema Unificado Cards/Menus</span>
            {unifiedDataEnabled && <FiCheck className="h-4 w-4 text-green-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Ativar sistema unificado</p>
              <p className="text-xs text-gray-500">
                Sincroniza automaticamente cards e menus entre Supabase e dados hardcoded
              </p>
            </div>
            <input
              type="checkbox"
              checked={unifiedDataEnabled}
              onChange={(e) => handleUnifiedDataToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.unifiedDataCache}</p>
              <p className="text-xs text-gray-500">Items em cache</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.hardcodedItems}</p>
              <p className="text-xs text-gray-500">Items hardcoded</p>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleClearUnifiedDataCache}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <FiRefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Limpar Cache de Dados
            </Button>
            
            <Button
              onClick={handleSyncHardcodedData}
              disabled={isLoading || !unifiedDataEnabled}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <FiRefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Sincronizar com Supabase
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Informações e Ações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FiInfo className="h-5 w-5 text-gray-600" />
            <span>Informações e Ações</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <FiInfo className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">Como funciona</p>
                <p className="text-xs text-blue-700">
                  O sistema de automação detecta automaticamente strings não traduzidas e 
                  sincroniza cards/menus entre diferentes fontes de dados, eliminando a 
                  necessidade de manutenção manual.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleRefreshStats}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <FiRefreshCw className="h-4 w-4 mr-2" />
            Atualizar Estatísticas
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
