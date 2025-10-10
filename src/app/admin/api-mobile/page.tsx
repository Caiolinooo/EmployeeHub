'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiSmartphone, 
  FiKey, 
  FiUsers, 
  FiActivity,
  FiSettings,
  FiRefreshCw,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiCopy,
  FiEye,
  FiEyeOff
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  created_at: string;
  last_used: string | null;
  active: boolean;
}

interface APIStats {
  total_requests: number;
  requests_today: number;
  active_keys: number;
  error_rate: number;
}

export default function APIMobilePage() {
  const { t } = useI18n();
  const { user, isAdmin } = useSupabaseAuth();
  
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [stats, setStats] = useState<APIStats | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [showKeys, setShowKeys] = useState<{[key: string]: boolean}>({});

  const availablePermissions = [
    { id: 'users.read', name: {t('admin.lerUsuarios')} },
    { id: 'users.write', name: {t('admin.escreverUsuarios')} },
    { id: 'reimbursements.read', name: 'Ler Reembolsos' },
    { id: 'reimbursements.write', name: 'Escrever Reembolsos' },
    { id: 'evaluations.read', name: {t('admin.lerAvaliacoes')} },
    { id: 'evaluations.write', name: {t('admin.escreverAvaliacoes')} },
    { id: 'notifications.read', name: {t('admin.lerNotificacoes')} },
    { id: 'notifications.write', name: {t('admin.escreverNotificacoes')} },
  ];

  useEffect(() => {
    if (isAdmin) {
      loadAPIData();
    }
  }, [isAdmin]);

  const loadAPIData = async () => {
    try {
      setLoading(true);
      
      // Simular carregamento de dados da API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Dados simulados
      setApiKeys([
        {
          id: '1',
          name: 'App Mobile Principal',
          key: 'abz_mobile_' + Math.random().toString(36).substring(2, 15),
          permissions: ['users.read', 'reimbursements.read', 'reimbursements.write'],
          created_at: '2024-01-15T10:00:00Z',
          last_used: '2024-01-20T14:30:00Z',
          active: true
        },
        {
          id: '2',
          name: 'App Teste',
          key: 'abz_test_' + Math.random().toString(36).substring(2, 15),
          permissions: ['users.read'],
          created_at: '2024-01-10T09:00:00Z',
          last_used: null,
          active: false
        }
      ]);

      setStats({
        total_requests: 15420,
        requests_today: 234,
        active_keys: 1,
        error_rate: 2.1
      });

    } catch (error) {
      console.error('Erro ao carregar dados da API:', error);
      toast.error('Erro ao carregar dados da API');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error(t('admin.nomeDaChaveEObrigatorio'));
      return;
    }

    if (selectedPermissions.length === 0) {
      toast.error(t('admin.selecionePeloMenosUmaPermissao'));
      return;
    }

    try {
      const newKey: APIKey = {
        id: Date.now().toString(),
        name: newKeyName,
        key: 'abz_' + Math.random().toString(36).substring(2, 15),
        permissions: selectedPermissions,
        created_at: new Date().toISOString(),
        last_used: null,
        active: true
      };

      setApiKeys([...apiKeys, newKey]);
      setNewKeyName('');
      setSelectedPermissions([]);
      setShowCreateForm(false);
      toast.success('Chave API criada com sucesso');
    } catch (error) {
      console.error('Erro ao criar chave:', error);
      toast.error('Erro ao criar chave API');
    }
  };

  const toggleKeyStatus = async (keyId: string) => {
    try {
      setApiKeys(apiKeys.map(key => 
        key.id === keyId ? { ...key, active: !key.active } : key
      ));
      toast.success('Status da chave atualizado');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status da chave');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('admin.chaveCopiadaParaAAreaDeTransferencia'));
  };

  const toggleShowKey = (keyId: string) => {
    setShowKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
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
            Apenas administradores podem acessar o gerenciamento da API Mobile.
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
                <FiSmartphone className="mr-3 text-blue-600" />
                API Mobile
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Gerencie chaves de API e permissões para aplicações móveis
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={loadAPIData}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiRefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </button>
              
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
              >
                <FiKey className="mr-2 h-4 w-4" />
                Nova Chave API
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiActivity className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total de Requisições</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_requests.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiActivity className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Requisições Hoje</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.requests_today}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiKey className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Chaves Ativas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active_keys}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiAlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Taxa de Erro</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.error_rate}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FiRefreshCw className="animate-spin h-8 w-8 text-blue-600 mr-3" />
            <span className="text-lg text-gray-600">Carregando...</span>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Chaves API</h3>
              <p className="mt-1 text-sm text-gray-600">
                Gerencie as chaves de acesso para aplicações móveis
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
                      Chave
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Permissões
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Último Uso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {apiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {key.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {showKeys[key.id] ? key.key : '••••••••••••••••'}
                          </code>
                          <button
                            onClick={() => toggleShowKey(key.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {showKeys[key.id] ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(key.key)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <FiCopy className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          {key.permissions.map((permission) => (
                            <span
                              key={permission}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {permission}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {key.last_used ? new Date(key.last_used).toLocaleDateString('pt-BR') : 'Nunca'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          key.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {key.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => toggleKeyStatus(key.id)}
                          className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                            key.active
                              ? 'text-red-700 bg-red-100 hover:bg-red-200'
                              : 'text-green-700 bg-green-100 hover:bg-green-200'
                          }`}
                        >
                          {key.active ? <FiX className="mr-1 h-4 w-4" /> : <FiCheck className="mr-1 h-4 w-4" />}
                          {key.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Criação de Chave */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Nova Chave API</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Chave
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: App Mobile Principal"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissões
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {availablePermissions.map((permission) => (
                    <label key={permission.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions([...selectedPermissions, permission.id]);
                          } else {
                            setSelectedPermissions(selectedPermissions.filter(p => p !== permission.id));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{permission.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateKey}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Criar Chave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
