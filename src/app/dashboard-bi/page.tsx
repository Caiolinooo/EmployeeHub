'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'react-hot-toast';
import {
  FiBarChart,
  FiPieChart,
  FiTrendingUp,
  FiGrid,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiShare2,
  FiDownload,
  FiRefreshCw,
  FiSettings,
  FiEye,
  FiCopy,
  FiStar,
  FiFilter,
  FiMaximize2,
  FiMinimize2,
  FiAlertTriangle,
  FiUsers,
  FiClock,
  FiActivity
} from 'react-icons/fi';
import { BIDashboard, BIWidget, DashboardFilter, BIMetrics } from '@/types/dashboard-bi';

export default function DashboardBIPage() {
  const { user, isAdmin, isManager } = useSupabaseAuth();
  const { t } = useI18n();
  
  const [activeTab, setActiveTab] = useState('dashboards');
  const [dashboards, setDashboards] = useState<BIDashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<BIDashboard | null>(null);
  const [widgets, setWidgets] = useState<BIWidget[]>([]);
  const [filters, setFilters] = useState<DashboardFilter[]>([]);
  const [metrics, setMetrics] = useState<BIMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // Verificar permissões (simplificado para funcionar)
  const canViewBI = isAdmin || isManager;
  const canCreateBI = isAdmin || isManager;
  const canManageBI = isAdmin;

  useEffect(() => {
    if (canViewBI) {
      loadData();
    }
  }, [canViewBI]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadDashboards(),
        loadMetrics()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do BI');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboards = async () => {
    try {
      const response = await fetch('/api/dashboard-bi/dashboards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDashboards(data.dashboards || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboards:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/dashboard-bi/metrics', {
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

  const loadDashboardDetails = async (dashboardId: string) => {
    try {
      const response = await fetch(`/api/dashboard-bi/dashboards/${dashboardId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedDashboard(data.dashboard);
        setWidgets(data.dashboard.widgets || []);
        setFilters(data.dashboard.filters || []);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do dashboard:', error);
      toast.error('Erro ao carregar dashboard');
    }
  };

  const createDashboard = async () => {
    try {
      const response = await fetch('/api/dashboard-bi/dashboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: 'Novo Dashboard',
          description: 'Dashboard criado automaticamente',
          layout: {
            type: 'grid',
            columns: 12,
            rows: 8,
            gap: 16,
            responsive: true,
            breakpoints: {
              mobile: 768,
              tablet: 1024,
              desktop: 1200
            }
          },
          widgets: [],
          filters: [],
          permissions: {
            owner: user?.id,
            viewers: [],
            editors: [],
            public: false,
            roles: {},
            departments: {}
          },
          isPublic: false,
          isTemplate: false,
          tags: [],
          category: 'custom',
          autoRefresh: false
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Dashboard criado com sucesso!');
        loadDashboards();
      } else {
        toast.error(data.message || 'Erro ao criar dashboard');
      }
    } catch (error) {
      console.error('Erro ao criar dashboard:', error);
      toast.error('Erro ao criar dashboard');
    }
  };

  const duplicateDashboard = async (dashboardId: string) => {
    try {
      const response = await fetch(`/api/dashboard-bi/dashboards/${dashboardId}/duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Dashboard duplicado com sucesso!');
        loadDashboards();
      } else {
        toast.error(data.message || 'Erro ao duplicar dashboard');
      }
    } catch (error) {
      console.error('Erro ao duplicar dashboard:', error);
      toast.error('Erro ao duplicar dashboard');
    }
  };

  const deleteDashboard = async (dashboardId: string) => {
    if (!confirm('Tem certeza que deseja excluir este dashboard?')) {
      return;
    }

    try {
      const response = await fetch(`/api/dashboard-bi/dashboards/${dashboardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Dashboard excluído com sucesso!');
        loadDashboards();
        if (selectedDashboard?.id === dashboardId) {
          setSelectedDashboard(null);
        }
      } else {
        toast.error(data.message || 'Erro ao excluir dashboard');
      }
    } catch (error) {
      console.error('Erro ao excluir dashboard:', error);
      toast.error('Erro ao excluir dashboard');
    }
  };

  const exportDashboard = async (dashboardId: string, format: 'pdf' | 'png' | 'excel') => {
    try {
      const response = await fetch(`/api/dashboard-bi/dashboards/${dashboardId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          format,
          options: {
            includeFilters: true,
            includeData: true,
            pageSize: 'A4',
            orientation: 'landscape',
            quality: 'high'
          }
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-${dashboardId}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Dashboard exportado com sucesso!');
      } else {
        toast.error('Erro ao exportar dashboard');
      }
    } catch (error) {
      console.error('Erro ao exportar dashboard:', error);
      toast.error('Erro ao exportar dashboard');
    }
  };

  const renderDashboardList = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Meus Dashboards</h3>
          <p className="text-gray-600">Gerencie e visualize seus dashboards de BI</p>
        </div>
        {canCreateBI && (
          <button
            onClick={createDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiPlus className="h-4 w-4" />
            Novo Dashboard
          </button>
        )}
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboards.map((dashboard) => (
          <div key={dashboard.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FiBarChart className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{dashboard.name}</h4>
                  <p className="text-sm text-gray-600">{dashboard.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {dashboard.isPublic && (
                  <div className="p-1 bg-green-100 rounded">
                    <FiUsers className="h-3 w-3 text-green-600" />
                  </div>
                )}
                {dashboard.autoRefresh && (
                  <div className="p-1 bg-blue-100 rounded">
                    <FiRefreshCw className="h-3 w-3 text-blue-600" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Widgets:</span>
                <span className="font-medium">{dashboard.widgets.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Acessos:</span>
                <span className="font-medium">{dashboard.accessCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Atualizado:</span>
                <span className="font-medium">
                  {new Date(dashboard.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {dashboard.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {dashboard.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {tag}
                  </span>
                ))}
                {dashboard.tags.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    +{dashboard.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => loadDashboardDetails(dashboard.id)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <FiEye className="h-3 w-3" />
                Visualizar
              </button>
              {canCreateBI && (
                <button
                  onClick={() => duplicateDashboard(dashboard.id)}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  <FiCopy className="h-3 w-3" />
                  Duplicar
                </button>
              )}
              {canManageBI && (
                <button
                  onClick={() => deleteDashboard(dashboard.id)}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  <FiTrash2 className="h-3 w-3" />
                  Excluir
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {dashboards.length === 0 && (
        <div className="text-center py-12">
          <FiBarChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum dashboard encontrado</h3>
          <p className="text-gray-600 mb-4">Crie seu primeiro dashboard para começar</p>
          {canCreateBI && (
            <button
              onClick={createDashboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Criar Primeiro Dashboard
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderDashboardViewer = () => {
    if (!selectedDashboard) {
      return (
        <div className="text-center py-12">
          <FiBarChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione um dashboard</h3>
          <p className="text-gray-600">Escolha um dashboard da lista para visualizar</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{selectedDashboard.name}</h2>
            {selectedDashboard.description && (
              <p className="text-gray-600 mt-1">{selectedDashboard.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <FiFilter className="h-4 w-4" />
              Filtros
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {isFullscreen ? <FiMinimize2 className="h-4 w-4" /> : <FiMaximize2 className="h-4 w-4" />}
              {isFullscreen ? 'Sair' : 'Tela Cheia'}
            </button>
            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    exportDashboard(selectedDashboard.id, e.target.value as 'pdf' | 'png' | 'excel');
                    e.target.value = '';
                  }
                }}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <option value="">Exportar</option>
                <option value="pdf">PDF</option>
                <option value="png">PNG</option>
                <option value="excel">Excel</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && filters.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h4 className="font-medium text-gray-900 mb-3">Filtros</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filters.map((filter) => (
                <div key={filter.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {filter.name}
                  </label>
                  {filter.type === 'dropdown' && (
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                      <option value="">Selecione...</option>
                      {filter.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {filter.type === 'daterange' && (
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  )}
                  {filter.type === 'input' && (
                    <input
                      type="text"
                      placeholder="Digite..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className="bg-white rounded-lg shadow-sm border p-6"
              style={{
                gridColumn: `span ${Math.min(widget.size.width, 3)}`,
                gridRow: `span ${Math.min(widget.size.height, 2)}`
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">{widget.title}</h4>
                  {widget.description && (
                    <p className="text-sm text-gray-600">{widget.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <FiRefreshCw className="h-4 w-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <FiSettings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Widget Content Placeholder */}
              <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                {widget.type === 'chart' && <FiBarChart className="h-8 w-8 text-gray-400" />}
                {widget.type === 'kpi' && <FiTrendingUp className="h-8 w-8 text-gray-400" />}
                {widget.type === 'table' && <FiGrid className="h-8 w-8 text-gray-400" />}
                <div className="ml-2 text-gray-500">
                  {widget.type.toUpperCase()} Widget
                </div>
              </div>

              {widget.lastUpdated && (
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <FiClock className="h-3 w-3" />
                  Atualizado: {new Date(widget.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>

        {widgets.length === 0 && (
          <div className="text-center py-12">
            <FiGrid className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Dashboard vazio</h3>
            <p className="text-gray-600">Este dashboard não possui widgets configurados</p>
          </div>
        )}
      </div>
    );
  };

  if (!canViewBI) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para acessar o Dashboard de BI</p>
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
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} bg-gray-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de BI</h1>
          <p className="text-gray-600">Analytics avançados e visualizações interativas</p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboards', label: 'Dashboards', icon: FiBarChart },
              { id: 'templates', label: 'Templates', icon: FiStar },
              { id: 'metrics', label: 'Métricas', icon: FiActivity },
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
          {activeTab === 'dashboards' && (selectedDashboard ? renderDashboardViewer() : renderDashboardList())}
          {activeTab === 'templates' && (
            <div className="text-center py-12">
              <FiStar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Templates em desenvolvimento</h3>
              <p className="text-gray-600">Galeria de templates será implementada em breve</p>
            </div>
          )}
          {activeTab === 'metrics' && (
            <div className="text-center py-12">
              <FiActivity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Métricas em desenvolvimento</h3>
              <p className="text-gray-600">Analytics de uso serão implementados em breve</p>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="text-center py-12">
              <FiSettings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Configurações em desenvolvimento</h3>
              <p className="text-gray-600">Configurações avançadas serão implementadas em breve</p>
            </div>
          )}
        </div>

        {/* Back Button */}
        {selectedDashboard && (
          <div className="fixed bottom-6 left-6">
            <button
              onClick={() => setSelectedDashboard(null)}
              className="flex items-center gap-2 px-4 py-2 bg-white shadow-lg rounded-lg hover:shadow-xl transition-shadow"
            >
              <FiBarChart className="h-4 w-4" />
              Voltar aos Dashboards
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
