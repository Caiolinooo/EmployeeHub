'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiFileText, FiArrowLeft, FiPlus, FiEdit, FiTrash2, FiEye, FiLoader } from 'react-icons/fi';
import PageHeader from '@/components/PageHeader';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getToken } from '@/lib/tokenStorage';
import ClientOnly from '@/components/ClientOnly';

interface Avaliacao {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  pontuacao_total: number;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  funcionario_nome?: string;
  funcionario_cargo?: string;
  funcionario_departamento?: string;
  avaliador_nome?: string;
  avaliador_cargo?: string;
  funcionario?: {
    nome: string;
    cargo?: string;
    departamento?: string;
  };
  avaliador?: {
    nome: string;
    cargo?: string;
  };
}

// Define type for raw API data item
interface RawAvaliacaoData {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  pontuacao_total: number;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  funcionario_nome?: string;
  funcionario_cargo?: string;
  funcionario_departamento?: string;
  avaliador_nome?: string;
  avaliador_cargo?: string;
}

/**
 * Componente de carregamento simples
 */
const LoadingIndicator = () => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <FiLoader className="animate-spin h-12 w-12 text-abz-blue mb-4" />
      <p className="text-gray-600">{t ? t('common.loading', 'Carregando...') : 'Carregando...'}</p>
    </div>
  );
};

