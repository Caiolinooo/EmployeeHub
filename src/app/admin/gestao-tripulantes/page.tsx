'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FiSave, FiRefreshCw, FiToggleLeft, FiSliders, FiDatabase,
  FiBell, FiCamera, FiCpu, FiSettings, FiLayout, FiChevronDown, FiChevronRight,
  FiAnchor, FiGlobe, FiBriefcase, FiPlay, FiCheckCircle, FiAlertTriangle, FiClock,
  FiCalendar, FiDownload, FiFolder, FiCheckSquare, FiActivity
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import TiposEventoEscalaAdmin from '@/components/gestao-tripulantes/admin/TiposEventoEscalaAdmin';
import AuditoriaDocumentosTab from '@/components/gestao-tripulantes/admin/AuditoriaDocumentosTab';
import ExportarTab from '@/components/gestao-tripulantes/admin/ExportarTab';
import CentrosCustoAdminTab from '@/components/gestao-tripulantes/admin/CentrosCustoAdminTab';
import WorkflowFechamentoTab, {
  type WorkflowFechamentoHandle,
} from '@/components/gestao-tripulantes/admin/WorkflowFechamentoTab';
import AsoAgendamentoConfigTab from '@/components/gestao-tripulantes/admin/AsoAgendamentoConfigTab';
import MatrizTreinamentoConfigTab from '@/components/gestao-tripulantes/admin/MatrizTreinamentoConfigTab';
import { FiAward } from 'react-icons/fi';

function MioSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/cron/sync-mio', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: 'Falha ao sincronizar com MIO' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-abz-blue rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <FiRefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Sincronizando...' : 'Sincronizar Agora (Colaboradores + Treinamentos + Embarques)'}
      </button>
      {result && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <p className="font-medium">{result.success ? 'Sincronização concluída!' : 'Erro na sincronização'}</p>
          {result.data && (
            <div className="mt-2 space-y-1 text-xs">
              {result.data.colaboradores && (
                <p>Colaboradores: {result.data.colaboradores.importados} novos, {result.data.colaboradores.atualizados} atualizados</p>
              )}
              {result.data.treinamentos && (
                <p>Treinamentos: {result.data.treinamentos.importados} novos, {result.data.treinamentos.atualizados} atualizados, {result.data.treinamentos.ignorados} ignorados</p>
              )}
              {result.data.embarques && (
                <p>Embarques: {result.data.embarques.importados} novos, {result.data.embarques.atualizados} atualizados, {result.data.embarques.ignorados} ignorados</p>
              )}
              {result.data?.exportacao_mio && (
                <p>Exportados para MIO: {result.data.exportacao_mio.enviados || 0}</p>
              )}
            </div>
          )}
          {result.error && <p className="mt-1 text-xs">{result.error}</p>}
        </div>
      )}
    </div>
  );
}

interface ConfigValues {
  [key: string]: any;
}

const defaultConfig: ConfigValues = {
  modulo_ativo: true,
  nome_personalizado: '',
  mio_habilitado: false,
  mio_escrita_habilitada: false,
  mio_auto_sync: false,
  mio_intervalo_minutos: 60,
  poliweb_username: '',
  poliweb_password: '',
  poliweb_habilitado: false,
  notif_aso_dias_aviso: 60,
  notif_treinamento_dias_aviso: 15,
  notif_canal_inapp: true,
  notif_canal_email: false,
  notif_canal_push: false,
  ocr_qualidade: 'alta',
  ocr_auto_upload: false,
  ocr_fallback_api_url: '',
  ocr_fallback_api_key: '',
  algoritmo_peso_centro_custo: 30,
  algoritmo_peso_empresa: 20,
  algoritmo_peso_embarcacao: 15,
  algoritmo_peso_cargo: 10,
  algoritmo_peso_standby: 10,
  algoritmo_peso_substituiu_antes: 5,
  algoritmo_peso_docs_validos: 5,
  algoritmo_peso_senioridade: 5,
  algoritmo_limite_resultados: 5,
  auto_notificar_vencimentos: false,
  auto_sugerir_back: false,
  auto_poliweb_scrape: false,
  auto_ocr: false,
  dashboard_colunas_visiveis: 'nome,matricula,cargo,empresa,status_embarque',
  dashboard_intervalo_refresh: 30,
};

