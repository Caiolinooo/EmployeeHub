'use client';

import React, { useState } from 'react';
import { 
  FiDownload, 
  FiEye, 
  FiRefreshCw, 
  FiTrash2, 
  FiCalendar,
  FiFileText,
  FiUser,
  FiClock
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { HistoricoRelatorio } from '@/types/relatorios-pdf';

interface HistoricoRelatoriosProps {
  historico: HistoricoRelatorio[];
  onDownload: (relatorio: HistoricoRelatorio) => void;
  onRegenerate: (relatorio: HistoricoRelatorio) => void;
}

export default function HistoricoRelatorios({ historico, onDownload, onRegenerate }: HistoricoRelatoriosProps) {
  const { t } = useI18n();
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [ordenacao, setOrdenacao] = useState<{ campo: string; direcao: 'asc' | 'desc' }>({
    campo: 'gerado_em',
    direcao: 'desc'
  });

  const historicoFiltrado = historico
    .filter(item => !filtroStatus || item.status === filtroStatus)
    .sort((a, b) => {
      const valorA = a[ordenacao.campo as keyof HistoricoRelatorio];
      const valorB = b[ordenacao.campo as keyof HistoricoRelatorio];
      
      if (ordenacao.direcao === 'asc') {
        return valorA > valorB ? 1 : -1;
      } else {
        return valorA < valorB ? 1 : -1;
      }
    });

  const formatarTamanhoArquivo = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo':
        return 'bg-green-100 text-green-800';
      case 'arquivado':
        return 'bg-yellow-100 text-yellow-800';
      case 'expirado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleOrdenacao = (campo: string) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <div className="space-y-6">
      {/* Filtros e Controles */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">{t('relatorios.todos_status', 'Todos os status')}</option>
              <option value="ativo">{t('relatorios.ativo', 'Ativo')}</option>
              <option value="arquivado">{t('relatorios.arquivado', 'Arquivado')}</option>
              <option value="expirado">{t('relatorios.expirado', 'Expirado')}</option>
            </select>
          </div>
          
          <div className="text-sm text-gray-500">
            {historicoFiltrado.length} relatório(s) encontrado(s)
          </div>
        </div>
      </div>

      {/* Tabela de Histórico */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('configuracao_nome')}
                >
                  <div className="flex items-center">
                    <FiFileText className="mr-1 h-4 w-4" />
                    {t('relatorios.relatorio', 'Relatório')}
                  </div>
                </th>
                
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('gerado_em')}
                >
                  <div className="flex items-center">
                    <FiCalendar className="mr-1 h-4 w-4" />
                    {t('relatorios.gerado_em', 'Gerado em')}
                  </div>
                </th>
                
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('gerado_por')}
                >
                  <div className="flex items-center">
                    <FiUser className="mr-1 h-4 w-4" />
                    {t('relatorios.gerado_por', 'Gerado por')}
                  </div>
                </th>
                
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('relatorios.detalhes', 'Detalhes')}
                </th>
                
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.status', 'Status')}
                </th>
                
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('relatorios.downloads', 'Downloads')}
                </th>
                
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">{t('common.acoes', 'Ações')}</span>
                </th>
              </tr>
            </thead>
            
            <tbody className="bg-white divide-y divide-gray-200">
              {historicoFiltrado.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiFileText className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.configuracao_nome}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.parametros_resumo}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatarData(item.gerado_em)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.gerado_por}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="space-y-1">
                      <div>{formatarTamanhoArquivo(item.tamanho_arquivo)}</div>
                      <div>{item.paginas} página(s)</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <FiDownload className="h-4 w-4 text-gray-400 mr-1" />
                      {item.downloads}
                    </div>
                    {item.ultimo_download && (
                      <div className="text-xs text-gray-500 mt-1">
                        Último: {formatarData(item.ultimo_download)}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {item.status === 'ativo' && (
                        <>
                          <button
                            onClick={() => onDownload(item)}
                            className="text-blue-600 hover:text-blue-900"
                            title={t('common.download', 'Download')}
                          >
                            <FiDownload className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => window.open(item.arquivo_url, '_blank')}
                            className="text-green-600 hover:text-green-900"
                            title={t('relatorios.visualizar', 'Visualizar')}
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => onRegenerate(item)}
                        className="text-orange-600 hover:text-orange-900"
                        title={t('relatorios.regenerar', 'Regenerar')}
                      >
                        <FiRefreshCw className="h-4 w-4" />
                      </button>
                      
                      {item.status === 'arquivado' && (
                        <button
                          onClick={() => {
                            // Implementar exclusão
                            console.log({t('components.excluirRelatorio')}, item.id);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title={t('common.excluir', 'Excluir')}
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estado Vazio */}
      {historicoFiltrado.length === 0 && (
        <div className="text-center py-12">
          <FiClock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('relatorios.nenhum_historico', 'Nenhum relatório no histórico')}
          </h3>
          <p className="text-gray-600">
            {filtroStatus 
              ? t('relatorios.ajuste_filtro_status', 'Ajuste o filtro de status para ver mais relatórios')
              : t('relatorios.nenhum_historico_desc', 'Os relatórios gerados aparecerão aqui')
            }
          </p>
        </div>
      )}

      {/* Estatísticas do Histórico */}
      {historico.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('relatorios.estatisticas', 'Estatísticas')}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {historico.length}
              </div>
              <div className="text-sm text-gray-600">
                {t('relatorios.total_relatorios', 'Total de Relatórios')}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {historico.filter(h => h.status === 'ativo').length}
              </div>
              <div className="text-sm text-gray-600">
                {t('relatorios.ativos', 'Ativos')}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {historico.reduce((sum, h) => sum + h.downloads, 0)}
              </div>
              <div className="text-sm text-gray-600">
                {t('relatorios.total_downloads', 'Total de Downloads')}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatarTamanhoArquivo(historico.reduce((sum, h) => sum + h.tamanho_arquivo, 0))}
              </div>
              <div className="text-sm text-gray-600">
                {t('relatorios.espaco_usado', 'Espaço Usado')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
