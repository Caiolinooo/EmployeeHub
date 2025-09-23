'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import { useI18n } from '@/contexts/I18nContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { toast } from 'react-hot-toast';
import {
  FiDatabase,
  FiSettings,
  FiActivity,
  FiUsers,
  FiDollarSign,
  FiCalendar,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiPlay,
  FiPause,
  FiDownload,
  FiUpload,
  FiEye,
  FiClock,
  FiBarChart3
} from 'react-icons/fi';
import { ERPConnection, ERPSyncJob, ERPMetrics, ERPAlert } from '@/types/integracao-erp';

export default function IntegracaoERPPage() {
  const { user, isAdmin, isManager } = useSupabaseAuth();
  const { hasPermission } = useACLPermissions();
  const { t } = useI18n();
  
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [syncJobs, setSyncJobs] = useState<ERPSyncJob[]>([]);
  const [metrics, setMetrics] = useState<ERPMetrics[]>([]);
  const [alerts, setAlerts] = useState<ERPAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  // Verificar permissões
  const canViewERP = hasPermission('erp.view') || isAdmin || isManager;
  const canManageERP = hasPermission('erp.manage') || isAdmin;
  const canSyncERP = hasPermission('erp.sync') || isAdmin || isManager;

  useEffect(() => {
    if (canViewERP) {
      loadData();
    }
  }, [canViewERP]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadConnections(),
        loadSyncJobs(),
        loadMetrics(),
        loadAlerts()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do ERP');
    } finally {
      setLoading(false);
    }
  };

  const loadConnections = async () => {
    try {
      const response = await fetch('/api/integracao-erp/connections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    }
  };

  const loadSyncJobs = async () => {
    try {
      const response = await fetch('/api/integracao-erp/sync-jobs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSyncJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Erro ao carregar jobs de sincronização:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/integracao-erp/metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics || []);
      }
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/integracao-erp/alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    }
  };

  const testConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/integracao-erp/connections/${connectionId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Conexão testada com sucesso!');
        loadConnections();
      } else {
        toast.error(data.message || 'Erro ao testar conexão');
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      toast.error('Erro ao testar conexão');
    }
  };

  const startSync = async (connectionId: string, module: string) => {
    try {
      const response = await fetch('/api/integracao-erp/sync/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          connectionId,
          module,
          type: 'import'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Sincronização iniciada!');
        loadSyncJobs();
      } else {
        toast.error(data.message || 'Erro ao iniciar sincronização');
      }
    } catch (error) {
      console.error('Erro ao iniciar sincronização:', error);
      toast.error('Erro ao iniciar sincronização');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'completed':
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'running':
      case 'testing':
        return 'text-blue-600 bg-blue-100';
      case 'error':
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'disconnected':
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'completed':
      case 'success':
        return <FiCheckCircle className="h-4 w-4" />;
      case 'running':
      case 'testing':
        return <FiRefreshCw className="h-4 w-4 animate-spin" />;
      case 'error':
      case 'failed':
        return <FiXCircle className="h-4 w-4" />;
      case 'disconnected':
      case 'cancelled':
        return <FiPause className="h-4 w-4" />;
      default:
        return <FiClock className="h-4 w-4" />;
    }
  };

  const renderConnections = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Conexões ERP</h3>
          <p className="text-gray-600">Gerencie as conexões com sistemas ERP</p>
        </div>
        {canManageERP && (
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <FiPlus className="h-4 w-4" />
            Nova Conexão
          </button>
        )}
      </div>

      {/* Lista de Conexões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {connections.map((connection) => (
          <div key={connection.id} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FiDatabase className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{connection.name}</h4>
                  <p className="text-sm text-gray-600">{connection.type.toUpperCase()}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(connection.status)}`}>
                {getStatusIcon(connection.status)}
                {connection.status}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Host:</span>
                <span className="font-medium">{connection.host}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Última Sync:</span>
                <span className="font-medium">
                  {new Date(connection.lastSync).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Frequência:</span>
                <span className="font-medium">{connection.syncFrequency} min</span>
              </div>
            </div>

            {connection.lastError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{connection.lastError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => testConnection(connection.id)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                <FiActivity className="h-3 w-3" />
                Testar
              </button>
              {canSyncERP && (
                <button
                  onClick={() => startSync(connection.id, 'funcionarios')}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  <FiRefreshCw className="h-3 w-3" />
                  Sincronizar
                </button>
              )}
              {canManageERP && (
                <>
                  <button className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                    <FiEdit className="h-3 w-3" />
                    Editar
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200">
                    <FiTrash2 className="h-3 w-3" />
                    Excluir
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {connections.length === 0 && (
        <div className="text-center py-12">
          <FiDatabase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma conexão configurada</h3>
          <p className="text-gray-600 mb-4">Configure sua primeira conexão ERP para começar</p>
          {canManageERP && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Criar Primeira Conexão
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderSyncJobs = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Jobs de Sincronização</h3>
          <p className="text-gray-600">Monitore as sincronizações em andamento e históricas</p>
        </div>
        <button
          onClick={loadSyncJobs}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <FiRefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progresso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registros
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duração
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {syncJobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{job.module}</div>
                      <div className="text-sm text-gray-500">{job.type}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                      {job.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{job.progress}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {job.processedRecords}/{job.totalRecords}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {job.startedAt && job.completedAt
                      ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
                      : job.startedAt
                      ? `${Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)}s`
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">
                      <FiEye className="h-4 w-4" />
                    </button>
                    {job.status === 'running' && (
                      <button className="text-red-600 hover:text-red-900">
                        <FiPause className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {syncJobs.length === 0 && (
        <div className="text-center py-12">
          <FiActivity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum job de sincronização</h3>
          <p className="text-gray-600">Os jobs de sincronização aparecerão aqui</p>
        </div>
      )}
    </div>
  );

  if (!canViewERP) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para acessar a integração ERP</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute adminOnly>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Integração ERP</h1>
            <p className="text-gray-600">Gerencie conexões e sincronizações com sistemas ERP</p>
          </div>

          {/* Tabs */}
          <div className="mb-8">
            <nav className="flex space-x-8">
              {[
                { id: 'connections', label: 'Conexões', icon: FiDatabase },
                { id: 'sync', label: 'Sincronização', icon: FiRefreshCw },
                { id: 'metrics', label: 'Métricas', icon: FiBarChart3 },
                { id: 'alerts', label: 'Alertas', icon: FiAlertTriangle }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div>
            {activeTab === 'connections' && renderConnections()}
            {activeTab === 'sync' && renderSyncJobs()}
            {activeTab === 'metrics' && (
              <div className="text-center py-12">
                <FiBarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Métricas em desenvolvimento</h3>
                <p className="text-gray-600">Dashboard de métricas será implementado em breve</p>
              </div>
            )}
            {activeTab === 'alerts' && (
              <div className="text-center py-12">
                <FiAlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sistema de alertas em desenvolvimento</h3>
                <p className="text-gray-600">Alertas e notificações serão implementados em breve</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