export default function AvaliacoesPageFixed() {
  const { t } = useI18n();
  const { user, profile, isLoading: authLoading, isAdmin, isManager } = useSupabaseAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Verificar se o usuário tem permissão para acessar esta página
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      console.log('AvaliacoesPageFixed - Usuário não autenticado, redirecionando para login');
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/avaliacao/avaliacoes')}`);
      return;
    }

    if (!profile) {
      console.log('AvaliacoesPageFixed - Perfil não carregado, aguardando...');
      return;
    }

    if (!isAdmin && !isManager) {
      console.log('AvaliacoesPageFixed - Usuário não tem permissão, redirecionando para dashboard');
      router.push('/dashboard');
      return;
    }

    console.log('AvaliacoesPageFixed - Usuário autenticado e com permissão:', {
      role: profile.role,
      isAdmin,
      isManager
    });

    setInitialized(true);
  }, [user, profile, authLoading, isAdmin, isManager, router, pathname]);

  // Carregar avaliações
  useEffect(() => {
    if (!initialized || !t) return;

    async function loadAvaliacoes() {
      setIsLoading(true);
      setError(null);

      try {
        console.log('AvaliacoesPageFixed - Iniciando carregamento de avaliações...');

        const token = getToken();
        if (!token) {
          console.error('AvaliacoesPageFixed - Token não encontrado, redirecionando para login');
          throw new Error(t ? t('errors.unauthorizedNoToken', 'Não autorizado - Token não encontrado') : 'Não autorizado - Token não encontrado');
        }

        console.log('AvaliacoesPageFixed - Token encontrado, comprimento:', token.length);

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        };

        // Adicionar timestamp para evitar cache
        const timestamp = new Date().getTime();
        console.log('AvaliacoesPageFixed - Buscando avaliações da API com timestamp:', timestamp);

        // Tentar várias vezes em caso de falha
        let response;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            response = await fetch(`/api/avaliacao-desempenho/avaliacoes?_=${timestamp}`, {
              headers,
              cache: 'no-store',
              next: { revalidate: 0 }
            });

            if (response.ok) break;

            console.log(`Tentativa ${attempts + 1} falhou com status ${response.status}. Tentando novamente...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo entre tentativas
          } catch (error) {
            console.error(`Erro na tentativa ${attempts + 1}:`, error);
          }

          attempts++;
        }

        if (!response || !response.ok) {
          throw new Error(`Falha ao buscar avaliações após ${maxAttempts} tentativas`);
        }

        console.log('AvaliacoesPageFixed - Resposta da API:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          console.error('AvaliacoesPageFixed - Erro retornado pela API:', errorData);
          const apiErrorMsg = errorData.error || `${t ? t('errors.failedToLoadGeneric', 'Erro ao carregar') : 'Erro ao carregar'}: ${response.status} ${response.statusText}`;
          throw new Error(apiErrorMsg);
        }

        const data = await response.json();
        console.log('AvaliacoesPageFixed - Dados recebidos da API:', {
          success: data.success,
          count: data.data?.length || 0
        });

        if (data.success && Array.isArray(data.data)) {
          const avaliacoesProcessadas = data.data.map((avaliacao: RawAvaliacaoData): Avaliacao => ({
            ...avaliacao,
            funcionario: {
              nome: avaliacao.funcionario_nome || (t ? t('common.employeeNotFound', 'Funcionário não encontrado') : 'Funcionário não encontrado'),
              cargo: avaliacao.funcionario_cargo,
              departamento: avaliacao.funcionario_departamento
            },
            avaliador: {
              nome: avaliacao.avaliador_nome || (t ? t('common.evaluatorNotFound', 'Avaliador não encontrado') : 'Avaliador não encontrado'),
              cargo: avaliacao.avaliador_cargo
            }
          }));
          setAvaliacoes(avaliacoesProcessadas);
          console.log('AvaliacoesPageFixed - Avaliações processadas:', avaliacoesProcessadas.length);
        } else {
          setAvaliacoes([]);
          console.log('AvaliacoesPageFixed - Nenhuma avaliação encontrada ou dados inválidos');
          if (!data.success && data.error) {
             setError(data.error);
          } else if (!Array.isArray(data.data)) {
             setError(t ? t('errors.invalidDataFormat', 'Formato de dados inválido recebido.') : 'Formato de dados inválido recebido.');
          }
        }
      } catch (error) {
        console.error('AvaliacoesPageFixed - Erro no bloco catch principal:', error);
        setError(error instanceof Error ? error.message : (t ? t('errors.unknownError', 'Erro desconhecido') : 'Erro desconhecido'));
      } finally {
        setIsLoading(false);
      }
    }

    loadAvaliacoes();
  }, [initialized, t, router]);

  // Se estiver carregando a autenticação, mostrar indicador de carregamento
  if (authLoading) {
    return (
      <MainLayout>
        <LoadingIndicator />
      </MainLayout>
    );
  }

  // Se não estiver inicializado (verificando permissões), mostrar indicador de carregamento
  if (!initialized) {
    return (
      <MainLayout>
        <LoadingIndicator />
      </MainLayout>
    );
  }

  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Renderizar status
  const renderStatus = (status: Avaliacao['status']) => {
    if (!t) return status;

    const normalizedStatus = status.replace(/\s+/g, '_').toLowerCase();

    switch (normalizedStatus) {
      case 'pendente':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            {t('avaliacao.status.pendente', 'Pendente')}
          </span>
        );
      case 'em_andamento':
      case 'emandamento':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {t('avaliacao.status.emAndamento', 'Em andamento')}
          </span>
        );
      case 'concluida':
      case 'concluída':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {t('avaliacao.status.concluida', 'Concluída')}
          </span>
        );
      case 'cancelada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {t('avaliacao.status.cancelada', 'Cancelada')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  // Renderizar o conteúdo principal
  return (
    <ClientOnly>
      <MainLayout>
        {t && (
          <div className="space-y-8">
            <PageHeader
              title={t('avaliacao.avaliacoes', 'Avaliações')}
              description={t('avaliacao.avaliacoesDesc', 'Gerencie avaliações de desempenho')}
              icon={<FiFileText className="w-8 h-8" />}
            />

            <div className="mb-4">
              <Link
                href="/avaliacao"
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <FiArrowLeft className="mr-1" />
                {t('common.voltar', 'Voltar')}
              </Link>
            </div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">{t('avaliacao.listaAvaliacoes', 'Lista de Avaliações')}</h2>
              <Link
                href="/avaliacao/novo"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
              >
                <FiPlus className="mr-2 -ml-1 h-5 w-5" />
                {t('avaliacao.novaAvaliacao', 'Nova Avaliação')}
              </Link>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">{t ? t('errors.errorTitle', 'Erro!') : 'Erro!'}</strong>
                <span className="block sm:inline ml-2">{typeof error === 'string' ? error : (t ? t('errors.unknownError', 'Ocorreu um erro desconhecido.') : 'Ocorreu um erro desconhecido.')}</span>
              </div>
            )}

            {isLoading ? (
              <LoadingIndicator />
            ) : avaliacoes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <FiFileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">{t('avaliacao.semAvaliacoes', 'Nenhuma avaliação encontrada')}</p>
                <Link
                  href="/avaliacao/novo"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
                >
                  <FiPlus className="mr-2 -ml-1 h-5 w-5" />
                  {t('avaliacao.novaAvaliacao', 'Nova Avaliação')}
                </Link>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('avaliacao.funcionario', 'Funcionário')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('avaliacao.avaliador', 'Avaliador')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('avaliacao.periodo', 'Período')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('avaliacao.dataInicio', 'Data Início')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('avaliacao.dataFim', 'Data Fim')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('avaliacao.status', 'Status')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('avaliacao.pontuacao', 'Pontuação')}
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('common.acoes', 'Ações')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {avaliacoes.map((avaliacao) => (
                        <tr key={avaliacao.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {avaliacao.funcionario?.nome ?? t('common.notApplicable', 'N/A')}
                            </div>
                            {avaliacao.funcionario?.cargo && (
                              <div className="text-sm text-gray-500">
                                {avaliacao.funcionario.cargo}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {avaliacao.avaliador?.nome ?? t('common.notApplicable', 'N/A')}
                            </div>
                            {avaliacao.avaliador?.cargo && (
                              <div className="text-sm text-gray-500">
                                {avaliacao.avaliador.cargo}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {avaliacao.periodo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(avaliacao.data_inicio)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(avaliacao.data_fim)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderStatus(avaliacao.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {avaliacao.status === 'concluida' ? (avaliacao.pontuacao_total || 0).toFixed(1) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <Link
                                href={`/avaliacao/${avaliacao.id}`}
                                className="text-abz-blue hover:text-abz-blue-dark"
                                title={t('common.visualizar', 'Visualizar')}
                              >
                                <FiEye className="h-5 w-5" />
                              </Link>
                              {avaliacao.status !== 'concluida' && avaliacao.status !== 'cancelada' && (
                                <Link
                                  href={`/avaliacao/${avaliacao.id}/editar`}
                                  className="text-yellow-600 hover:text-yellow-900"
                                  title={t('common.editar', 'Editar')}
                                >
                                  <FiEdit className="h-5 w-5" />
                                </Link>
                              )}
                              <button
                                className="text-red-600 hover:text-red-900"
                                title={t('common.excluir', 'Excluir')}
                                onClick={async (e) => {
                                  e.preventDefault();
                                  if (window.confirm(t('avaliacao.confirmDelete', 'Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.'))) {
                                    try {
                                      const response = await fetch(`/api/avaliacao-desempenho/avaliacoes/${avaliacao.id}`, {
                                        method: 'DELETE',
                                        headers: {
                                          'Cache-Control': 'no-cache'
                                        }
                                      });

                                      if (response.ok) {
                                        alert(t('avaliacao.deleteSuccess', 'Avaliação excluída com sucesso!'));
                                        setAvaliacoes(avaliacoes.filter(a => a.id !== avaliacao.id));
                                      } else {
                                        const errorData = await response.json();
                                        alert(t('avaliacao.deleteError', 'Erro ao excluir avaliação: ') +
                                              (errorData.error || `${response.status} ${response.statusText}`));
                                      }
                                    } catch (error) {
                                      console.error('Erro ao excluir avaliação:', error);
                                      alert(t('avaliacao.deleteError', 'Erro ao excluir avaliação. Por favor, tente novamente.'));
                                    }
                                  }
                                }}
                              >
                                <FiTrash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </MainLayout>
    </ClientOnly>
  );
}

// This section was removed to fix duplicate declarations

