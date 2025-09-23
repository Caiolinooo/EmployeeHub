'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'react-hot-toast';
import {
  FiPlay,
  FiPause,
  FiStop,
  FiEdit,
  FiTrash2,
  FiCopy,
  FiPlus,
  FiSettings,
  FiActivity,
  FiClock,
  FiUsers,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiEye,
  FiDownload,
  FiUpload,
  FiGitBranch,
  FiZap,
  FiTarget,
  FiBarChart,
  FiCalendar,
  FiMail,
  FiDatabase,
  FiCode,
  FiLink
} from 'react-icons/fi';
import { Workflow, WorkflowExecution, WorkflowTemplate, WorkflowStatistics } from '@/types/workflows';

export default function WorkflowsPage() {
  const { user, isAdmin, isManager } = useSupabaseAuth();
  const { t } = useI18n();
  
  const [activeTab, setActiveTab] = useState('workflows');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDesigner, setShowDesigner] = useState(false);

  // Verificar permissões (simplificado para funcionar)
  const canViewWorkflows = isAdmin || isManager;
  const canCreateWorkflows = isAdmin || isManager;
  const canManageWorkflows = isAdmin;

  useEffect(() => {
    if (canViewWorkflows) {
      loadData();
    }
  }, [canViewWorkflows]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadWorkflows(),
        loadExecutions(),
        loadTemplates()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados dos workflows');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Erro ao carregar workflows:', error);
    }
  };

  const loadExecutions = async () => {
    try {
      const response = await fetch('/api/workflows/executions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions || []);
      }
    } catch (error) {
      console.error('Erro ao carregar execuções:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/workflows/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  };

  const createWorkflow = async () => {
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: 'Novo Workflow',
          description: 'Workflow criado automaticamente',
          category: 'custom',
          version: '1.0.0',
          status: 'draft',
          trigger: {
            id: 'trigger-1',
            type: 'manual',
            name: 'Trigger Manual',
            config: {},
            isActive: true
          },
          steps: [],
          variables: [],
          settings: {
            maxExecutionTime: 3600,
            maxConcurrentExecutions: 1,
            enableLogging: true,
            logLevel: 'info',
            enableNotifications: true,
            notificationRecipients: [user?.email || ''],
            enableMetrics: true,
            autoCleanupLogs: true,
            logRetentionDays: 30
          },
          permissions: {
            owner: user?.id || '',
            viewers: [],
            editors: [],
            executors: [],
            roles: {},
            departments: {},
            isPublic: false
          },
          tags: [],
          isTemplate: false
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Workflow criado com sucesso!');
        loadWorkflows();
      } else {
        toast.error(data.message || 'Erro ao criar workflow');
      }
    } catch (error) {
      console.error('Erro ao criar workflow:', error);
      toast.error('Erro ao criar workflow');
    }
  };

  const executeWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Workflow executado com sucesso!');
        loadExecutions();
      } else {
        toast.error(data.message || 'Erro ao executar workflow');
      }
    } catch (error) {
      console.error('Erro ao executar workflow:', error);
      toast.error('Erro ao executar workflow');
    }
  };

  const duplicateWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Workflow duplicado com sucesso!');
        loadWorkflows();
      } else {
        toast.error(data.message || 'Erro ao duplicar workflow');
      }
    } catch (error) {
      console.error('Erro ao duplicar workflow:', error);
      toast.error('Erro ao duplicar workflow');
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm('Tem certeza que deseja excluir este workflow?')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Workflow excluído com sucesso!');
        loadWorkflows();
      } else {
        toast.error(data.message || 'Erro ao excluir workflow');
      }
    } catch (error) {
      console.error('Erro ao excluir workflow:', error);
      toast.error('Erro ao excluir workflow');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'running':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
      case 'inactive':
        return 'text-red-600 bg-red-100';
      case 'draft':
      case 'paused':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
        return <FiCheckCircle className="h-4 w-4" />;
      case 'running':
        return <FiRefreshCw className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <FiXCircle className="h-4 w-4" />;
      case 'inactive':
        return <FiPause className="h-4 w-4" />;
      case 'draft':
        return <FiEdit className="h-4 w-4" />;
      default:
        return <FiClock className="h-4 w-4" />;
    }
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'manual':
        return <FiPlay className="h-4 w-4" />;
      case 'schedule':
        return <FiCalendar className="h-4 w-4" />;
      case 'webhook':
        return <FiLink className="h-4 w-4" />;
      case 'email':
        return <FiMail className="h-4 w-4" />;
      case 'database':
        return <FiDatabase className="h-4 w-4" />;
      case 'api':
        return <FiCode className="h-4 w-4" />;
      default:
        return <FiZap className="h-4 w-4" />;
    }
  };

  const renderWorkflowList = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Meus Workflows</h3>
          <p className="text-gray-600">Gerencie e execute seus workflows automatizados</p>
        </div>
        {canCreateWorkflows && (
          <div className="flex gap-2">
            <button
              onClick={createWorkflow}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiPlus className="h-4 w-4" />
              Novo Workflow
            </button>
            <button
              onClick={() => setShowDesigner(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <FiGitBranch className="h-4 w-4" />
              Designer Visual
            </button>
          </div>
        )}
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FiGitBranch className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{workflow.name}</h4>
                  <p className="text-sm text-gray-600">{workflow.category}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}>
                {getStatusIcon(workflow.status)}
                {workflow.status}
              </div>
            </div>

            {workflow.description && (
              <p className="text-sm text-gray-600 mb-4">{workflow.description}</p>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Trigger:</span>
                <div className="flex items-center gap-1">
                  {getTriggerIcon(workflow.trigger.type)}
                  <span className="font-medium">{workflow.trigger.type}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Steps:</span>
                <span className="font-medium">{workflow.steps.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Execuções:</span>
                <span className="font-medium">{workflow.statistics.totalExecutions}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Última execução:</span>
                <span className="font-medium">
                  {workflow.lastExecuted 
                    ? new Date(workflow.lastExecuted).toLocaleDateString()
                    : 'Nunca'
                  }
                </span>
              </div>
            </div>

            {workflow.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {workflow.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {tag}
                  </span>
                ))}
                {workflow.tags.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    +{workflow.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => executeWorkflow(workflow.id)}
                disabled={workflow.status !== 'active'}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
              >
                <FiPlay className="h-3 w-3" />
                Executar
              </button>
              <button
                onClick={() => setSelectedWorkflow(workflow)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <FiEye className="h-3 w-3" />
                Visualizar
              </button>
              {canCreateWorkflows && (
                <button
                  onClick={() => duplicateWorkflow(workflow.id)}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  <FiCopy className="h-3 w-3" />
                  Duplicar
                </button>
              )}
              {canManageWorkflows && (
                <button
                  onClick={() => deleteWorkflow(workflow.id)}
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

      {workflows.length === 0 && (
        <div className="text-center py-12">
          <FiGitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum workflow encontrado</h3>
          <p className="text-gray-600 mb-4">Crie seu primeiro workflow para começar a automatizar processos</p>
          {canCreateWorkflows && (
            <button
              onClick={createWorkflow}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Criar Primeiro Workflow
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderExecutions = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Execuções</h3>
          <p className="text-gray-600">Monitore as execuções dos workflows</p>
        </div>
        <button
          onClick={loadExecutions}
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
                  Workflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duração
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Iniciado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Executado por
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {workflows.find(w => w.id === execution.workflowId)?.name || 'Workflow'}
                    </div>
                    <div className="text-sm text-gray-500">ID: {execution.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                      {getStatusIcon(execution.status)}
                      {execution.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.duration ? `${Math.round(execution.duration / 1000)}s` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(execution.startTime).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.triggeredBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">
                      <FiEye className="h-4 w-4" />
                    </button>
                    <button className="text-gray-600 hover:text-gray-900">
                      <FiDownload className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {executions.length === 0 && (
        <div className="text-center py-12">
          <FiActivity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma execução encontrada</h3>
          <p className="text-gray-600">As execuções dos workflows aparecerão aqui</p>
        </div>
      )}
    </div>
  );

  if (!canViewWorkflows) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para acessar os workflows</p>
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workflows Automatizados</h1>
          <p className="text-gray-600">Automatize processos empresariais com workflows inteligentes</p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'workflows', label: 'Workflows', icon: FiGitBranch },
              { id: 'executions', label: 'Execuções', icon: FiActivity },
              { id: 'templates', label: 'Templates', icon: FiTarget },
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
          {activeTab === 'workflows' && renderWorkflowList()}
          {activeTab === 'executions' && renderExecutions()}
          {activeTab === 'templates' && (
            <div className="text-center py-12">
              <FiTarget className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Templates em desenvolvimento</h3>
              <p className="text-gray-600">Galeria de templates será implementada em breve</p>
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
      </div>
    </div>
  );
}
