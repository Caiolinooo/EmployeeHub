'use client';

import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiFilter, FiRefreshCw, FiEye, FiSearch, FiPlus, FiAlertTriangle, FiDatabase } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithAuth } from '@/lib/authUtils';
import { fetchUserReimbursements } from '@/services/reimbursementService';
import ReimbursementDetailModal from '@/components/admin/ReimbursementDetailModal';

interface Reimbursement {
  id: string;
  protocolo: string;
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  cargo?: string;
  centroCusto?: string;
  centro_custo?: string;
  data: string;
  valorTotal?: number;
  valor_total?: number;
  moeda?: string;
  tipoReembolso?: string;
  tipo_reembolso?: string;
  descricao?: string;
  metodoPagamento?: string;
  metodo_pagamento?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pixTipo?: string;
  pix_tipo?: string;
  pixChave?: string;
  pix_chave?: string;
  comprovantes?: Array<{
    nome: string;
    url: string;
    tipo: string;
    tamanho: number;
  }>;
  observacoes?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  historico?: Array<{
    data: string;
    status: string;
    observacao: string;
  }>;
}

// Simplified version of the component to fix chunk loading issues
export default function ReimbursementDashboard() {
  const { t, locale } = useI18n();
  const { user, profile } = useSupabaseAuth();
  const router = useRouter();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [creatingTable, setCreatingTable] = useState(false);
  // Estado para modal de detalhes restaurado
  const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Carregar solicitações de reembolso do usuário atual
  const fetchReimbursements = async () => {
    if (!user?.email) {
      setError(t('components.usuarioNaoAutenticado'));
      setLoading(false);
      return;
    }

    console.log(t('components.emailDoUsuarioLogadoParaBuscaDeReembolsos'), user.email);

    try {
      setLoading(true);
      setError(null);

      // Normalizar o email para evitar problemas de case sensitivity
      const normalizedEmail = user.email.toLowerCase().trim();
      console.log(t('components.emailDoUsuarioNormalizadoNormalizedemail'));

      // Construir parâmetros de consulta
      const queryParams = new URLSearchParams();
      queryParams.append('email', normalizedEmail);

      if (statusFilter) {
        queryParams.append('status', statusFilter);
      }

      if (searchTerm) {
        queryParams.append('search', searchTerm);
      }

      // Adicionar paginação
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());

      // Fazer a requisição para a API
      console.log(t('components.buscandoReembolsosDoUsuarioViaApi'));
      console.log('URL:', `/api/reembolso/user?${queryParams.toString()}`);

      const response = await fetchWithAuth(`/api/reembolso/user?${queryParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ao buscar reembolsos: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Resposta da API:', responseData);

      // Verificar o formato da resposta
      let apiData = [];
      let totalCount = 0;

      if (responseData.data && Array.isArray(responseData.data)) {
        // Novo formato com paginação
        apiData = responseData.data;
        totalCount = responseData.pagination?.total || apiData.length;
        console.log(`Reembolsos encontrados (novo formato): ${apiData.length}, total: ${totalCount}`);
      } else if (Array.isArray(responseData)) {
        // Formato antigo sem paginação
        apiData = responseData;
        totalCount = apiData.length;
        console.log(`Reembolsos encontrados (formato antigo): ${apiData.length}`);
      } else {
        console.warn('Formato de resposta desconhecido:', responseData);
        apiData = [];
        totalCount = 0;
      }

      if (apiData && apiData.length > 0) {
        // Normalizar os dados
        const normalizedData = apiData.map((item: any) => ({
          id: item.id,
          protocolo: item.protocolo,
          nome: item.nome,
          email: item.email,
          data: item.data,
          valorTotal: parseFloat(item.valor_total || item.valorTotal || 0),
          valor_total: parseFloat(item.valor_total || item.valorTotal || 0),
          tipoReembolso: item.tipo_reembolso || item.tipoReembolso || '',
          tipo_reembolso: item.tipo_reembolso || item.tipoReembolso || '',
          status: item.status || 'pendente',
          created_at: item.created_at || new Date().toISOString()
        }));

        setReimbursements(normalizedData);
        setTotalCount(totalCount);
        console.log('Reembolsos carregados com sucesso:', normalizedData);
      } else {
        // Sem dados da API, manter lista vazia
        setReimbursements([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error(t('components.erroAoCarregarSolicitacoesDeReembolso'), err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setReimbursements([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Carregar solicitações quando o componente montar ou os filtros mudarem
  useEffect(() => {
    if (user?.email) {
      // Adicionar um pequeno atraso para garantir que o console.log anterior seja concluído
      const timer = setTimeout(() => {
        console.log(t('components.iniciandoBuscaDeReembolsosAposMontagemDoComponente'));
        console.log(t('components.informacoesDoUsuario'), {
          email: user?.email,
          id: user?.id,
          role: profile?.role,
          nome: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
        });
        fetchReimbursements();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [user?.email, profile, statusFilter, page, limit, searchTerm]);

  // Function to check if the Reimbursement table exists - uses API route
  const checkReimbursementTable = async () => {
    try {
      console.log('Checking if Reimbursement table exists via API...');

      const response = await fetch('/api/reembolso/test-access');
      const result = await response.json();

      if (result.success && result.tableAccessible) {
        console.log('Reimbursement table exists and is accessible');
        setTableExists(true);
        setTableName('Reimbursement');
        return true;
      }

      console.log('Reimbursement table not found or not accessible');
      setTableExists(false);
      setTableName(null);
      return false;
    } catch (err) {
      console.error('Exception checking Reimbursement table:', err);
      setTableExists(false);
      setTableName(null);
      return false;
    }
  };

  // Function to create the Reimbursement table
  const createReimbursementTable = async () => {
    try {
      setCreatingTable(true);
      console.log('Creating Reimbursement table...');

      // Chamar a API para criar a tabela
      const response = await fetch('/api/reembolso/create-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createTable: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ao criar tabela: ${response.status}`);
      }

      const data = await response.json();
      console.log('Resposta da API:', data);

      if (data.success) {
        setTableExists(true);
        setTableName('Reimbursement');
        toast.success('Tabela de reembolsos criada com sucesso!');
        return true;
      } else {
        throw new Error(data.error || 'Erro desconhecido ao criar tabela');
      }
    } catch (err) {
      console.error('Exception creating Reimbursement table:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao criar tabela');
      toast.error('Erro ao criar tabela de reembolsos');
      return false;
    } finally {
      setCreatingTable(false);
    }
  };

  // Function to create the comprovantes bucket
  const createComprovantesBucket = async () => {
    try {
      console.log('Creating comprovantes bucket...');

      const response = await fetch('/api/reembolso/create-bucket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('Error parsing bucket creation response:', parseError);
        return false;
      }

      if (!response.ok) {
        console.error('Error creating bucket:', responseData);

        // Show a non-blocking toast message
        if (responseData?.suggestion) {
          toast.error(
            `Erro ao criar bucket de armazenamento: ${responseData.error || 'Erro desconhecido'}.
            ${responseData.suggestion}`,
            { duration: 6000 }
          );
        } else {
          toast.error(t('components.erroAoCriarBucketDeArmazenamentoOSistemaContinuara'),
            { duration: 6000 }
          );
        }

        return false;
      }

      console.log('Bucket creation response:', responseData);

      if (responseData.success) {
        console.log('Bucket created or already exists:', responseData.message);
        return true;
      } else {
        console.error('Unexpected response from bucket creation API:', responseData);
        return false;
      }
    } catch (err) {
      console.error('Exception creating bucket:', err);

      // Show a non-blocking toast message
      toast.error(
        t('components.erroAoCriarBucketDeArmazenamentoOSistemaContinuara'),
        { duration: 6000 }
      );

      return false;
    }
  };

  // Function to update RLS policies - simplified to use API routes instead of direct Supabase access
  const updateRLSPolicies = async () => {
    try {
      console.log('Checking Reimbursement table access via API...');

      // Use API route instead of direct Supabase client to avoid RLS issues
      const response = await fetch('/api/reembolso/test-access');
      
      if (!response.ok) {
        console.warn('Reimbursement API test access returned non-OK status:', response.status);
      } else {
        const result = await response.json();
        console.log('Reimbursement API test access result:', result);
      }

      return true;
    } catch (err) {
      console.error('Exception checking Reimbursement table access:', err);
      return true; // Return true anyway to avoid blocking the application
    }
  };

  // Effect to check if the Reimbursement table exists when the component mounts
  useEffect(() => {
    const initializeReimbursementSystem = async () => {
      try {
        // Check if the table exists
        const tableExists = await checkReimbursementTable();

        // Try to create the bucket for attachments, but continue even if it fails
        try {
          const bucketCreated = await createComprovantesBucket();
          console.log('Bucket creation result:', bucketCreated ? 'Success' : 'Failed');
        } catch (bucketError) {
          console.error('Error during bucket creation process:', bucketError);
          // Don't block the application flow, just log the error
        }

        // Update RLS policies to fix permission issues
        try {
          const policiesUpdated = await updateRLSPolicies();
          console.log('RLS policies update result:', policiesUpdated ? 'Success' : 'Failed');
        } catch (rlsError) {
          console.error('Error during RLS policy update:', rlsError);
          // Don't block the application flow, just log the error
        }

        // If the table doesn't exist, we'll show the UI to create it
        if (!tableExists) {
          console.log('Reimbursement table does not exist, showing creation UI');
        }
      } catch (error) {
        console.error('Error initializing reimbursement system:', error);
        // Show a non-blocking error message
        toast.error(t('components.erroAoInicializarOSistemaDeReembolsosAlgumasFuncio'),
          { duration: 5000 }
        );
      }
    };

    initializeReimbursementSystem();
  }, []);

  // Efeito adicional para verificar se há reembolsos para o usuário quando o componente montar
  useEffect(() => {
    if (user?.email && tableExists) {
      console.log(t('components.verificandoReembolsosExistentesParaOUsuarioUserema'));
      // Não fazemos nada aqui para evitar chamadas de API que podem falhar
      // Os dados de exemplo já são carregados pela função fetchReimbursements
    }
  }, [user?.email, tableExists]);

  // Função para visualizar detalhes de uma solicitação
  const handleViewDetails = (reimbursement: Reimbursement) => {
    console.log(`Abrindo modal de detalhes do reembolso com protocolo: ${reimbursement.protocolo}`);
    setSelectedReimbursement(reimbursement);
    setShowDetailModal(true);
  };

  // Função para fechar o modal de detalhes
  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedReimbursement(null);
  };

  // Função para formatar valor monetário
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale);
  };

  // Função para navegar para a página de criação de reembolso
  const handleCreateReimbursement = () => {
    router.push('/reembolso');
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">{t('reimbursement.tabs.dashboard')}</h2>
        <button
          onClick={handleCreateReimbursement}
          className="flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark"
        >
          <FiPlus className="mr-2" />
          {t('reimbursement.form.submit')}
        </button>
      </div>

      {/* Filtros e pesquisa */}
      <div className="shrink-0 bg-white p-4 rounded-lg shadow-sm mb-6">
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
                    fetchReimbursements();
                  }
                }}
              />
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            <button
              onClick={fetchReimbursements}
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
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="rejeitado">Rejeitado</option>
                <option value="pago">Pago</option>
              </select>
              <FiFilter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <button
              onClick={fetchReimbursements}
              className="p-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              title={t('common.refresh')}
            >
              <FiRefreshCw />
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de solicitações */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
          </div>
        ) : tableExists === false ? (
          <div className="p-6 text-center">
            <FiAlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Tabela de Reembolsos Não Encontrada</h2>
            <p className="text-gray-600 mb-4">
              A tabela de reembolsos não existe no banco de dados. Clique no botão abaixo para criá-la.
            </p>
            <button
              onClick={createReimbursementTable}
              disabled={creatingTable}
              className="mt-4 px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark flex items-center mx-auto"
            >
              {creatingTable ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Criando Tabela...
                </>
              ) : (
                <>
                  <FiDatabase className="mr-2" />
                  Criar Tabela de Reembolsos
                </>
              )}
            </button>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            <p>{error}</p>
            {tableExists !== true ? (
              <button
                onClick={createReimbursementTable}
                disabled={creatingTable}
                className="mt-4 px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark flex items-center mx-auto"
              >
                {creatingTable ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Criando Tabela...
                  </>
                ) : (
                  <>
                    <FiDatabase className="mr-2" />
                    Criar Tabela de Reembolsos
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={fetchReimbursements}
                className="mt-4 px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark"
              >
                {t('common.tryAgain')}
              </button>
            )}
          </div>
        ) : reimbursements.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>{t('common.noData')}</p>
            <button
              onClick={handleCreateReimbursement}
              className="mt-4 px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark flex items-center mx-auto"
            >
              <FiPlus className="mr-2" />
              {t('reimbursement.form.submit')}
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reimbursement.form.protocol')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reimbursement.form.expenseDate')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reimbursement.form.expenseType')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('reimbursement.form.expenseValue')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.status')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reimbursements.map((reimbursement) => (
                  <tr key={reimbursement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {reimbursement.protocolo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(reimbursement.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reimbursement.tipoReembolso || reimbursement.tipo_reembolso}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(reimbursement.valorTotal || reimbursement.valor_total || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        reimbursement.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                        reimbursement.status === 'rejeitado' ? 'bg-red-100 text-red-800' :
                        reimbursement.status === 'pago' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {reimbursement.status.charAt(0).toUpperCase() + reimbursement.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(reimbursement)}
                        className="text-abz-blue hover:text-abz-blue-dark"
                      >
                        <FiEye className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {!loading && !error && reimbursements.length > 0 && (
        <div className="shrink-0 mt-4 flex items-center justify-between">
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

      {/* Modal de detalhes do reembolso */}
      {showDetailModal && selectedReimbursement && (
        <ReimbursementDetailModal
          reimbursement={selectedReimbursement}
          isOpen={showDetailModal}
          onClose={handleCloseDetailModal}
          readOnly={true}
          onStatusChange={fetchReimbursements}
        />
      )}
    </div>
  );
}
