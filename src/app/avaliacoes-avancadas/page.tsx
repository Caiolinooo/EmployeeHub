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
  const [activeTab, setActiveTab] = useState<'metricas' | 'relatorios'>('metricas');
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportType, setReportType] = useState<'individual' | 'departmental' | 'executive'>('individual');
  const [reportParameters, setReportParameters] = useState({
    targetUserId: '',
    department: '',
    periodStart: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0]
  });

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

    if (formato === 'pdf') {
      await generatePDFReport();
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

  // Função para gerar relatório PDF
  const generatePDFReport = async () => {
    try {
      setReportGenerating(true);

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token || ''}`
        },
        body: JSON.stringify({
          reportType,
          parameters: reportParameters
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }

      const result = await response.json();

      if (result.success && result.filePath) {
        // Abrir o PDF em nova aba
        window.open(result.filePath, '_blank');
        toast.success('Relatório gerado com sucesso!');
      } else {
        throw new Error('Erro na geração do relatório');
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório PDF');
    } finally {
      setReportGenerating(false);
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

      {/* Navegação por Abas */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('metricas')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'metricas'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiBarChart2 className="inline mr-2" />
              Métricas e Análises
            </button>
            <button
              onClick={() => setActiveTab('relatorios')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'relatorios'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiDownload className="inline mr-2" />
              Relatórios PDF
            </button>
          </nav>
        </div>
      </div>

      {/* Filtros Avançados */}
      {showFiltros && activeTab === 'metricas' && (
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
        {activeTab === 'metricas' ? (
          loading ? (
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
          )
        ) : (
          // Aba de Relatórios PDF
          <div className="space-y-6">
            {/* Configuração do Relatório */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <FiDownload className="mr-2 text-blue-600" />
                Configurar Relatório PDF
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Tipo de Relatório */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Relatório
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="individual">Performance Individual</option>
                    <option value="departmental">Análise Departamental</option>
                    <option value="executive">Relatório Executivo</option>
                  </select>
                </div>

                {/* Período */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Início
                    </label>
                    <input
                      type="date"
                      value={reportParameters.periodStart}
                      onChange={(e) => setReportParameters(prev => ({ ...prev, periodStart: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Fim
                    </label>
                    <input
                      type="date"
                      value={reportParameters.periodEnd}
                      onChange={(e) => setReportParameters(prev => ({ ...prev, periodEnd: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Parâmetros específicos por tipo */}
              {reportType === 'individual' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Funcionário (deixe vazio para seu próprio relatório)
                  </label>
                  <input
                    type="text"
                    placeholder="ID do funcionário ou deixe vazio"
                    value={reportParameters.targetUserId}
                    onChange={(e) => setReportParameters(prev => ({ ...prev, targetUserId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {reportType === 'departmental' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Departamento
                  </label>
                  <select
                    value={reportParameters.department}
                    onChange={(e) => setReportParameters(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um departamento</option>
                    <option value="TI">Tecnologia da Informação</option>
                    <option value="RH">Recursos Humanos</option>
                    <option value="Vendas">Vendas</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Operações">Operações</option>
                  </select>
                </div>
              )}

              {/* Botão de Gerar */}
              <div className="flex justify-end">
                <button
                  onClick={generatePDFReport}
                  disabled={reportGenerating}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {reportGenerating ? (
                    <>
                      <FiRefreshCw className="animate-spin mr-2" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FiDownload className="mr-2" />
                      Gerar Relatório PDF
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Templates de Relatório */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Templates Disponíveis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h4 className="font-medium text-gray-900 mb-2">Performance Individual</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    • Métricas pessoais<br/>
                    • Gráficos de evolução<br/>
                    • Histórico de avaliações<br/>
                    • Reembolsos e benefícios
                  </p>
                  <button
                    onClick={() => {
                      setReportType('individual');
                      generatePDFReport();
                    }}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    Gerar Agora
                  </button>
                </div>

                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h4 className="font-medium text-gray-900 mb-2">Análise Departamental</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    • Comparativo por equipe<br/>
                    • Rankings de performance<br/>
                    • Distribuição de notas<br/>
                    • Tendências mensais
                  </p>
                  <button
                    onClick={() => {
                      setReportType('departmental');
                      generatePDFReport();
                    }}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    Gerar Agora
                  </button>
                </div>

                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h4 className="font-medium text-gray-900 mb-2">Relatório Executivo</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    • Visão geral da empresa<br/>
                    • KPIs principais<br/>
                    • Resumo por departamento<br/>
                    • Insights estratégicos
                  </p>
                  <button
                    onClick={() => {
                      setReportType('executive');
                      generatePDFReport();
                    }}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    Gerar Agora
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