export default function GestaoTripulantesAdminPage() {
  const [config, setConfig] = useState<ConfigValues>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('geral');
  const fechamentoRef = useRef<WorkflowFechamentoHandle>(null);
  const TABS_COM_SALVAR_PROPRIO = new Set(['fechamento', 'aso_agendamento', 'auditoria', 'exportar', 'centros_custo', 'escala', 'matriz_treinamentos']);
  const [isTestingConexao, setIsTestingConexao] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [cronLogs, setCronLogs] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scrapeResult, setScrapeResult] = useState<any | null>(null);
  const [isSyncingMio, setIsSyncingMio] = useState(false);
  const [mioSyncResult, setMioSyncResult] = useState<any | null>(null);

  const handleSyncMio = async () => {
    setIsSyncingMio(true);
    setMioSyncResult(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/cron/sync-mio', {
        method: 'POST',
      });
      const data = await res.json();
      setMioSyncResult(data);
    } catch {
      setMioSyncResult({ success: false, error: 'Falha ao executar sincronização com MIO' });
    } finally {
      setIsSyncingMio(false);
    }
  };

  const fetchCronLogs = async () => {
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/cron-logs');
      const data = await res.json();
      if (data.success && data.data) {
        setCronLogs(data.data);
      }
    } catch {
      /* fail-soft */
    }
  };

  useEffect(() => {
    if (activeTab === 'poliweb' || activeTab === 'mio') {
      fetchCronLogs();
    }
  }, [activeTab]);

  const handleTestarConexao = async () => {
    setIsTestingConexao(true);
    setTestResult(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/poliweb/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: config.poliweb_username,
          password: config.poliweb_password,
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? 'Conexão estabelecida com sucesso!' : (data.error || 'Falha na conexão'),
      });
    } catch {
      setTestResult({ success: false, message: 'Erro ao testar conexão' });
    } finally {
      setIsTestingConexao(false);
    }
  };

  const handleExecutarScraping = async () => {
    setIsScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/poliweb/scrape', {
        method: 'POST',
      });
      const data = await res.json();
      setScrapeResult(data);
    } catch {
      setScrapeResult({ error: 'Erro ao executar sincronização manual' });
    } finally {
      setIsScraping(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/configuracoes');
      const data = await res.json();
      if (data.success && data.data) {
        const next: ConfigValues = { ...defaultConfig };
        for (const key of Object.keys(defaultConfig)) {
          if (data.data[key] !== undefined) next[key] = data.data[key];
        }
        setConfig(next);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      setError('Falha ao carregar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (activeTab === 'fechamento') {
      const result = await fechamentoRef.current?.save();
      if (result) {
        if (result.ok) {
          setSuccess(result.message);
          setError(null);
          setTimeout(() => setSuccess(null), 3000);
        } else {
          setError(result.message);
        }
      }
      return;
    }
    setIsSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Configurações salvas com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Erro ao salvar');
      }
    } catch {
      setError('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'matriz_treinamentos', label: 'Matriz de Treinamentos', icon: FiAward },
    { id: 'auditoria', label: 'Auditoria Documentos', icon: FiAlertTriangle },
    { id: 'exportar', label: 'Exportar', icon: FiDownload },
    { id: 'centros_custo', label: 'Centros de Custo', icon: FiFolder },
    { id: 'fechamento', label: 'Fechamento DP', icon: FiCheckSquare },
    { id: 'aso_agendamento', label: 'Agendamento ASO', icon: FiActivity },
    { id: 'geral', label: 'Configuração Geral', icon: FiSettings },
    { id: 'escala', label: 'Marcadores Escala', icon: FiCalendar },
    { id: 'mio', label: 'Integração MIO', icon: FiDatabase },
    { id: 'poliweb', label: 'PoliWeb', icon: FiGlobe },
    { id: 'notificacoes', label: 'Notificações', icon: FiBell },
    { id: 'ocr', label: 'OCR', icon: FiCamera },
    { id: 'algoritmo', label: 'Algoritmo Back', icon: FiCpu },
    { id: 'autonomia', label: 'Autonomia', icon: FiToggleLeft },
    { id: 'dashboard', label: 'Dashboard', icon: FiLayout },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FiRefreshCw className="animate-spin h-8 w-8 text-abz-blue" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 h-full gap-6">
      <div className="shrink-0 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Tripulantes</h1>
          <p className="text-sm text-gray-500">Configurações administrativas do módulo</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={() => {
              if (activeTab === 'fechamento') {
                void fechamentoRef.current?.reload();
                return;
              }
              void fetchConfig();
            }}
            className="flex items-center px-3 py-2 text-sm border rounded-md text-gray-600 hover:bg-gray-50"
          >
            <FiRefreshCw className="mr-2" /> Recarregar
          </button>
          {!TABS_COM_SALVAR_PROPRIO.has(activeTab) || activeTab === 'fechamento' ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? (
              <FiRefreshCw className="animate-spin mr-2" />
            ) : (
              <FiSave className="mr-2" />
            )}
            Salvar
          </button>
          ) : null}
        </div>
      </div>

      {success && (
        <div className="shrink-0 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md">{success}</div>
      )}
      {error && (
        <div className="shrink-0 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-md flex-1 min-h-0 flex flex-col">
        <div className="shrink-0 border-b overflow-x-auto no-scrollbar">
          <nav className="flex min-w-max">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-abz-blue text-abz-blue'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 sm:p-6 flex-1 min-h-0 overflow-auto touch-scroll">
          {activeTab === 'matriz_treinamentos' && <MatrizTreinamentoConfigTab />}
          {activeTab === 'auditoria' && <AuditoriaDocumentosTab />}
          {activeTab === 'exportar' && <ExportarTab />}
          {activeTab === 'centros_custo' && <CentrosCustoAdminTab />}
          {activeTab === 'fechamento' && <WorkflowFechamentoTab ref={fechamentoRef} />}
          {activeTab === 'aso_agendamento' && <AsoAgendamentoConfigTab />}

          {activeTab === 'escala' && <TiposEventoEscalaAdmin />}

          {activeTab === 'geral' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Módulo Ativo</p>
                  <p className="text-sm text-gray-500">Habilitar/desabilitar o módulo de Gestão de Tripulantes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config.modulo_ativo} onChange={e => updateField('modulo_ativo', e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Personalizado</label>
                <input
                  type="text"
                  value={config.nome_personalizado || ''}
                  onChange={e => updateField('nome_personalizado', e.target.value)}
                  placeholder="Gestão de Tripulantes"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                />
                <p className="text-xs text-gray-400 mt-1">Nome exibido no menu e cabeçalho do módulo</p>
              </div>
            </div>
          )}

          {activeTab === 'mio' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Integração MIO</p>
                  <p className="text-sm text-gray-500">Habilitar sincronização com o sistema MIO</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config.mio_habilitado} onChange={e => updateField('mio_habilitado', e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                </label>
              </div>

              {config.mio_habilitado && (
                <>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Escrita Habilitada</p>
                      <p className="text-sm text-gray-500">Permitir que o sistema envie dados para o MIO</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={config.mio_escrita_habilitada} onChange={e => updateField('mio_escrita_habilitada', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Sincronização Automática</p>
                      <p className="text-sm text-gray-500">Executar sync periódico automaticamente</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={config.mio_auto_sync} onChange={e => updateField('mio_auto_sync', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo (minutos)</label>
                    <input
                      type="number"
                      value={config.mio_intervalo_minutos}
                      onChange={e => updateField('mio_intervalo_minutos', parseInt(e.target.value) || 60)}
                      min={5}
                      max={1440}
                      className="w-32 px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                    />
                  </div>

                  {/* Operações de Sincronização MIO */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Sincronização MIO</h3>
                    <p className="text-xs text-gray-500 mb-3">Sincroniza colaboradores, treinamentos e histórico de embarques do MIO</p>
                    <div className="flex flex-wrap gap-3">
                      <MioSyncButton />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <FiClock /> Dados sincronizados: Integrantes (INT), Treinamentos (SMS), Embarques (LGP)
                    </p>
                  </div>

                  {/* Histórico de Execuções MIO */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Histórico de Sincronizações</h3>
                    {(!cronLogs || cronLogs.filter((l: any) => l.tipo === 'sync_mio').length === 0) ? (
                      <p className="text-sm text-gray-500 italic">Nenhuma sincronização executada ainda.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Data/Hora</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                              <th className="px-4 py-2 text-center font-medium text-gray-700">Processados</th>
                              <th className="px-4 py-2 text-center font-medium text-gray-700">Erros</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Duração</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {cronLogs.filter((l: any) => l.tipo === 'sync_mio').slice(0, 10).map((log: any) => {
                              const duracao = log.finalizado_em
                                ? `${Math.round((new Date(log.finalizado_em).getTime() - new Date(log.iniciado_em).getTime()) / 1000)}s`
                                : '-';
                              return (
                                <tr key={log.id}>
                                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                                    {new Date(log.iniciado_em).toLocaleString('pt-BR')}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                      log.status === 'sucesso' ? 'bg-green-100 text-green-800' :
                                      log.status === 'erro' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {log.status === 'sucesso' ? 'Sucesso' :
                                       log.status === 'erro' ? 'Erro' : 'Executando'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-center text-gray-600 font-medium">
                                    {log.registros_processados || 0}
                                  </td>
                                  <td className="px-4 py-2 text-center text-gray-600 font-medium">
                                    {log.registros_erro || 0}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-gray-500">{duracao}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'poliweb' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">PoliWeb Habilitado</p>
                  <p className="text-sm text-gray-500">Ativar integração com o sistema PoliWeb</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config.poliweb_habilitado} onChange={e => updateField('poliweb_habilitado', e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                </label>
              </div>

              {config.poliweb_habilitado && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                      <input
                        type="text"
                        value={config.poliweb_username || ''}
                        onChange={e => updateField('poliweb_username', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                      <input
                        type="password"
                        value={config.poliweb_password || ''}
                        onChange={e => updateField('poliweb_password', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                      />
                    </div>
                  </div>

                  {/* Operações */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Operações de Integração</h3>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleTestarConexao}
                        disabled={isTestingConexao || !config.poliweb_username || !config.poliweb_password}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-abz-blue disabled:opacity-50 flex items-center gap-2"
                      >
                        {isTestingConexao ? <FiRefreshCw className="animate-spin" /> : <FiGlobe />}
                        {isTestingConexao ? 'Testando...' : 'Testar Conexão'}
                      </button>

                      <button
                        type="button"
                        onClick={handleExecutarScraping}
                        disabled={isScraping || !config.poliweb_username || !config.poliweb_password}
                        className="px-4 py-2 bg-abz-blue text-white rounded-md text-sm font-medium hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-abz-blue disabled:opacity-50 flex items-center gap-2"
                      >
                        {isScraping ? <FiRefreshCw className="animate-spin" /> : <FiPlay />}
                        {isScraping ? 'Buscando exames...' : 'Sincronizar Agora'}
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <FiClock /> Execuções automáticas programadas diariamente às 09:00 e às 18:00
                    </p>

                    {/* Resultados de Conexão */}
                    {testResult && (
                      <div className={`mt-4 p-3 rounded-md text-sm flex items-start gap-2 ${
                        testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}>
                        {testResult.success ? <FiCheckCircle className="mt-0.5" /> : <FiAlertTriangle className="mt-0.5" />}
                        <div>
                          <p className="font-semibold">{testResult.success ? 'Conexão OK!' : 'Falha na Conexão'}</p>
                          <p className="text-xs mt-0.5">{testResult.message}</p>
                        </div>
                      </div>
                    )}

                    {/* Resultados de Sincronização */}
                    {scrapeResult && (
                      <div className={`mt-4 p-3 rounded-md text-sm flex items-start gap-2 ${
                        scrapeResult.error ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'
                      }`}>
                        {scrapeResult.error ? <FiAlertTriangle className="mt-0.5" /> : <FiCheckCircle className="mt-0.5" />}
                        <div>
                          <p className="font-semibold">{scrapeResult.error ? 'Erro na Sincronização' : 'Sincronização Concluída'}</p>
                          {scrapeResult.error ? (
                            <p className="text-xs mt-0.5">{scrapeResult.error}</p>
                          ) : (
                            <div className="text-xs mt-1 space-y-1">
                              <p>ASOs encontrados na clínica: <strong>{scrapeResult.total_encontrados}</strong></p>
                              <p>Importados com sucesso: <strong className="text-green-700">{scrapeResult.total_importados}</strong></p>
                              <p>Ignorados (já importados) ou com erros: <strong>{scrapeResult.total_encontrados - scrapeResult.total_importados}</strong></p>
                              {scrapeResult.erros && (scrapeResult.erros?.length ?? 0) > 0 && (
                                <details className="mt-2 text-red-700">
                                  <summary className="cursor-pointer font-medium">Visualizar Erros ({scrapeResult.total_erros})</summary>
                                  <ul className="list-disc list-inside mt-1 space-y-1 pl-1">
                                    {(scrapeResult.erros || []).slice(0, 5).map((e: string, i: number) => (
                                      <li key={i}>{e}</li>
                                    ))}
                                    {(scrapeResult.erros?.length ?? 0) > 5 && <li>E mais {(scrapeResult.erros?.length ?? 0) - 5}...</li>}
                                  </ul>
                                </details>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Histórico de Execuções */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Histórico de Execuções (Scraping)</h3>
                    {(!cronLogs || cronLogs.length === 0) ? (
                      <p className="text-sm text-gray-500 italic">Nenhum log de execução encontrado.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Data/Hora</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                              <th className="px-4 py-2 text-center font-medium text-gray-700">Importados</th>
                              <th className="px-4 py-2 text-center font-medium text-gray-700">Erros</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Duração</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-700">Detalhes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {cronLogs.map((log: any) => {
                              const duracao = log.finalizado_em
                                ? `${Math.round((new Date(log.finalizado_em).getTime() - new Date(log.iniciado_em).getTime()) / 1000)}s`
                                : '-';
                              return (
                                <tr key={log.id}>
                                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                                    {new Date(log.iniciado_em).toLocaleString('pt-BR')}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                      log.status === 'sucesso' ? 'bg-green-100 text-green-800' :
                                      log.status === 'erro' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {log.status === 'sucesso' ? 'Sucesso' :
                                       log.status === 'erro' ? 'Erro' : 'Executando'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-center text-gray-600 font-medium">
                                    {log.registros_processados || 0}
                                  </td>
                                  <td className="px-4 py-2 text-center text-gray-600 font-medium">
                                    {log.registros_erro || 0}
                                  </td>
                                  <td className="px-4 py-2 text-gray-600">{duracao}</td>
                                  <td className="px-4 py-2 text-gray-500 max-w-xs truncate">
                                    {log.mensagem_erro || log.detalhes?.mensagem || 'Processamento concluído'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'notificacoes' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dias de antecedência — ASO (alerta e sugestão de data)</label>
                <p className="text-xs text-gray-500 mb-1">Padrão 60. Também editável na aba Agendamento ASO (fonte: gt_aso_agendamento_config).</p>
                <input
                  type="number"
                  value={config.notif_aso_dias_aviso}
                  onChange={e => updateField('notif_aso_dias_aviso', parseInt(e.target.value) || 60)}
                  min={1}
                  max={365}
                  className="w-32 px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dias de Aviso - Treinamento</label>
                <input
                  type="number"
                  value={config.notif_treinamento_dias_aviso}
                  onChange={e => updateField('notif_treinamento_dias_aviso', parseInt(e.target.value) || 15)}
                  min={1}
                  max={365}
                  className="w-32 px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                />
              </div>

              <div className="space-y-3">
                <p className="font-medium text-gray-700">Canais de Notificação</p>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">In-App</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.notif_canal_inapp} onChange={e => updateField('notif_canal_inapp', e.target.checked)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">E-mail</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.notif_canal_email} onChange={e => updateField('notif_canal_email', e.target.checked)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">Push</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.notif_canal_push} onChange={e => updateField('notif_canal_push', e.target.checked)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ocr' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualidade do OCR</label>
                <select
                  value={config.ocr_qualidade || 'alta'}
                  onChange={e => updateField('ocr_qualidade', e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Upload Automático</p>
                  <p className="text-sm text-gray-500">Processar OCR automaticamente após upload</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config.ocr_auto_upload} onChange={e => updateField('ocr_auto_upload', e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fallback API URL</label>
                <input
                  type="text"
                  value={config.ocr_fallback_api_url || ''}
                  onChange={e => updateField('ocr_fallback_api_url', e.target.value)}
                  placeholder="https://api.exemplo.com/ocr"
                  className="w-full max-w-lg px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fallback API Key</label>
                <input
                  type="password"
                  value={config.ocr_fallback_api_key || ''}
                  onChange={e => updateField('ocr_fallback_api_key', e.target.value)}
                  className="w-full max-w-lg px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                />
              </div>
            </div>
          )}

          {activeTab === 'algoritmo' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500 mb-4">Defina os pesos (0-100) para cada critério do algoritmo de sugestão de back.</p>

              {[
                { key: 'algoritmo_peso_centro_custo', label: 'Mesmo Centro de Custo', desc: 'Prioridade para mesmo centro de custo' },
                { key: 'algoritmo_peso_empresa', label: 'Mesma Empresa', desc: 'Prioridade para mesma empresa' },
                { key: 'algoritmo_peso_embarcacao', label: 'Mesma Embarcação', desc: 'Prioridade para mesma embarcação' },
                { key: 'algoritmo_peso_cargo', label: 'Mesmo Cargo', desc: 'Prioridade para mesmo cargo' },
                { key: 'algoritmo_peso_standby', label: 'Standby', desc: 'Prioridade para tripulantes em standby' },
                { key: 'algoritmo_peso_substituiu_antes', label: 'Já Substituiu Antes', desc: 'Experiência prévia em substituições' },
                { key: 'algoritmo_peso_docs_validos', label: 'Documentos Válidos', desc: 'Documentação em dia' },
                { key: 'algoritmo_peso_senioridade', label: 'Senioridade', desc: 'Tempo de embarque' },
              ].map(item => (
                <div key={item.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <label className="text-sm font-medium text-gray-700">{item.label}</label>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <span className="text-sm font-semibold text-abz-blue w-12 text-right">{config[item.key] || 0}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={config[item.key] || 0}
                    onChange={e => updateField(item.key, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-abz-blue"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limite de Resultados</label>
                <input
                  type="number"
                  value={config.algoritmo_limite_resultados || 5}
                  onChange={e => updateField('algoritmo_limite_resultados', parseInt(e.target.value) || 5)}
                  min={1}
                  max={20}
                  className="w-32 px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                />
              </div>
            </div>
          )}

          {activeTab === 'autonomia' && (
            <div className="space-y-4">
              {[
                { key: 'auto_notificar_vencimentos', label: 'Notificar Vencimentos Automaticamente', desc: 'Enviar notificações automáticas quando documentos estiverem próximos do vencimento' },
                { key: 'auto_sugerir_back', label: 'Sugestão Automática de Back', desc: 'Gerar sugestões de back automaticamente ao detectar necessidade' },
                { key: 'auto_poliweb_scrape', label: 'Scraping Automático PoliWeb', desc: 'Executar scraping do PoliWeb em intervalo programado' },
                { key: 'auto_ocr', label: 'OCR Automático', desc: 'Processar OCR automaticamente em documentos recém-uploadados' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config[item.key]} onChange={e => updateField(item.key, e.target.checked)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-abz-blue rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-abz-blue"></div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colunas Visíveis</label>
                <input
                  type="text"
                  value={config.dashboard_colunas_visiveis || ''}
                  onChange={e => updateField('dashboard_colunas_visiveis', e.target.value)}
                  placeholder="nome,matricula,cargo,empresa,status_embarque"
                  className="w-full max-w-lg px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                />
                <p className="text-xs text-gray-400 mt-1">Separado por vírgulas: nome, matricula, cargo, empresa, status_embarque, centro_custo, documentos</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo de Refresh (segundos)</label>
                <input
                  type="number"
                  value={config.dashboard_intervalo_refresh || 30}
                  onChange={e => updateField('dashboard_intervalo_refresh', parseInt(e.target.value) || 30)}
                  min={10}
                  max={3600}
                  className="w-32 px-3 py-2 border rounded-md text-sm focus:ring-abz-blue focus:border-abz-blue"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
