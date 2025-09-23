'use client';

import React from 'react';
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiMinus, 
  FiTarget, 
  FiUsers, 
  FiCheckCircle,
  FiClock,
  FiBarChart2
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { KPIAvaliacao } from '@/types/avaliacoes-avancadas';

interface MetricasKPIProps {
  kpis: KPIAvaliacao[];
  loading: boolean;
}

export default function MetricasKPI({ kpis, loading }: MetricasKPIProps) {
  const { t } = useI18n();

  const getIconForKPI = (nome: string) => {
    const nomeNormalizado = nome.toLowerCase();
    if (nomeNormalizado.includes('media') || nomeNormalizado.includes('pontuacao')) {
      return FiBarChart2;
    }
    if (nomeNormalizado.includes('meta') || nomeNormalizado.includes('objetivo')) {
      return FiTarget;
    }
    if (nomeNormalizado.includes('funcionario') || nomeNormalizado.includes('colaborador')) {
      return FiUsers;
    }
    if (nomeNormalizado.includes('concluida') || nomeNormalizado.includes('finalizada')) {
      return FiCheckCircle;
    }
    if (nomeNormalizado.includes('pendente') || nomeNormalizado.includes('prazo')) {
      return FiClock;
    }
    return FiBarChart2;
  };

  const getTrendIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'crescente':
        return <FiTrendingUp className="h-4 w-4 text-green-500" />;
      case 'decrescente':
        return <FiTrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <FiMinus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getVariacaoColor = (variacao: number) => {
    if (variacao > 0) return 'text-green-600';
    if (variacao < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatarValor = (valor: number, unidade: string) => {
    if (unidade === '%') {
      return `${valor.toFixed(1)}%`;
    }
    if (unidade === 'pontos') {
      return `${valor.toFixed(2)} pts`;
    }
    if (unidade === 'dias') {
      return `${Math.round(valor)} dias`;
    }
    return valor.toLocaleString('pt-BR');
  };

  const calcularProgressoMeta = (valor: number, meta: number) => {
    if (meta === 0) return 0;
    return Math.min((valor / meta) * 100, 100);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8 h-8 bg-gray-200 rounded"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="w-20 h-8 bg-gray-200 rounded mb-2"></div>
            <div className="w-32 h-4 bg-gray-200 rounded mb-4"></div>
            <div className="w-full h-2 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!kpis || kpis.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <FiBarChart2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('avaliacoes.sem_kpis', 'Nenhuma métrica disponível')}
        </h3>
        <p className="text-gray-600">
          {t('avaliacoes.sem_kpis_descricao', 'Não há dados suficientes para calcular as métricas no período selecionado.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('avaliacoes.kpis_principais', 'KPIs Principais')}
        </h2>
        <span className="text-sm text-gray-500">
          {t('avaliacoes.periodo_atual', 'Período atual')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => {
          const IconComponent = getIconForKPI(kpi.nome);
          const progressoMeta = calcularProgressoMeta(kpi.valor, kpi.meta);
          
          return (
            <div
              key={kpi.id}
              className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${kpi.cor}20` }}
                  >
                    <IconComponent 
                      className="h-6 w-6"
                      style={{ color: kpi.cor }}
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    {getTrendIcon(kpi.tendencia)}
                    <span className={`text-sm font-medium ${getVariacaoColor(kpi.variacao)}`}>
                      {kpi.variacao > 0 ? '+' : ''}{kpi.variacao.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Valor Principal */}
                <div className="mb-2">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatarValor(kpi.valor, kpi.unidade)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {kpi.nome}
                  </div>
                </div>

                {/* Meta e Progresso */}
                {kpi.meta > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{t('avaliacoes.meta', 'Meta')}: {formatarValor(kpi.meta, kpi.unidade)}</span>
                      <span>{progressoMeta.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${progressoMeta}%`,
                          backgroundColor: progressoMeta >= 100 ? '#10B981' : 
                                         progressoMeta >= 75 ? '#F59E0B' : 
                                         progressoMeta >= 50 ? '#EF4444' : '#6B7280'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Descrição */}
                {kpi.descricao && (
                  <div className="text-xs text-gray-500 mt-3 border-t pt-3">
                    {kpi.descricao}
                  </div>
                )}

                {/* Período */}
                <div className="text-xs text-gray-400 mt-2">
                  {kpi.periodo}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo Geral */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              {t('avaliacoes.resumo_performance', 'Resumo de Performance')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-600 font-medium">
                  {kpis.filter(k => k.tendencia === 'crescente').length}
                </span>
                <span className="text-blue-800 ml-1">
                  {t('avaliacoes.melhorando', 'melhorando')}
                </span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">
                  {kpis.filter(k => k.tendencia === 'estavel').length}
                </span>
                <span className="text-blue-800 ml-1">
                  {t('avaliacoes.estavel', 'estável')}
                </span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">
                  {kpis.filter(k => k.tendencia === 'decrescente').length}
                </span>
                <span className="text-blue-800 ml-1">
                  {t('avaliacoes.piorando', 'piorando')}
                </span>
              </div>
              <div>
                <span className="text-blue-600 font-medium">
                  {kpis.filter(k => k.meta > 0 && k.valor >= k.meta).length}
                </span>
                <span className="text-blue-800 ml-1">
                  {t('avaliacoes.metas_atingidas', 'metas atingidas')}
                </span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <FiTarget className="h-12 w-12 text-blue-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
