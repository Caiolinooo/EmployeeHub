'use client';

import React, { useState, useEffect } from 'react';
import { FiDatabase, FiCheck, FiAlertTriangle, FiRefreshCw, FiCopy } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface RolePermissionsStatus {
  exists: boolean;
  roles_count: number;
  roles: Array<{
    role: string;
    modules: Record<string, boolean>;
    features: Record<string, boolean>;
    created_at: string;
  }>;
  error?: string;
  message?: string;
  sql_script?: string;
}

const RolePermissionsInitializer: React.FC = () => {
  const { t } = useI18n();
  const [status, setStatus] = useState<RolePermissionsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSQL, setShowSQL] = useState(false);

  // Verificar status da tabela
  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/init-role-permissions');
      const data = await response.json();

      setStatus(data);
      
      if (!data.exists) {
        setError(data.message || t('components.tabelaRolepermissionsNaoExiste'));
      }
    } catch (err) {
      setError('Erro ao conectar com a API');
    } finally {
      setLoading(false);
    }
  };

  // Inicializar tabela
  const initializeTable = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/init-role-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        if (data.already_exists) {
          setSuccess(t('components.tabelaRolepermissionsJaExisteEEstaFuncionando'));
        } else {
          setSuccess(data.message);
        }
        // Recarregar status após inicialização
        setTimeout(() => {
          checkStatus();
        }, 1000);
      } else {
        setError(data.error || 'Erro ao inicializar tabela');
        if (data.sql_script) {
          setStatus(data);
          setShowSQL(true);
        }
      }
    } catch (err) {
      setError('Erro ao conectar com a API');
    } finally {
      setLoading(false);
    }
  };

  // Copiar SQL para clipboard
  const copySQL = async () => {
    if (status?.sql_script) {
      try {
        await navigator.clipboard.writeText(status.sql_script);
        setSuccess(t('components.sqlCopiadoParaAAreaDeTransferencia'));
      } catch (err) {
        setError('Erro ao copiar SQL');
      }
    }
  };

  // Verificar status ao carregar
  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FiDatabase className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Tabela Role Permissions</h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={checkStatus}
            disabled={loading}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-1"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Verificar</span>
          </button>
          <button
            onClick={initializeTable}
            disabled={loading}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Inicializando...' : 'Criar Tabela'}
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

      {/* Status da tabela */}
      {status && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className={`text-2xl font-bold ${status.exists ? 'text-green-600' : 'text-red-600'}`}>
                {status.exists ? 'EXISTE' : t('components.naoExiste')}
              </div>
              <div className="text-sm text-gray-600">Status da Tabela</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{status.roles_count || 0}</div>
              <div className="text-sm text-gray-600">Roles Configurados</div>
            </div>
          </div>

          {/* Lista de roles */}
          {status.exists && status.roles && status.roles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Roles Configurados:</h3>
              <div className="space-y-2">
                {status.roles.map((role) => (
                  <div key={role.role} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-800">{role.role}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(role.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      <div>Módulos: {Object.keys(role.modules).length}</div>
                      <div>Features: {Object.keys(role.features).length}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Script SQL para execução manual */}
          {showSQL && status.sql_script && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">Execute este SQL no Supabase:</h3>
                <button
                  onClick={copySQL}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center space-x-1"
                >
                  <FiCopy className="w-3 h-3" />
                  <span>Copiar</span>
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-60">
                {status.sql_script}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Instruções */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-1">Instruções:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>1. Clique em "Verificar" para ver se a tabela role_permissions existe</li>
          <li>2. Se não existir, clique em "Criar Tabela" para tentar criar automaticamente</li>
          <li>3. Se a criação automática falhar, copie o SQL e execute no Supabase SQL Editor</li>
          <li>4. Após criar a tabela, as permissões de role funcionarão corretamente</li>
        </ul>
      </div>
    </div>
  );
};

export default RolePermissionsInitializer;
