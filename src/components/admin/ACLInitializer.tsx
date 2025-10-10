'use client';

import React, { useState } from 'react';
import { FiSettings, FiCheck, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface ACLStatus {
  permissions_count: number;
  permissions: Array<{
    id: string;
    name: string;
    resource: string;
    action: string;
  }>;
  role_permissions_count: number;
  role_stats: Record<string, number>;
  initialized: boolean;
}

const ACLInitializer: React.FC = () => {
  const [status, setStatus] = useState<ACLStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Verificar status do sistema ACL
  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/acl/init');
      const data = await response.json();

      if (response.ok) {
        setStatus(data);
      } else {
        setError(data.error || 'Erro ao verificar status ACL');
      }
    } catch (err) {
      setError('Erro ao conectar com a API');
    } finally {
      setLoading(false);
    }
  };

  // Inicializar sistema ACL
  const initializeACL = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/acl/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        // Recarregar status após inicialização
        setTimeout(() => {
          checkStatus();
        }, 1000);
      } else {
        setError(data.error || 'Erro ao inicializar sistema ACL');
      }
    } catch (err) {
      setError('Erro ao conectar com a API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FiSettings className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Sistema ACL</h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={checkStatus}
            disabled={loading}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-1"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Verificar Status</span>
          </button>
          <button
            onClick={initializeACL}
            disabled={loading}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Inicializando...' : 'Inicializar ACL'}
          </button>
        </div>
      </div>

      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <FiAlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
          <FiCheck className="w-4 h-4 text-green-600" />
          <span className="text-green-700 text-sm">{success}</span>
        </div>
      )}

      {/* Status do sistema */}
      {status && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{status.permissions_count}</div>
              <div className="text-sm text-gray-600">Permissões Criadas</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{status.role_permissions_count}</div>
              <div className="text-sm text-gray-600">Atribuições de Role</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className={`text-2xl font-bold ${status.initialized ? 'text-green-600' : 'text-red-600'}`}>
                {status.initialized ? 'SIM' : t('components.nao')}
              </div>
              <div className="text-sm text-gray-600">Sistema Inicializado</div>
            </div>
          </div>

          {/* Estatísticas por role */}
          {Object.keys(status.role_stats).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Permissões por Role:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {Object.entries(status.role_stats).map(([role, count]) => (
                  <div key={role} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">{role}</span>
                    <span className="text-sm text-gray-600">{count} permissões</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de permissões */}
          {status.permissions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Permissões Disponíveis:</h3>
              <div className="max-h-40 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {status.permissions.map((permission) => (
                    <div key={permission.id} className="text-xs p-2 bg-gray-50 rounded">
                      <div className="font-medium text-gray-800">{permission.name}</div>
                      <div className="text-gray-600">{permission.resource}.{permission.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instruções */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-1">Instruções:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>1. Clique em "Verificar Status" para ver o estado atual do sistema ACL</li>
          <li>2. Se o sistema não estiver inicializado, clique em "Inicializar ACL"</li>
          <li>3. Isso criará as permissões básicas e as atribuirá aos roles (ADMIN, MANAGER, USER)</li>
          <li>4. Após a inicialização, as permissões serão aplicadas automaticamente</li>
        </ul>
      </div>
    </div>
  );
};

export default ACLInitializer;
