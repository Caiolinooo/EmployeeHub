'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiUser, FiArrowLeft, FiEdit, FiBarChart2, FiFileText } from 'react-icons/fi';
import PageHeader from '@/components/PageHeader';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import ManagerProtectedRoute from '@/components/Auth/ManagerProtectedRoute';
import { Tables } from '@/types/supabase';

type User = Tables<'users'>;

interface Avaliacao {
  id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  funcionario_id: string;
  avaliador_id: string;
  pontuacao_total: number;
  status: string;
  observacoes?: string;
  created_at: string;
  funcionario?: {
    nome: string;
    cargo: string;
    departamento: string;
  };
  avaliador?: {
    nome: string;
  };
}

export default function FuncionarioDetalhesPage({ params }: { params: { id: string } }) {
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const router = useRouter();
  const [funcionario, setFuncionario] = useState<User | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extrair o ID do funcionário usando React.use() para evitar o aviso
  const funcionarioId = React.use(Promise.resolve(params.id));

  // Carregar dados do funcionário
  useEffect(() => {
    async function loadFuncionario() {
      try {
        setIsLoading(true);
        setError(null);

        // Verificar se o ID é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(funcionarioId)) {
          console.error('ID inválido, não é um UUID válido:', funcionarioId);
          setError(`ID inválido: "${funcionarioId}". O ID deve ser um UUID válido.`);
          setIsLoading(false);

          // Redirecionar para a página de avaliações após um breve atraso
          setTimeout(() => {
            router.push('/avaliacao');
          }, 3000);

          return;
        }

        // Buscar funcionário pelo ID
        const { data, error } = await supabase
          .from('funcionarios')  // Alterado de 'users' para 'funcionarios'
          .select('*, users!user_id(*)')
          .eq('id', funcionarioId)
          .single();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Funcionário não encontrado');
        }

        // Usar os dados do usuário associado ao funcionário
        const userData = data.users || {};
        setFuncionario({
          ...userData,
          id: data.id,
          first_name: data.nome?.split(' ')[0] || userData.first_name || '',
          last_name: data.nome?.split(' ').slice(1).join(' ') || userData.last_name || '',
          email: data.email || userData.email || '',
          department: data.departamento || userData.department || '',
          position: data.cargo || userData.position || '',
          role: userData.role || 'USER',
          active: data.status === 'ativo'
        });

        // Buscar avaliações do funcionário do banco de dados
        const response = await fetch(`/api/avaliacao-desempenho/avaliacoes?funcionarioId=${funcionarioId}`);

        if (!response.ok) {
          throw new Error('Erro ao buscar avaliações');
        }

        const avaliacoesData = await response.json();

        if (avaliacoesData.success && avaliacoesData.data) {
          setAvaliacoes(avaliacoesData.data);
        } else {
          setAvaliacoes([]);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do funcionário:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    }

    if (funcionarioId) {
      loadFuncionario();
    }
  }, [funcionarioId]);

  return (
    <ManagerProtectedRoute>
      <MainLayout>
        <div className="space-y-8">
          <PageHeader
            title={t('avaliacao.funcionarios.detalhes', 'Detalhes do Funcionário')}
            description={t('avaliacao.funcionarios.detalhesDesc', 'Visualize informações e avaliações do funcionário')}
            icon={<FiUser className="w-8 h-8" />}
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

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                  {error.includes('ID inválido') && (
                    <p className="text-sm text-red-700 mt-1">
                      {t('avaliacao.redirectingToList', 'Redirecionando para a lista de funcionários em alguns segundos...')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
            </div>
          ) : funcionario ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Informações do Funcionário */}
              <div className="md:col-span-1">
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex flex-col items-center mb-6">
                    <div className="h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center text-2xl font-semibold mb-4">
                      {funcionario.first_name?.[0]}{funcionario.last_name?.[0]}
                    </div>
                    <h2 className="text-xl font-semibold text-center">
                      {funcionario.first_name} {funcionario.last_name}
                    </h2>
                    <p className="text-gray-500">{funcionario.position || 'Cargo não especificado'}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Email</h3>
                      <p className="mt-1">{funcionario.email || 'Não informado'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Departamento</h3>
                      <p className="mt-1">{funcionario.department || 'Não informado'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Função</h3>
                      <p className="mt-1">{funcionario.role || 'Não informado'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Status</h3>
                      <p className="mt-1">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${funcionario.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {funcionario.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Botão de Nova Avaliação - apenas para gerentes e administradores */}
                  {(user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                    <div className="mt-6">
                      <button
                        onClick={() => router.push(`/avaliacao/avaliacoes/nova?funcionarioId=${funcionario.id}`)}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
                      >
                        <FiBarChart2 className="mr-2 -ml-1 h-5 w-5" />
                        {t('avaliacao.novaAvaliacao', 'Nova Avaliação')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Histórico de Avaliações */}
              <div className="md:col-span-2">
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    {t('avaliacao.historicoAvaliacoes', 'Histórico de Avaliações')}
                  </h2>

                  {avaliacoes.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <FiFileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">
                        {t('avaliacao.semAvaliacoes', 'Este funcionário ainda não possui avaliações registradas.')}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avaliador</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pontuação</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {avaliacoes.map((avaliacao) => (
                            <tr key={avaliacao.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{avaliacao.periodo}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{new Date(avaliacao.data_inicio).toLocaleDateString()}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {/* Acessar o nome do avaliador através da relação */}
                                  {avaliacao.avaliador?.nome || `Avaliador ID: ${avaliacao.avaliador_id}`}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {avaliacao.pontuacao_total ? `${avaliacao.pontuacao_total.toFixed(1)}/5` : 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  avaliacao.status === 'concluída' ? 'bg-green-100 text-green-800' :
                                  avaliacao.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {avaliacao.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Link
                                  href={`/avaliacao/avaliacoes/${avaliacao.id}`}
                                  className="text-abz-blue hover:text-abz-blue-dark"
                                >
                                  Visualizar
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <FiUser className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">{t('avaliacao.funcionarioNaoEncontrado', 'Funcionário não encontrado')}</p>
            </div>
          )}
        </div>
      </MainLayout>
    </ManagerProtectedRoute>
  );
}
