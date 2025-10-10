'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';
import { FiArrowLeft, FiBarChart2, FiClock, FiDownload, FiFileText, FiUsers, FiAlertCircle, FiCheck, FiX } from 'react-icons/fi';
import { ImportLog, ImportStats, getImportStats } from '@/lib/monitoring/importMonitoring';

export default function ImportDashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Carregar estatísticas
  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const importStats = await getImportStats(20);
        setStats(importStats);
        setError(null);
      } catch (err: any) {
        setError(err.message || {t('admin.erroAoCarregarEstatisticas')});
      } finally {
        setIsLoading(false);
      }
    };
    
    loadStats();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Formatar duração
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  // Obter cor de status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'partial': return 'text-yellow-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };
  
  // Obter ícone de status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <FiCheck className="mr-1" />;
      case 'partial': return <FiAlertCircle className="mr-1" />;
      case 'failed': return <FiX className="mr-1" />;
      default: return null;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Importação</h1>
          <p className="mt-1 text-sm text-gray-500">
            Estatísticas e monitoramento de importações de usuários
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Link
            href="/admin/user-management/import"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiArrowLeft className="mr-2 -ml-1 h-5 w-5 text-gray-500" />
            Voltar para Importação
          </Link>
        </div>
      </div>
      
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-md p-6 flex items-center justify-center h-64">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-abz-blue mb-4"></div>
            <p className="text-gray-500">Carregando estatísticas...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-6">
          <div className="flex items-center">
            <FiAlertCircle className="text-red-500 mr-3 h-6 w-6" />
            <h2 className="text-lg font-medium text-red-800">Erro ao carregar estatísticas</h2>
          </div>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            Tentar Novamente
          </button>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-2">
                <FiBarChart2 className="text-abz-blue mr-2 h-6 w-6" />
                <h2 className="text-lg font-medium text-gray-900">Total de Importações</h2>
              </div>
              <p className="text-3xl font-bold text-gray-800">{stats.total_imports}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-2">
                <FiUsers className="text-green-500 mr-2 h-6 w-6" />
                <h2 className="text-lg font-medium text-gray-900">Usuários Importados</h2>
              </div>
              <p className="text-3xl font-bold text-gray-800">{stats.total_users_imported}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-2">
                <FiCheck className="text-yellow-500 mr-2 h-6 w-6" />
                <h2 className="text-lg font-medium text-gray-900">Taxa de Sucesso</h2>
              </div>
              <p className="text-3xl font-bold text-gray-800">{(stats.success_rate * 100).toFixed(1)}%</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-2">
                <FiClock className="text-purple-500 mr-2 h-6 w-6" />
                <h2 className="text-lg font-medium text-gray-900">Tempo Médio</h2>
              </div>
              <p className="text-3xl font-bold text-gray-800">{formatDuration(stats.average_duration_ms)}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-md p-6 md:col-span-2">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Importações Recentes</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data/Hora
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registros
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duração
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.recent_imports.map((log: ImportLog) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.import_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="text-green-600 font-medium">{log.success_count}</span>
                          {log.error_count > 0 && (
                            <span className="text-red-600 font-medium ml-2">{log.error_count}</span>
                          )}
                          {log.skipped_count > 0 && (
                            <span className="text-yellow-600 font-medium ml-2">({log.skipped_count})</span>
                          )}
                          <span className="text-gray-400 ml-1">/ {log.total_records}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDuration(log.duration_ms)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center ${getStatusColor(log.status)}`}>
                            {getStatusIcon(log.status)}
                            {log.status === 'success' ? 'Sucesso' : 
                             log.status === 'partial' ? 'Parcial' : 'Falha'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    
                    {stats.recent_imports.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          Nenhuma importação recente encontrada
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Importações por Tipo</h2>
              
              {Object.keys(stats.imports_by_type).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(stats.imports_by_type)
                    .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-abz-blue h-2.5 rounded-full" 
                            style={{ width: `${(count as number) / stats.total_imports * 100}%` }}
                          ></div>
                        </div>
                        <div className="ml-4 min-w-[100px] flex justify-between">
                          <span className="text-sm font-medium text-gray-700">{type}</span>
                          <span className="text-sm text-gray-500">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Recursos de Monitoramento</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center mb-2">
                  <FiFileText className="text-abz-blue mr-2" />
                  <h3 className="font-medium text-gray-900">Exportar Relatório</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  Exporte um relatório detalhado de todas as importações realizadas.
                </p>
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiDownload className="mr-1" />
                  Exportar CSV
                </button>
              </div>
              
              <div className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center mb-2">
                  <FiBarChart2 className="text-green-500 mr-2" />
                  <h3 className="font-medium text-gray-900">Análise Avançada</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  Visualize estatísticas detalhadas e tendências de importação.
                </p>
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiBarChart2 className="mr-1" />
                  Ver Análise
                </button>
              </div>
              
              <div className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center mb-2">
                  <FiUsers className="text-purple-500 mr-2" />
                  <h3 className="font-medium text-gray-900">Usuários Importados</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  Visualize todos os usuários importados recentemente.
                </p>
                <Link
                  href="/admin/user-management"
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FiUsers className="mr-1" />
                  Ver Usuários
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <FiBarChart2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">Nenhuma estatística disponível</h2>
            <p className="text-gray-500">
              Não há dados de importação disponíveis. Realize uma importação para ver estatísticas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
