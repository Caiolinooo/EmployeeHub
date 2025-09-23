'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/contexts/I18nContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
  FiSmartphone, 
  FiUsers, 
  FiActivity, 
  FiUpload, 
  FiBell, 
  FiSettings,
  FiBarChart3,
  FiAlertTriangle,
  FiRefreshCw,
  FiDownload
} from 'react-icons/fi';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MobileStats {
  devices: {
    total: number;
    active: number;
    ios: number;
    android: number;
  };
  users: {
    total: number;
    active24h: number;
    active7d: number;
    newToday: number;
  };
  sync: {
    totalSyncs24h: number;
    avgSyncTime: number;
    failedSyncs: number;
    conflictsResolved: number;
  };
  notifications: {
    sent24h: number;
    delivered24h: number;
    failed24h: number;
    deliveryRate: number;
  };
  api: {
    requests24h: number;
    avgResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  };
}

export default function APIMobilePage() {
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<MobileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/mobile/health', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const exportData = async (type: string) => {
    try {
      const response = await fetch(`/api/mobile/export?type=${type}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mobile-${type}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Dispositivos Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.devices.active || 0}</p>
              <p className="text-xs text-gray-500">de {stats?.devices.total || 0} total</p>
            </div>
            <FiSmartphone className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Usuários Ativos (24h)</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.users.active24h || 0}</p>
              <p className="text-xs text-gray-500">{stats?.users.newToday || 0} novos hoje</p>
            </div>
            <FiUsers className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sincronizações (24h)</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.sync.totalSyncs24h || 0}</p>
              <p className="text-xs text-gray-500">{stats?.sync.failedSyncs || 0} falharam</p>
            </div>
            <FiRefreshCw className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taxa de Entrega Push</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.notifications.deliveryRate.toFixed(1) || 0}%</p>
              <p className="text-xs text-gray-500">{stats?.notifications.sent24h || 0} enviadas</p>
            </div>
            <FiBell className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Dispositivos */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição de Dispositivos</h3>
          <div className="h-64">
            <Doughnut
              data={{
                labels: ['iOS', 'Android'],
                datasets: [{
                  data: [stats?.devices.ios || 0, stats?.devices.android || 0],
                  backgroundColor: ['#3B82F6', '#10B981'],
                  borderWidth: 0
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Performance da API */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance da API</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Requisições (24h)</span>
              <span className="font-semibold">{stats?.api.requests24h || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Tempo Médio de Resposta</span>
              <span className="font-semibold">{stats?.api.avgResponseTime || 0}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Taxa de Erro</span>
              <span className={`font-semibold ${(stats?.api.errorRate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                {stats?.api.errorRate.toFixed(2) || 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Endpoints */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Endpoints Mais Utilizados</h3>
        <div className="space-y-2">
          {stats?.api.topEndpoints.map((endpoint, index) => (
            <div key={index} className="flex justify-between items-center py-2">
              <span className="text-sm font-mono text-gray-700">{endpoint.endpoint}</span>
              <span className="text-sm font-semibold text-gray-900">{endpoint.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDevices = () => (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Dispositivos Móveis</h3>
          <button
            onClick={() => exportData('devices')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiDownload className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600">Lista de dispositivos será implementada aqui...</p>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Notificações Push</h3>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Enviar Notificação
          </button>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600">Painel de notificações será implementado aqui...</p>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurações da API Mobile</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">Modo de Manutenção</p>
              <p className="text-sm text-gray-600">Desabilita temporariamente a API mobile</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">Forçar Atualização</p>
              <p className="text-sm text-gray-600">Obriga usuários a atualizarem o app</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Limiting</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Requisições por Minuto (Auth)
            </label>
            <input
              type="number"
              defaultValue={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Requisições por Minuto (Sync)
            </label>
            <input
              type="number"
              defaultValue={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">API Mobile</h1>
                <p className="text-gray-600">Gerenciamento e monitoramento da API mobile</p>
              </div>
              <button
                onClick={loadStats}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-8">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Visão Geral', icon: FiBarChart3 },
                { id: 'devices', label: 'Dispositivos', icon: FiSmartphone },
                { id: 'notifications', label: 'Notificações', icon: FiBell },
                { id: 'settings', label: 'Configurações', icon: FiSettings }
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
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'devices' && renderDevices()}
            {activeTab === 'notifications' && renderNotifications()}
            {activeTab === 'settings' && renderSettings()}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
