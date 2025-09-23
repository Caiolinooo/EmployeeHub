'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiFileText, 
  FiDownload, 
  FiSettings, 
  FiEye,
  FiPlus,
  FiFilter,
  FiRefreshCw,
  FiCalendar,
  FiBarChart2,
  FiTable,
  FiImage
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import { 
  ConfiguracaoRelatorio, 
  SolicitacaoRelatorio, 
  FiltroRelatorio,
  TemplateRelatorio,
  HistoricoRelatorio
} from '@/types/relatorios-pdf';
import GeradorRelatorio from '@/components/RelatoriosPDF/GeradorRelatorio';
import EditorTemplate from '@/components/RelatoriosPDF/EditorTemplate';
import HistoricoRelatorios from '@/components/RelatoriosPDF/HistoricoRelatorios';
import TemplatesDisponiveis from '@/components/RelatoriosPDF/TemplatesDisponiveis';

export default function RelatoriosPDFPage() {
  const { t } = useI18n();
  const { user, isAdmin, isManager } = useSupabaseAuth();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [abaSelecionada, setAbaSelecionada] = useState<'gerar' | 'templates' | 'historico'>('gerar');
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoRelatorio[]>([]);
  const [templates, setTemplates] = useState<TemplateRelatorio[]>([]);
  const [historico, setHistorico] = useState<HistoricoRelatorio[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRelatorio[]>([]);
  const [configuracaoSelecionada, setConfiguracaoSelecionada] = useState<ConfiguracaoRelatorio | null>(null);
  const [mostrarEditor, setMostrarEditor] = useState(false);
  const [templateEditando, setTemplateEditando] = useState<TemplateRelatorio | null>(null);

  // Filtros
  const [filtros, setFiltros] = useState<FiltroRelatorio>({
    periodo_inicio: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    periodo_fim: new Date().toISOString().split('T')[0],
    departamentos: [],
    cargos: [],
    funcionarios: [],
    tipos_avaliacao: [],
    status: ['concluida'],
    incluir_graficos: true,
    incluir_detalhes: true,
    formato_saida: 'pdf',
    orientacao: 'portrait',
    qualidade: 'alta'
  });

  // Verificar permissões (simplificado para funcionar)
  const canGenerateReports = isAdmin || isManager;
  const canExportReports = isAdmin || isManager;
  const canManageTemplates = isAdmin;

  // Carregar dados iniciais
  useEffect(() => {
    if (user && canGenerateReports) {
      carregarDados();
    }
  }, [user, canGenerateReports]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar configurações de relatórios
      const configResponse = await fetch('/api/relatorios-pdf/configuracoes');
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setConfiguracoes(configData.configuracoes || []);
      }

      // Carregar templates disponíveis
      const templatesResponse = await fetch('/api/relatorios-pdf/templates');
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        setTemplates(templatesData.templates || []);
      }

      // Carregar histórico
      const historicoResponse = await fetch('/api/relatorios-pdf/historico');
      if (historicoResponse.ok) {
        const historicoData = await historicoResponse.json();
        setHistorico(historicoData.historico || []);
      }

      // Carregar solicitações em andamento
      const solicitacoesResponse = await fetch('/api/relatorios-pdf/solicitacoes');
      if (solicitacoesResponse.ok) {
        const solicitacoesData = await solicitacoesResponse.json();
        setSolicitacoes(solicitacoesData.solicitacoes || []);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGerarRelatorio = async (configuracao: ConfiguracaoRelatorio, parametros: any) => {
    try {
      const response = await fetch('/api/relatorios-pdf/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configuracao_id: configuracao.id,
          parametros,
          filtros
        })
      });

      if (response.ok) {
        const resultado = await response.json();
        // Atualizar lista de solicitações
        carregarDados();
        return resultado;
      } else {
        throw new Error('Erro ao gerar relatório');
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      throw error;
    }
  };

  const handleSalvarTemplate = async (template: TemplateRelatorio) => {
    try {
      const response = await fetch('/api/relatorios-pdf/templates', {
        method: template.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });

      if (response.ok) {
        carregarDados();
        setMostrarEditor(false);
        setTemplateEditando(null);
      } else {
        throw new Error('Erro ao salvar template');
      }
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      throw error;
    }
  };

  if (!canGenerateReports) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiFileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('relatorios.sem_permissao', 'Sem permissão para acessar relatórios')}
          </h3>
          <p className="text-gray-600">
            {t('relatorios.sem_permissao_desc', 'Você não tem permissão para visualizar ou gerar relatórios.')}
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <FiFileText className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {t('relatorios.titulo', 'Relatórios PDF')}
                </h1>
                <p className="text-sm text-gray-600">
                  {t('relatorios.descricao', 'Gere relatórios personalizados com gráficos e análises')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {canManageTemplates && (
                <button
                  onClick={() => {
                    setTemplateEditando(null);
                    setMostrarEditor(true);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-green-700"
                >
                  <FiPlus className="mr-2 h-4 w-4" />
                  {t('relatorios.novo_template', 'Novo Template')}
                </button>
              )}

              <button
                onClick={carregarDados}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
              >
                <FiRefreshCw className="mr-2 h-4 w-4" />
                {t('common.atualizar', 'Atualizar')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setAbaSelecionada('gerar')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                abaSelecionada === 'gerar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiBarChart2 className="inline mr-2 h-4 w-4" />
              {t('relatorios.gerar', 'Gerar Relatório')}
            </button>

            <button
              onClick={() => setAbaSelecionada('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                abaSelecionada === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiImage className="inline mr-2 h-4 w-4" />
              {t('relatorios.templates', 'Templates')}
            </button>

            <button
              onClick={() => setAbaSelecionada('historico')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                abaSelecionada === 'historico'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiTable className="inline mr-2 h-4 w-4" />
              {t('relatorios.historico', 'Histórico')}
            </button>
          </nav>
        </div>
      </div>

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
          <>
            {abaSelecionada === 'gerar' && (
              <GeradorRelatorio
                configuracoes={configuracoes}
                filtros={filtros}
                onFiltrosChange={setFiltros}
                onGerar={handleGerarRelatorio}
                solicitacoes={solicitacoes}
                canExport={canExportReports}
              />
            )}

            {abaSelecionada === 'templates' && (
              <TemplatesDisponiveis
                templates={templates}
                onEditar={(template) => {
                  setTemplateEditando(template);
                  setMostrarEditor(true);
                }}
                onUsar={(template) => {
                  // Converter template para configuração e usar no gerador
                  setConfiguracaoSelecionada(template.configuracao);
                  setAbaSelecionada('gerar');
                }}
                canManage={canManageTemplates}
              />
            )}

            {abaSelecionada === 'historico' && (
              <HistoricoRelatorios
                historico={historico}
                onDownload={(relatorio) => {
                  window.open(relatorio.arquivo_url, '_blank');
                }}
                onRegenerate={(relatorio) => {
                  // Implementar regeneração
                  console.log('Regenerar:', relatorio);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Modal do Editor de Template */}
      {mostrarEditor && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <EditorTemplate
              template={templateEditando}
              onSalvar={handleSalvarTemplate}
              onCancelar={() => {
                setMostrarEditor(false);
                setTemplateEditando(null);
              }}
              modo={templateEditando ? 'editar' : 'criar'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
