'use client';

import React, { useState } from 'react';
import { 
  FiTable, 
  FiTrendingUp, 
  FiTrendingDown, 
  FiMinus,
  FiEye,
  FiDownload,
  FiFilter
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { ResultadoAnalise, FiltroAnalise } from '@/types/avaliacoes-avancadas';

interface TabelaAnalisesProps {
  dados: ResultadoAnalise | null;
  filtros: FiltroAnalise;
  loading: boolean;
}

export default function TabelaAnalises({ dados, filtros, loading }: TabelaAnalisesProps) {
  const { t } = useI18n();
  const [tipoTabela, setTipoTabela] = useState<'departamentos' | 'cargos' | 'funcionarios'>('departamentos');
  const [ordenacao, setOrdenacao] = useState<{ campo: string; direcao: 'asc' | 'desc' }>({
    campo: 'media_pontuacao',
    direcao: 'desc'
  });

  const getTrendIcon = (valor: number, meta: number = 8.0) => {
    if (valor > meta) return <FiTrendingUp className="h-4 w-4 text-green-500" />;
    if (valor < meta * 0.8) return <FiTrendingDown className="h-4 w-4 text-red-500" />;
    return <FiMinus className="h-4 w-4 text-gray-500" />;
  };

  const formatarPontuacao = (pontuacao: number) => {
    return pontuacao.toFixed(2);
  };

  const getCorPontuacao = (pontuacao: number) => {
    if (pontuacao >= 8.0) return 'text-green-600 font-semibold';
    if (pontuacao >= 6.0) return 'text-yellow-600 font-medium';
    return 'text-red-600 font-semibold';
  };

  const ordenarDados = (dados: any[], campo: string, direcao: 'asc' | 'desc') => {
    return [...dados].sort((a, b) => {
      const valorA = a[campo];
      const valorB = b[campo];
      
      if (direcao === 'asc') {
        return valorA > valorB ? 1 : -1;
      } else {
        return valorA < valorB ? 1 : -1;
      }
    });
  };

  const handleOrdenacao = (campo: string) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'desc' ? 'asc' : 'desc'
    }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <FiTable className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('avaliacoes.sem_dados_analise', 'Nenhum dado de análise disponível')}
        </h3>
        <p className="text-gray-600">
          {t('avaliacoes.sem_dados_analise_desc', 'Ajuste os filtros para visualizar as análises detalhadas.')}
        </p>
      </div>
    );
  }

  const dadosParaTabela = () => {
    switch (tipoTabela) {
      case 'departamentos':
        return ordenarDados(dados.comparacoes.departamentos, ordenacao.campo, ordenacao.direcao);
      case 'cargos':
        return ordenarDados(dados.comparacoes.cargos, ordenacao.campo, ordenacao.direcao);
      default:
        return [];
    }
  };

  const dadosTabela = dadosParaTabela();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('avaliacoes.analises_detalhadas', 'Análises Detalhadas')}
        </h2>
        <div className="flex items-center space-x-3">
          <select
            value={tipoTabela}
            onChange={(e) => setTipoTabela(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="departamentos">{t('common.departamentos', 'Departamentos')}</option>
            <option value="cargos">{t('common.cargos', 'Cargos')}</option>
          </select>
          <button
            onClick={() => {
              // Implementar exportação da tabela
              console.log('Exportar tabela:', tipoTabela);
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiDownload className="mr-1 h-4 w-4" />
            {t('common.exportar', 'Exportar')}
          </button>
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          {t('avaliacoes.resumo_geral', 'Resumo Geral')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {dados.resumo.total_avaliacoes}
            </div>
            <div className="text-sm text-blue-800">
              {t('avaliacoes.total_avaliacoes', 'Total de Avaliações')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatarPontuacao(dados.resumo.media_geral)}
            </div>
            <div className="text-sm text-blue-800">
              {t('avaliacoes.media_geral', 'Média Geral')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {dados.resumo.avaliacoes_concluidas}
            </div>
            <div className="text-sm text-blue-800">
              {t('avaliacoes.concluidas', 'Concluídas')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {dados.resumo.avaliacoes_pendentes}
            </div>
            <div className="text-sm text-blue-800">
              {t('avaliacoes.pendentes', 'Pendentes')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {dados.resumo.funcionarios_avaliados}
            </div>
            <div className="text-sm text-blue-800">
              {t('avaliacoes.funcionarios_avaliados', 'Funcionários Avaliados')}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Dados */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {tipoTabela === 'departamentos' 
              ? t('avaliacoes.performance_por_departamento', 'Performance por Departamento')
              : t('avaliacoes.performance_por_cargo', 'Performance por Cargo')
            }
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('nome')}
                >
                  <div className="flex items-center">
                    {tipoTabela === 'departamentos' ? t('common.departamento', 'Departamento') : t('common.cargo', 'Cargo')}
                    {ordenacao.campo === 'nome' && (
                      ordenacao.direcao === 'desc' ? <FiTrendingDown className="ml-1 h-3 w-3" /> : <FiTrendingUp className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('media_pontuacao')}
                >
                  <div className="flex items-center">
                    {t('avaliacoes.media_pontuacao', 'Média de Pontuação')}
                    {ordenacao.campo === 'media_pontuacao' && (
                      ordenacao.direcao === 'desc' ? <FiTrendingDown className="ml-1 h-3 w-3" /> : <FiTrendingUp className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('total_funcionarios')}
                >
                  <div className="flex items-center">
                    {t('avaliacoes.total_funcionarios', 'Total de Funcionários')}
                    {ordenacao.campo === 'total_funcionarios' && (
                      ordenacao.direcao === 'desc' ? <FiTrendingDown className="ml-1 h-3 w-3" /> : <FiTrendingUp className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao('avaliacoes_concluidas')}
                >
                  <div className="flex items-center">
                    {t('avaliacoes.avaliacoes_concluidas', 'Avaliações Concluídas')}
                    {ordenacao.campo === 'avaliacoes_concluidas' && (
                      ordenacao.direcao === 'desc' ? <FiTrendingDown className="ml-1 h-3 w-3" /> : <FiTrendingUp className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('avaliacoes.tendencia', 'Tendência')}
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">{t('common.acoes', 'Ações')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dadosTabela.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={getCorPontuacao(item.media_pontuacao)}>
                      {formatarPontuacao(item.media_pontuacao)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.total_funcionarios}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.avaliacoes_concluidas}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getTrendIcon(item.media_pontuacao)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        // Implementar visualização detalhada
                        console.log('Ver detalhes:', item);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <FiEye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recomendações */}
      {dados.recomendacoes && dados.recomendacoes.length > 0 && (
        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            {t('avaliacoes.recomendacoes', 'Recomendações')}
          </h3>
          <ul className="space-y-2">
            {dados.recomendacoes.map((recomendacao, index) => (
              <li key={index} className="flex items-start">
                <div className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-green-500 mt-2 mr-3"></div>
                <span className="text-sm text-green-800">{recomendacao}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
