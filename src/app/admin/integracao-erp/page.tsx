'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiDatabase, 
  FiLink, 
  FiActivity, 
  FiSettings,
  FiRefreshCw,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiPlay,
  FiPause,
  FiClock,
  FiUsers,
  FiDollarSign,
  FiFileText
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface ERPConnection {
  id: string;
  name: string;
  type: 'SAP' | 'Oracle' | 'Protheus' | 'Senior' | 'Outro';
  status: 'connected' | 'disconnected' | 'error';
  last_sync: string | null;
  endpoint: string;
  modules: string[];
  active: boolean;
}

interface SyncStatus {
  module: string;
  status: 'success' | 'error' | 'running';
  last_sync: string;
  records_synced: number;
  errors: number;
}

export default function IntegracaoERPPage() {
  const { t } = useI18n();
  const { user, isAdmin } = useSupabaseAuth();
  
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: '',
    type: 'SAP' as const,
    endpoint: '',
    username: '',
    password: '',
    modules: [] as string[]
  });

  const availableModules = [
    { id: 'usuarios', name: t('admin.usuarios'), icon: FiUsers },
    { id: 'folha_pagamento', name: 'Folha de Pagamento', icon: FiDollarSign },
    { id: 'avaliacoes', name: t('admin.avaliacoes'), icon: FiFileText },
    { id: 'departamentos', name: 'Departamentos', icon: FiUsers },
    { id: 'cargos', name: 'Cargos', icon: FiFileText },
  ];

  const erpTypes = ['SAP', 'Oracle', 'Protheus', 'Senior', 'Outro'];

  useEffect(() => {
    if (isAdmin) {
      loadERPData();
    }
  }, [isAdmin]);

  const loadERPData = async () => {
    try {
      setLoading(true);
      
      // Simular carregamento de dados
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Dados simulados
      setConnections([
        {
          id: '1',
          name: t('admin.sapProducao'),
          type: 'SAP',
          status: 'connected',
          last_sync: '2024-01-20T14:30:00Z',
          endpoint: 'https://sap.empresa.com/api',
          modules: ['usuarios', 'folha_pagamento', 'departamentos'],
          active: true
        },
        {
          id: '2',
          name: 'Protheus Teste',
          type: 'Protheus',
          status: 'disconnected',
          last_sync: '2024-01-19T10:00:00Z',
          endpoint: 'https://protheus-test.empresa.com/api',
          modules: ['avaliacoes'],
          active: false
        }
      ]);

      setSyncStatuses([
        {
          module: 'usuarios',
          status: 'success',
          last_sync: '2024-01-20T14:30:00Z',
          records_synced: 1250,
          errors: 0
        },
        {
          module: 'folha_pagamento',
          status: 'running',
          last_sync: '2024-01-20T14:25:00Z',
          records_synced: 890,
          errors: 2
        },
        {
          module: 'departamentos',
          status: 'error',
          last_sync: '2024-01-20T13:00:00Z',
          records_synced: 0,
          errors: 5
        }
      ]);

    } catch (error) {
      console.error('Erro ao carregar dados ERP:', error);
      toast.error(t('admin.erroAoCarregarDadosDeIntegracao'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!newConnection.name.trim() || !newConnection.endpoint.trim()) {
      toast.error(t('admin.nomeEEndpointSaoObrigatorios'));
      return;
    }

    if (newConnection.modules.length === 0) {
      toast.error(t('admin.selecionePeloMenosUmModulo'));
      return;
    }

    try {
      const connection: ERPConnection = {
        id: Date.now().toString(),
        name: newConnection.name,
        type: newConnection.type,
        status: 'disconnected',
        last_sync: null,
        endpoint: newConnection.endpoint,
        modules: newConnection.modules,
        active: false
      };

      setConnections([...connections, connection]);
      setNewConnection({
        name: '',
        type: 'SAP',
        endpoint: '',
        username: '',
        password: '',
        modules: []
      });
      setShowConnectionForm(false);
      toast.success(t('admin.conexaoErpCriadaComSucesso'));
    } catch (error) {
      console.error(t('admin.erroAoCriarConexao'), error);
      toast.error(t('admin.erroAoCriarConexaoErp'));
    }
  };

  const toggleConnection = async (connectionId: string) => {
    try {
      setConnections(connections.map(conn => 
        conn.id === connectionId 
          ? { 
              ...conn, 
              active: !conn.active,
              status: !conn.active ? 'connected' : 'disconnected'
            } 
          : conn
      ));
      toast.success(t('admin.statusDaConexaoAtualizado'));
    } catch (error) {
      console.error(t('admin.erroAoAtualizarConexao'), error);
      toast.error(t('admin.erroAoAtualizarStatusDaConexao'));
    }
  };

  const startSync = async (module: string) => {
    try {
      setSyncStatuses(syncStatuses.map(status => 
        status.module === module 
          ? { ...status, status: 'running' as const }
          : status
      ));
      toast.success(t('admin.sincronizacaoDeModuleIniciada'));
      
      // Simular sincronização
      setTimeout(() => {
        setSyncStatuses(syncStatuses.map(status => 
          status.module === module 
            ? { 
                ...status, 
                status: 'success' as const,
                last_sync: new Date().toISOString(),
                records_synced: Math.floor(Math.random() * 1000) + 100
              }
            : status
        ));
        toast.success(t('admin.sincronizacaoDeModuleConcluida'));
      }, 3000);
    } catch (error) {
      console.error(t('admin.erroAoIniciarSincronizacao'), error);
      toast.error(t('admin.erroAoIniciarSincronizacao'));
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Acesso Negado
          </h2>
          <p className="text-gray-600">
            Apenas administradores podem acessar a integração ERP.
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
                <FiDatabase className="mr-3 text-blue-600" />
                Integração ERP
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Gerencie conexões e sincronizações com sistemas ERP externos
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={loadERPData}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiRefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </button>
              
              <button
                onClick={() => setShowConnectionForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
              >
                <FiLink className="mr-2 h-4 w-4" />
                Nova Conexão
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FiRefreshCw className="animate-spin h-8 w-8 text-blue-600 mr-3" />
            <span className="text-lg text-gray-600">Carregando...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Conexões ERP */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Conexões ERP</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Gerencie as conexões com sistemas ERP externos
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Última Sincronização
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Módulos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {connections.map((connection) => (
                      <tr key={connection.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {connection.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {connection.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            connection.status === 'connected' 
                              ? 'bg-green-100 text-green-800' 
                              : connection.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {connection.status === 'connected' ? 'Conectado' : 
                             connection.status === 'error' ? 'Erro' : 'Desconectado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {connection.last_sync ? new Date(connection.last_sync).toLocaleString('pt-BR') : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-wrap gap-1">
                            {connection.modules.map((module) => (
                              <span
                                key={module}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {availableModules.find(m => m.id === module)?.name || module}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => toggleConnection(connection.id)}
                            className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                              connection.active
                                ? 'text-red-700 bg-red-100 hover:bg-red-200'
                                : 'text-green-700 bg-green-100 hover:bg-green-200'
                            }`}
                          >
                            {connection.active ? <FiPause className="mr-1 h-4 w-4" /> : <FiPlay className="mr-1 h-4 w-4" />}
                            {connection.active ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status de Sincronização */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Status de Sincronização</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Monitore o status das sincronizações por módulo
                </p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {syncStatuses.map((status) => {
                    const moduleInfo = availableModules.find(m => m.id === status.module);
                    const IconComponent = moduleInfo?.icon || FiFileText;
                    
                    return (
                      <div key={status.module} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <IconComponent className="h-5 w-5 text-gray-600 mr-2" />
                            <h4 className="font-medium text-gray-900">
                              {moduleInfo?.name || status.module}
                            </h4>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            status.status === 'success' 
                              ? 'bg-green-100 text-green-800' 
                              : status.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {status.status === 'success' ? 'Sucesso' : 
                             status.status === 'error' ? 'Erro' : 'Executando'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Registros:</span>
                            <span className="font-medium">{status.records_synced.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Erros:</span>
                            <span className={`font-medium ${status.errors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {status.errors}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Última sync:</span>
                            <span className="font-medium">
                              {new Date(status.last_sync).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => startSync(status.module)}
                          disabled={status.status === 'running'}
                          className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {status.status === 'running' ? (
                            <>
                              <FiRefreshCw className="inline animate-spin mr-2 h-4 w-4" />
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <FiRefreshCw className="inline mr-2 h-4 w-4" />
                              Sincronizar
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Nova Conexão */}
      {showConnectionForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Nova Conexão ERP</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Conexão
                  </label>
                  <input
                    type="text"
                    value={newConnection.name}
                    onChange={(e) => setNewConnection({...newConnection, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('admin.exSapProducao')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de ERP
                  </label>
                  <select
                    value={newConnection.type}
                    onChange={(e) => setNewConnection({...newConnection, type: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {erpTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endpoint
                  </label>
                  <input
                    type="url"
                    value={newConnection.endpoint}
                    onChange={(e) => setNewConnection({...newConnection, endpoint: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://erp.empresa.com/api"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Módulos
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {availableModules.map((module) => (
                      <label key={module.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newConnection.modules.includes(module.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewConnection({
                                ...newConnection,
                                modules: [...newConnection.modules, module.id]
                              });
                            } else {
                              setNewConnection({
                                ...newConnection,
                                modules: newConnection.modules.filter(m => m !== module.id)
                              });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{module.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowConnectionForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateConnection}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Criar Conexão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
