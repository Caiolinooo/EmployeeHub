'use client';

import React, { useState, useEffect } from 'react';
import { FiBarChart2, FiUser, FiCalendar, FiEye, FiSearch, FiFilter, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import ScoreChart from './ScoreChart';

interface Evaluation {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  pontuacao_total: number;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  funcionario_nome?: string;
  funcionario_cargo?: string;
  funcionario_departamento?: string;
  avaliador_nome?: string;
  avaliador_cargo?: string;
  categorias?: Array<{
    id: string;
    nome: string;
    pontuacao: number;
    comentarios?: string;
  }>;
}

export default function EvaluationDashboard() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, isAdmin, isManager, profile, hasEvaluationAccess } = useSupabaseAuth();

  // Verificar se o usuário tem acesso ao módulo de avaliação
  useEffect(() => {
    if (!hasEvaluationAccess && !isAdmin && !isManager) {
      toast.error(t('evaluation.noPermission', 'You do not have permission to access the evaluation module.'));
      router.push('/dashboard');
    }
  }, [hasEvaluationAccess, isAdmin, isManager, router, t]);

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Carregar avaliações
  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Verificar se o usuário está autenticado
      if (!user || !user.id) {
        throw new Error(t('auth.userNotAuthenticated', 'User not authenticated'));
      }

      // Verificar se a view existe antes de tentar consultar
      try {
        // Primeiro, verificar se a tabela/view existe
        const { data: tableExists, error: tableCheckError } = await supabase
          .from('vw_avaliacoes_desempenho')
          .select('id')
          .limit(1);

        if (tableCheckError) {
          console.error('Erro ao verificar tabela:', tableCheckError);
          // Se a tabela não existir, tentar usar a tabela avaliacoes_desempenho diretamente
          const { data: fallbackData, error: fallbackError, count } = await supabase
            .from('avaliacoes_desempenho')
            .select(`
              id,
              funcionario_id,
              avaliador_id,
              periodo,
              data_inicio,
              data_fim,
              status,
              pontuacao_total,
              observacoes,
              created_at,
              updated_at
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

          if (fallbackError) {
            throw fallbackError;
          }

          // Usar dados básicos sem informações de funcionário/avaliador
          setEvaluations(fallbackData || []);
          setTotalCount(count || 0);
          return;
        }
      } catch (tableError) {
        console.error('Erro ao verificar tabela:', tableError);
        // Continuar com a consulta normal, pois o erro pode ser por outro motivo
      }

      // Construir consulta base
      let query = supabase
        .from('vw_avaliacoes_desempenho')
        .select(`
          id,
          funcionario_id,
          avaliador_id,
          periodo,
          data_inicio,
          data_fim,
          status,
          pontuacao_total,
          observacoes,
          created_at,
          updated_at,
          funcionario_nome,
          funcionario_cargo,
          funcionario_departamento,
          avaliador_nome,
          avaliador_cargo
        `, { count: 'exact' });

      // Aplicar filtros
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      // Aplicar busca
      if (searchTerm) {
        query = query.or(`funcionario_nome.ilike.%${searchTerm}%,periodo.ilike.%${searchTerm}%`);
      }

      // Aplicar filtro de acesso baseado no papel do usuário
      if (!isAdmin && !isManager) {
        // Usuários regulares só podem ver suas próprias avaliações
        query = query.eq('funcionario_id', user?.id || '');
      }

      // Aplicar paginação
      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      // Executar consulta
      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        throw fetchError;
      }

      console.log('Avaliações carregadas:', data);
      setEvaluations(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Erro ao carregar avaliações:', err);

      // Tratar o erro de forma mais amigável
      let errorMessage = t('evaluation.errorLoadingEvaluations', 'Error loading evaluations');

      if (err instanceof Error) {
        // Verificar se é um erro específico do Supabase
        if (err.message.includes('relation "vw_avaliacoes_desempenho" does not exist')) {
          errorMessage = t('evaluation.viewNotConfigured', 'The evaluation view is not configured. Contact the administrator.');
        } else if (err.message.includes('permission denied')) {
          errorMessage = t('evaluation.noPermissionAccess', 'You do not have permission to access evaluations.');
        } else {
          errorMessage = `${t('common.error', 'Error')}: ${err.message}`;
        }
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Carregar avaliações quando o componente montar ou os filtros mudarem
  useEffect(() => {
    fetchEvaluations();
  }, [statusFilter, page, limit, searchTerm, isAdmin, isManager, user?.id]);

  // Função para visualizar detalhes de uma avaliação
  const handleViewDetails = (evaluation: Evaluation) => {
    router.push(`/avaliacao/avaliacoes/${evaluation.id}`);
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Função para renderizar informações do avaliador com base no papel do usuário
  const renderEvaluatorInfo = (evaluation: Evaluation) => {
    if (isAdmin || isManager) {
      return (
        <p className="text-sm text-gray-600">
          <span className="font-medium">{t('evaluation.evaluator', 'Evaluator')}:</span> {evaluation.avaliador_nome}
          {evaluation.avaliador_cargo && ` (${evaluation.avaliador_cargo})`}
        </p>
      );
    }
    return null;
  };

  // Função para renderizar timestamps com base no papel do usuário
  const renderTimestamps = (evaluation: Evaluation) => {
    if (isAdmin || isManager) {
      return (
        <p className="text-xs text-gray-500 mt-2">
          {t('common.createdAt', 'Created at')}: {formatDate(evaluation.created_at)}
          {evaluation.updated_at && evaluation.updated_at !== evaluation.created_at &&
            ` | ${t('common.updatedAt', 'Updated at')}: ${formatDate(evaluation.updated_at)}`}
        </p>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          {t('evaluation.dashboard.title', 'Avaliações de Desempenho')}
        </h2>
      </div>

      {/* Filtros e pesquisa */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder={t('common.search')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchEvaluations();
                  }
                }}
              />
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            <button
              onClick={fetchEvaluations}
              className="ml-2 p-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark"
              title={t('common.search')}
            >
              <FiSearch />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <select
                className="pl-4 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue focus:border-transparent appearance-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">{t('common.all')}</option>
                <option value="pendente">{t('evaluation.status.pending', 'Pending')}</option>
                <option value="em_andamento">{t('evaluation.status.inProgress', 'In Progress')}</option>
                <option value="concluida">{t('evaluation.status.completed', 'Completed')}</option>
                <option value="cancelada">{t('evaluation.status.cancelled', 'Cancelled')}</option>
              </select>
              <FiFilter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <button
              onClick={fetchEvaluations}
              className="p-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              title={t('common.refresh')}
            >
              <FiRefreshCw />
            </button>
          </div>
        </div>
      </div>

      {/* Lista de avaliações */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            <p>{error}</p>
            <button
              onClick={fetchEvaluations}
              className="mt-4 px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark"
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : evaluations.length === 0 ? (
          <div className="p-6 text-center text-gray-500 bg-white rounded-lg shadow-sm">
            <p>{t('common.noData')}</p>
          </div>
        ) : (
          evaluations.map((evaluation) => (
            <div key={evaluation.id} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="mb-4 md:mb-0">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <FiUser className="mr-2 text-abz-blue" />
                    {evaluation.funcionario_nome}
                  </h3>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{t('common.position', 'Position')}:</span> {evaluation.funcionario_cargo || t('common.notInformed', 'Not informed')}
                    {evaluation.funcionario_departamento && ` | ${evaluation.funcionario_departamento}`}
                  </p>
                  {renderEvaluatorInfo(evaluation)}
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">{t('evaluation.period', 'Period')}:</span> {evaluation.periodo}
                    <span className="ml-3 font-medium">{t('common.status', 'Status')}:</span>
                    <span className={`ml-1 px-2 py-0.5 text-xs rounded-full inline-flex items-center
                      ${evaluation.status === 'concluida' ? 'bg-green-100 text-green-800' :
                        evaluation.status === 'cancelada' ? 'bg-red-100 text-red-800' :
                        evaluation.status === 'em_andamento' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'}`}>
                      {evaluation.status.replace('_', ' ').charAt(0).toUpperCase() + evaluation.status.replace('_', ' ').slice(1)}
                    </span>
                  </p>
                  {renderTimestamps(evaluation)}
                </div>
                <div className="flex flex-col items-center">
                  <div className="mb-2">
                    <ScoreChart score={evaluation.pontuacao_total} size={80} />
                  </div>
                  <button
                    onClick={() => handleViewDetails(evaluation)}
                    className="flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark"
                  >
                    <FiEye className="mr-2" />
                    {t('common.details', 'Details')}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Paginação */}
      {!loading && !error && evaluations.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {t('common.showing')} <span className="font-medium">{(page - 1) * limit + 1}</span> {t('common.to')}{' '}
            <span className="font-medium">{Math.min(page * limit, totalCount)}</span> {t('common.of')}{' '}
            <span className="font-medium">{totalCount}</span> {t('common.results')}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className={`px-3 py-1 rounded-md ${
                page === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-abz-blue text-white hover:bg-abz-blue-dark'
              }`}
            >
              {t('common.previous')}
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * limit >= totalCount}
              className={`px-3 py-1 rounded-md ${
                page * limit >= totalCount
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-abz-blue text-white hover:bg-abz-blue-dark'
              }`}
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
