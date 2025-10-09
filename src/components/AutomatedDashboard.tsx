'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useDashboardCards, useAutoTranslation } from '@/hooks/useUnifiedData';
import { 
  FiRefreshCw, 
  FiAlertCircle, 
  FiCheckCircle,
  FiGlobe,
  FiLayers
} from 'react-icons/fi';

interface AutomatedDashboardProps {
  className?: string;
}

export default function AutomatedDashboard({ className = '' }: AutomatedDashboardProps) {
  const router = useRouter();
  const { items: cards, loading, error, refresh, stats } = useDashboardCards(true);
  const { t, autoTranslationEnabled } = useAutoTranslation();

  const handleCardClick = (href: string, external: boolean) => {
    if (external) {
      window.open(href, '_blank');
    } else {
      router.push(href);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <FiRefreshCw className="h-6 w-6 animate-spin text-abz-blue" />
            <span className="text-gray-600">{t('common.loading', 'Carregando...')}</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3 text-red-600">
              <FiAlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Erro ao carregar cards</p>
                <p className="text-sm text-red-500">{error}</p>
              </div>
            </div>
            <Button 
              onClick={refresh} 
              variant="outline" 
              size="sm" 
              className="mt-4"
            >
              <FiRefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Status da Automação */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <FiGlobe className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                Tradução Automática
              </span>
              {autoTranslationEnabled ? (
                <FiCheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <FiAlertCircle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <div className="flex items-center space-x-2">
              <FiLayers className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">
                Sistema Unificado
              </span>
              <FiCheckCircle className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>Cache: {stats.cacheSize}</span>
            <span>Items: {stats.hardcodedCount}</span>
            <Button 
              onClick={refresh} 
              variant="ghost" 
              size="sm"
              className="h-8 px-2"
            >
              <FiRefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          
          return (
            <Card
              key={card.id}
              className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 group"
              onClick={() => handleCardClick(card.href, card.external)}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-full ${card.color || 'bg-abz-light-blue'} group-hover:${card.hoverColor || 'hover:bg-abz-blue-dark'} transition-colors`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-abz-blue transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {card.description}
                    </p>
                    
                    {/* Indicadores de automação */}
                    <div className="flex items-center space-x-2 mt-3">
                      {card.source === 'supabase' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          <FiLayers className="h-3 w-3 mr-1" />
                          Supabase
                        </span>
                      )}
                      {card.source === 'hardcoded' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                          Hardcoded
                        </span>
                      )}
                      {autoTranslationEnabled && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          <FiGlobe className="h-3 w-3 mr-1" />
                          Auto-T
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mensagem quando não há cards */}
      {cards.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FiLayers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum card disponível
              </h3>
              <p className="text-gray-600 mb-4">
                Não há cards configurados para exibição no dashboard.
              </p>
              <Button onClick={refresh} variant="outline">
                <FiRefreshCw className="h-4 w-4 mr-2" />
                Recarregar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações de Debug (apenas em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-dashed border-gray-300">
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">
              Debug - Sistema de Automação
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-500 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Cards carregados:</strong> {cards.length}</p>
                <p><strong>Tradução automática:</strong> {autoTranslationEnabled ? 'Ativa' : 'Inativa'}</p>
                <p><strong>Cache size:</strong> {stats.cacheSize}</p>
              </div>
              <div>
                <p><strong>Items hardcoded:</strong> {stats.hardcodedCount}</p>
                <p><strong>Fonte de dados:</strong> Unificada</p>
                <p><strong>Auto-refresh:</strong> Ativo</p>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs">
                <strong>Cards por fonte:</strong>
              </p>
              <div className="flex space-x-4 mt-1">
                <span>Supabase: {cards.filter(c => c.source === 'supabase').length}</span>
                <span>Hardcoded: {cards.filter(c => c.source === 'hardcoded').length}</span>
                <span>Outros: {cards.filter(c => !c.source).length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
