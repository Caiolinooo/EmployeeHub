'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiFileText, 
  FiDownload, 
  FiSettings, 
  FiPlay,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiEye,
  FiFilter,
  FiCalendar,
  FiUsers,
  FiBriefcase
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { 
  ConfiguracaoRelatorio, 
  SolicitacaoRelatorio, 
  FiltroRelatorio,
  ResultadoGeracao
} from '@/types/relatorios-pdf';

interface GeradorRelatorioProps {
  configuracoes: ConfiguracaoRelatorio[];
  filtros: FiltroRelatorio;
  onFiltrosChange: (filtros: FiltroRelatorio) => void;
  onGerar: (configuracao: ConfiguracaoRelatorio, parametros: any) => Promise<ResultadoGeracao>;
  solicitacoes: SolicitacaoRelatorio[];
  canExport: boolean;
}

export default function GeradorRelatorio({
  configuracoes,
  filtros,
  onFiltrosChange,
  onGerar,
  solicitacoes,
  canExport
}: GeradorRelatorioProps) {
  const { t } = useI18n();
  const [configuracaoSelecionada, setConfiguracaoSelecionada] = useState<ConfiguracaoRelatorio | null>(null);
  const [parametros, setParametros] = useState<{ [key: string]: any }>({});
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);

  // Carregar opções para filtros
  useEffect(() => {
    carregarOpcoesFiltros();
  }, []);

  const carregarOpcoesFiltros = async () => {
    try {
      // Carregar departamentos
      const deptResponse = await fetch('/api/relatorios-pdf/opcoes-filtro?tipo=departamentos');
      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        setDepartamentos(deptData.departamentos || []);
      }

      // Carregar cargos
      const cargosResponse = await fetch('/api/relatorios-pdf/opcoes-filtro?tipo=cargos');
      if (cargosResponse.ok) {
        const cargosData = await cargosResponse.json();
        setCargos(cargosData.cargos || []);
      }
    } catch (error) {
      console.error({t('components.erroAoCarregarOpcoesDeFiltros')}, error);
    }
  };

  const handleSelecionarConfiguracao = (configuracao: ConfiguracaoRelatorio) => {
    setConfiguracaoSelecionada(configuracao);
    // Inicializar parâmetros com valores padrão
    const parametrosIniciais: { [key: string]: any } = {};
    configuracao.parametros.forEach(param => {
      if (param.valor_padrao !== undefined) {
        parametrosIniciais[param.nome] = param.valor_padrao;
      }
    });
    setParametros(parametrosIniciais);
  };

  const handleParametroChange = (nome: string, valor: any) => {
    setParametros(prev => ({
      ...prev,
      [nome]: valor
    }));
  };

  const handleGerarRelatorio = async () => {
    if (!configuracaoSelecionada || !canExport) return;

    try {
      setGerando(true);
      setProgresso(0);

      // Simular progresso
      const progressInterval = setInterval(() => {
        setProgresso(prev => Math.min(prev + 10, 90));
      }, 500);

      const resultado = await onGerar(configuracaoSelecionada, parametros);

      clearInterval(progressInterval);
      setProgresso(100);

      if (resultado.sucesso) {
        // Download automático
        if (resultado.arquivo_url) {
          const link = document.createElement('a');
          link.href = resultado.arquivo_url;
          link.download = resultado.nome_arquivo || 'relatorio.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }

    } catch (error) {
      console.error({t('components.erroAoGerarRelatorio')}, error);
    } finally {
      setGerando(false);
      setTimeout(() => setProgresso(0), 2000);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pendente':
        return <FiClock className="h-4 w-4 text-yellow-500" />;
      case 'processando':
        return <FiPlay className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'concluido':
        return <FiCheckCircle className="h-4 w-4 text-green-500" />;
      case 'erro':
        return <FiAlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FiClock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatarTamanhoArquivo = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Filtros Globais */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('relatorios.filtros_globais', 'Filtros Globais')}
          </h2>
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiFilter className="mr-1 h-4 w-4" />
            {mostrarFiltros ? t('common.ocultar', 'Ocultar') : t('common.mostrar', 'Mostrar')}
          </button>
        </div>

        {mostrarFiltros && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Período */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                <FiCalendar className="inline mr-1 h-4 w-4" />
                {t('common.periodo_inicio', 'Período Início')}
              </label>
              <input
                type="date"
                value={filtros.periodo_inicio}
                onChange={(e) => onFiltrosChange({ ...filtros, periodo_inicio: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                <FiCalendar className="inline mr-1 h-4 w-4" />
                {t('common.periodo_fim', 'Período Fim')}
              </label>
              <input
                type="date"
                value={filtros.periodo_fim}
                onChange={(e) => onFiltrosChange({ ...filtros, periodo_fim: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {/* Formato de Saída */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('relatorios.formato_saida', 'Formato de Saída')}
              </label>
              <select
                value={filtros.formato_saida}
                onChange={(e) => onFiltrosChange({ ...filtros, formato_saida: e.target.value as any })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
                <option value="word">Word</option>
              </select>
            </div>

            {/* Qualidade */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('relatorios.qualidade', 'Qualidade')}
              </label>
              <select
                value={filtros.qualidade}
                onChange={(e) => onFiltrosChange({ ...filtros, qualidade: e.target.value as any })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="baixa">{t('relatorios.qualidade_baixa', 'Baixa')}</option>
                <option value="media">{t('relatorios.qualidade_media', 'Média')}</option>
                <option value="alta">{t('relatorios.qualidade_alta', 'Alta')}</option>
              </select>
            </div>

            {/* Opções Adicionais */}
            <div className="md:col-span-2 lg:col-span-4 space-y-3">
              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filtros.incluir_graficos}
                    onChange={(e) => onFiltrosChange({ ...filtros, incluir_graficos: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t('relatorios.incluir_graficos', 'Incluir Gráficos')}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filtros.incluir_detalhes}
                    onChange={(e) => onFiltrosChange({ ...filtros, incluir_detalhes: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t('relatorios.incluir_detalhes', 'Incluir Detalhes')}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="radio"
                    name="orientacao"
                    value="portrait"
                    checked={filtros.orientacao === 'portrait'}
                    onChange={(e) => onFiltrosChange({ ...filtros, orientacao: e.target.value as any })}
                    className="border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t('relatorios.retrato', 'Retrato')}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="radio"
                    name="orientacao"
                    value="landscape"
                    checked={filtros.orientacao === 'landscape'}
                    onChange={(e) => onFiltrosChange({ ...filtros, orientacao: e.target.value as any })}
                    className="border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t('relatorios.paisagem', 'Paisagem')}
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Configurações */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {t('relatorios.tipos_relatorio', 'Tipos de Relatório')}
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {configuracoes.map((config) => (
                <button
                  key={config.id}
                  onClick={() => handleSelecionarConfiguracao(config)}
                  className={`w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors ${
                    configuracaoSelecionada?.id === config.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start">
                    <FiFileText className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {config.nome}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {config.descricao}
                      </div>
                      <div className="flex items-center mt-2 space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          config.tipo === 'avaliacao' ? 'bg-blue-100 text-blue-800' :
                          config.tipo === 'desempenho' ? 'bg-green-100 text-green-800' :
                          config.tipo === 'departamento' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {config.tipo}
                        </span>
                        {config.graficos.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {config.graficos.length} gráfico(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Configuração e Geração */}
        <div className="lg:col-span-2 space-y-6">
          {configuracaoSelecionada ? (
            <>
              {/* Parâmetros do Relatório */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {t('relatorios.parametros', 'Parâmetros do Relatório')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {configuracaoSelecionada.parametros.map((param) => (
                    <div key={param.nome} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {param.nome}
                        {param.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      
                      {param.tipo === 'texto' && (
                        <input
                          type="text"
                          value={parametros[param.nome] || ''}
                          onChange={(e) => handleParametroChange(param.nome, e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          required={param.obrigatorio}
                        />
                      )}
                      
                      {param.tipo === 'numero' && (
                        <input
                          type="number"
                          value={parametros[param.nome] || ''}
                          onChange={(e) => handleParametroChange(param.nome, parseFloat(e.target.value))}
                          min={param.validacao?.min}
                          max={param.validacao?.max}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          required={param.obrigatorio}
                        />
                      )}
                      
                      {param.tipo === 'data' && (
                        <input
                          type="date"
                          value={parametros[param.nome] || ''}
                          onChange={(e) => handleParametroChange(param.nome, e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          required={param.obrigatorio}
                        />
                      )}
                      
                      {param.tipo === 'select' && param.opcoes && (
                        <select
                          value={parametros[param.nome] || ''}
                          onChange={(e) => handleParametroChange(param.nome, e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          required={param.obrigatorio}
                        >
                          <option value="">Selecione...</option>
                          {param.opcoes.map((opcao) => (
                            <option key={opcao.value} value={opcao.value}>
                              {opcao.label}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {param.tipo === 'boolean' && (
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={parametros[param.nome] || false}
                            onChange={(e) => handleParametroChange(param.nome, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {param.nome}
                          </span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão de Geração */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('relatorios.gerar_relatorio', 'Gerar Relatório')}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {t('relatorios.gerar_descricao', 'Clique para gerar o relatório com os parâmetros selecionados')}
                    </p>
                  </div>
                  
                  <button
                    onClick={handleGerarRelatorio}
                    disabled={!canExport || gerando}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {gerando ? (
                      <>
                        <FiPlay className="animate-spin mr-2 h-4 w-4" />
                        {t('relatorios.gerando', 'Gerando...')}
                      </>
                    ) : (
                      <>
                        <FiDownload className="mr-2 h-4 w-4" />
                        {t('relatorios.gerar', 'Gerar')}
                      </>
                    )}
                  </button>
                </div>

                {/* Barra de Progresso */}
                {gerando && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>{t('relatorios.progresso', 'Progresso')}</span>
                      <span>{progresso}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progresso}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
              <FiFileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('relatorios.selecione_tipo', 'Selecione um tipo de relatório')}
              </h3>
              <p className="text-gray-600">
                {t('relatorios.selecione_tipo_desc', 'Escolha um tipo de relatório na lista ao lado para configurar os parâmetros.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Solicitações em Andamento */}
      {solicitacoes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {t('relatorios.solicitacoes_andamento', 'Solicitações em Andamento')}
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {solicitacoes.map((solicitacao) => (
              <div key={solicitacao.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(solicitacao.status)}
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">
                        {solicitacao.configuracao_id}
                      </div>
                      <div className="text-sm text-gray-500">
                        {t('relatorios.solicitado_em', 'Solicitado em')}: {new Date(solicitacao.solicitado_em).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {solicitacao.progresso !== undefined && (
                      <div className="text-sm text-gray-600">
                        {solicitacao.progresso}%
                      </div>
                    )}
                    
                    {solicitacao.status === 'concluido' && solicitacao.arquivo_url && (
                      <button
                        onClick={() => window.open(solicitacao.arquivo_url, '_blank')}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <FiDownload className="mr-1 h-3 w-3" />
                        {t('common.download', 'Download')}
                      </button>
                    )}
                  </div>
                </div>
                
                {solicitacao.progresso !== undefined && solicitacao.status === 'processando' && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${solicitacao.progresso}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
