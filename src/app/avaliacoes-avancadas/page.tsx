'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiBarChart2, 
  FiTrendingUp, 
  FiUsers, 
  FiTarget, 
  FiAlertCircle,
  FiDownload,
  FiSettings,
  FiRefreshCw,
  FiFilter
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import MetricasKPI from '@/components/AvaliacoesAvancadas/MetricasKPI';
import GraficosPerformance from '@/components/AvaliacoesAvancadas/GraficosPerformance';
import FiltrosAvancados from '@/components/AvaliacoesAvancadas/FiltrosAvancados';
import TabelaAnalises from '@/components/AvaliacoesAvancadas/TabelaAnalises';
import AlertasPerformance from '@/components/AvaliacoesAvancadas/AlertasPerformance';
import { KPIAvaliacao, FiltroAnalise, ResultadoAnalise } from '@/types/avaliacoes-avancadas';

export default function AvaliacoesAvancadasPage() {
  const { t } = useI18n();
  const { user, isAdmin, isManager } = useSupabaseAuth();

  // Estados
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIAvaliacao[]>([]);
  const [analiseData, setAnaliseData] = useState<ResultadoAnalise | null>(null);
  const [filtros, setFiltros] = useState<FiltroAnalise>({
    periodo_inicio: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    periodo_fim: new Date().toISOString().split('T')[0],
    departamentos: [],
    cargos: [],
    funcionarios: [],
    status_avaliacoes: ['concluida'],
    criterios: []
  });
  const [showFiltros, setShowFiltros] = useState(false);

  // Verificar permissões (simplificado para funcionar)
  const canViewMetricas = isAdmin || isManager;
  const canExportRelatorios = isAdmin || isManager;
  const canConfigDashboard = isAdmin;

  // Carregar dados iniciais
  useEffect(() => {
    if (user && canViewMetricas) {
      carregarDados();
    }
  }, [user, canViewMetricas, filtros]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar KPIs
      const kpisResponse = await fetch('/api/avaliacoes-avancadas/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtros)
      });
      
      if (kpisResponse.ok) {
        const kpisData = await kpisResponse.json();
        setKpis(kpisData.kpis || []);
      }

      // Carregar análise completa
      const analiseResponse = await fetch('/api/avaliacoes-avancadas/analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtros)
      });
      
      if (analiseResponse.ok) {
        const analiseResult = await analiseResponse.json();
        setAnaliseData(analiseResult.data);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error(t('avaliacoes.erro_carregar', 'Erro ao carregar dados das avaliações'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportarRelatorio = async (formato: 'pdf' | 'excel' | 'csv') => {
    if (!canExportRelatorios) {
      toast.error(t('common.sem_permissao', 'Sem permissão para esta ação'));
      return;
    }

    try {
      const response = await fetch('/api/avaliacoes-avancadas/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formato,
          filtros,
          incluir_graficos: true,
          incluir_dados_brutos: formato !== 'pdf'
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-avaliacoes-${new Date().toISOString().split('T')[0]}.${formato}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success(t('avaliacoes.relatorio_exportado', 'Relatório exportado com sucesso'));
      } else {
        throw new Error('Erro ao exportar relatório');
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error(t('avaliacoes.erro_exportar', 'Erro ao exportar relatório'));
    }
  };

  if (!canViewMetricas) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('common.acesso_negado', 'Acesso Negado')}
          </h2>
          <p className="text-gray-600">
            {t('avaliacoes.sem_permissao_metricas', 'Você não tem permissão para visualizar métricas de avaliações')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <FiBarChart2 className="mr-3 text-blue-600" />
                {t('avaliacoes.titulo_avancado', 'Avaliações Avançadas')}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {t('avaliacoes.descricao_avancado', 'Métricas, análises e relatórios detalhados de performance')}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFiltros(!showFiltros)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiFilter className="mr-2 h-4 w-4" />
                {t('common.filtros', 'Filtros')}
              </button>
              
              <button
                onClick={carregarDados}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <FiRefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('common.atualizar', 'Atualizar')}
              </button>

              {canExportRelatorios && (
                <div className="relative inline-block text-left">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleExportarRelatorio(e.target.value as 'pdf' | 'excel' | 'csv');
                        e.target.value = '';
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <option value="">{t('common.exportar', 'Exportar')}</option>
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
              )}

              {canConfigDashboard && (
                <button
                  onClick={() => window.location.href = '/avaliacoes-avancadas/configuracoes'}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
                >
                  <FiSettings className="mr-2 h-4 w-4" />
                  {t('common.configuracoes', 'Configurações')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros Avançados */}
      {showFiltros && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <FiltrosAvancados
              filtros={filtros}
              onChange={setFiltros}
              onApply={() => setShowFiltros(false)}
            />
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FiRefreshCw className="animate-spin h-8 w-8 text-blue-600 mr-3" />
            <span className="text-lg text-gray-600">
              {t('common.carregando', 'Carregando...')}
            </span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPIs */}
            <MetricasKPI kpis={kpis} loading={loading} />

            {/* Alertas */}
            {analiseData?.alertas && analiseData.alertas.length > 0 && (
              <AlertasPerformance alertas={analiseData.alertas} />
            )}

            {/* Gráficos de Performance */}
            <GraficosPerformance 
              tendencias={analiseData?.tendencias || []}
              comparacoes={analiseData?.comparacoes}
              loading={loading}
            />

            {/* Tabela de Análises Detalhadas */}
            <TabelaAnalises 
              dados={analiseData}
              filtros={filtros}
              loading={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
