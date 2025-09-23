'use client';

import React from 'react';
import { 
  FiAlertTriangle, 
  FiAlertCircle, 
  FiInfo, 
  FiX,
  FiClock,
  FiTrendingDown,
  FiTarget
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { AlertaPerformance } from '@/types/avaliacoes-avancadas';

interface AlertasPerformanceProps {
  alertas: AlertaPerformance[];
}

export default function AlertasPerformance({ alertas }: AlertasPerformanceProps) {
  const { t } = useI18n();

  const getIconForTipo = (tipo: string) => {
    switch (tipo) {
      case 'meta_nao_atingida':
        return FiTarget;
      case 'queda_performance':
        return FiTrendingDown;
      case 'avaliacao_pendente':
        return FiClock;
      case 'prazo_vencido':
        return FiAlertTriangle;
      default:
        return FiInfo;
    }
  };

  const getColorForSeveridade = (severidade: string) => {
    switch (severidade) {
      case 'critica':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-500',
          title: 'text-red-800',
          text: 'text-red-700'
        };
      case 'alta':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          icon: 'text-orange-500',
          title: 'text-orange-800',
          text: 'text-orange-700'
        };
      case 'media':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-500',
          title: 'text-yellow-800',
          text: 'text-yellow-700'
        };
      case 'baixa':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-500',
          title: 'text-blue-800',
          text: 'text-blue-700'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: 'text-gray-500',
          title: 'text-gray-800',
          text: 'text-gray-700'
        };
    }
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!alertas || alertas.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('avaliacoes.alertas_performance', 'Alertas de Performance')}
        </h2>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {alertas.filter(a => !a.resolvido).length} {t('avaliacoes.alertas_ativos', 'ativos')}
        </span>
      </div>

      <div className="space-y-3">
        {alertas.map((alerta) => {
          const IconComponent = getIconForTipo(alerta.tipo);
          const colors = getColorForSeveridade(alerta.severidade);

          return (
            <div
              key={alerta.id}
              className={`rounded-lg border p-4 ${colors.bg} ${colors.border} ${
                alerta.resolvido ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start">
                <div className={`flex-shrink-0 ${colors.icon}`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-medium ${colors.title}`}>
                      {alerta.titulo}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        alerta.severidade === 'critica' ? 'bg-red-100 text-red-800' :
                        alerta.severidade === 'alta' ? 'bg-orange-100 text-orange-800' :
                        alerta.severidade === 'media' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {alerta.severidade.charAt(0).toUpperCase() + alerta.severidade.slice(1)}
                      </span>
                      {alerta.resolvido && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {t('avaliacoes.resolvido', 'Resolvido')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={`mt-1 text-sm ${colors.text}`}>
                    {alerta.descricao}
                  </div>

                  {alerta.departamento && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                        {t('common.departamento', 'Departamento')}: {alerta.departamento}
                      </span>
                    </div>
                  )}

                  {alerta.acao_sugerida && (
                    <div className={`mt-3 p-3 rounded-md bg-white border ${colors.border}`}>
                      <div className="flex items-start">
                        <FiInfo className={`flex-shrink-0 h-4 w-4 mt-0.5 ${colors.icon}`} />
                        <div className="ml-2">
                          <div className="text-xs font-medium text-gray-900 mb-1">
                            {t('avaliacoes.acao_sugerida', 'Ação Sugerida')}
                          </div>
                          <div className="text-xs text-gray-700">
                            {alerta.acao_sugerida}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {t('avaliacoes.criado_em', 'Criado em')}: {formatarData(alerta.data_criacao)}
                    </span>
                    {alerta.data_resolucao && (
                      <span>
                        {t('avaliacoes.resolvido_em', 'Resolvido em')}: {formatarData(alerta.data_resolucao)}
                      </span>
                    )}
                  </div>
                </div>

                {!alerta.resolvido && (
                  <div className="ml-3 flex-shrink-0">
                    <button
                      onClick={() => {
                        // Implementar resolução do alerta
                        console.log('Resolver alerta:', alerta.id);
                      }}
                      className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      <FiX className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo dos Alertas */}
      <div className="bg-gray-50 rounded-lg p-4 border">
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          {t('avaliacoes.resumo_alertas', 'Resumo dos Alertas')}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">
              {alertas.filter(a => a.severidade === 'critica' && !a.resolvido).length}
            </div>
            <div className="text-gray-600">{t('avaliacoes.criticos', 'Críticos')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-orange-600">
              {alertas.filter(a => a.severidade === 'alta' && !a.resolvido).length}
            </div>
            <div className="text-gray-600">{t('avaliacoes.alta_prioridade', 'Alta Prioridade')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-yellow-600">
              {alertas.filter(a => a.severidade === 'media' && !a.resolvido).length}
            </div>
            <div className="text-gray-600">{t('avaliacoes.media_prioridade', 'Média Prioridade')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">
              {alertas.filter(a => a.resolvido).length}
            </div>
            <div className="text-gray-600">{t('avaliacoes.resolvidos', 'Resolvidos')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
