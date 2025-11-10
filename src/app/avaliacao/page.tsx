'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/Layout/MainLayout';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiAlertTriangle, FiBarChart2 } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from 'react-hot-toast';

// Tipo para avaliação
interface Avaliacao {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  status: string;
  created_at: string;
  updated_at?: string;
  funcionario_nome?: string;
  funcionario_email?: string;
  avaliador_nome?: string;
  avaliador_email?: string;
}

export default function AvaliacaoPage() {
  const router = useRouter();
  const { user, isAdmin, isManager, hasEvaluationAccess, hasAccess, profile, isLoading } = useSupabaseAuth();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null); // ID da avaliação sendo excluída
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null); // Mensagem de sucesso

  // Verificar se o usuário tem acesso ao módulo de avaliação
  useEffect(() => {
    // Aguardar o carregamento completo da autenticação
    if (isLoading) {
      console.log('🔄 Aguardando carregamento da autenticação...');
      return;
    }

    // Verificar se o usuário está autenticado
    if (!user) {
      console.log('❌ Usuário não autenticado, redirecionando para login');
      router.push('/login');
      return;
    }

    // Para o módulo de avaliação, permitir acesso para todos os usuários autenticados
    console.log('✅ Usuário autenticado, permitindo acesso ao módulo de avaliação:', {
      userId: user.id,
      email: user.email
    });
  }, [router, user, isLoading]);

  // Estado para verificação de tabelas
  const [tablesChecked, setTablesChecked] = useState(false);
  const [tablesExist, setTablesExist] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);

  // Verificar se as tabelas existem
  useEffect(() => {
    const checkTables = async () => {
      try {
        console.log('Verificando tabelas do módulo de avaliação...');
        const response = await fetch('/api/avaliacao/check-tables');

        if (!response.ok) {
          throw new Error(`Erro ao verificar tabelas: ${response.status}`);
        }

        const data = await response.json();
        console.log('Resultado da verificação de tabelas:', data);

        if (data.success) {
          const allTablesExist = Object.values(data.tables).every((table: any) => table.exists);
          setTablesExist(allTablesExist);

          if (!allTablesExist) {
            const missingTables = Object.entries(data.tables)
              .filter(([_, tableInfo]: [string, any]) => !tableInfo.exists)
              .map(([tableName]: [string, any]) => tableName)
              .join(', ');

            setTablesError(`Tabelas não encontradas: ${missingTables}`);
          }
        } else {
          setTablesExist(false);
          setTablesError(data.error || 'Erro desconhecido ao verificar tabelas');
        }

        setTablesChecked(true);
      } catch (err) {
        console.error('Erro ao verificar tabelas:', err);
        setTablesExist(false);
        setTablesError(err instanceof Error ? err.message : 'Erro desconhecido');
        setTablesChecked(true);
      }
    };

    checkTables();
  }, []);

  useEffect(() => {
    // Verificar se o usuário está autenticado antes de buscar dados
    if (!user) {
      console.log('Usuário não autenticado, não buscando avaliações');
      return;
    }

    // Verificar se as tabelas foram verificadas
    if (!tablesChecked) {
      console.log('Aguardando verificação de tabelas...');
      return;
    }

    // Verificar se as tabelas existem
    if (!tablesExist) {
      console.error('Tabelas necessárias não existem:', tablesError);
      setError(`Erro de configuração do banco de dados: ${tablesError}`);
      setLoading(false);
      return;
    }

    const fetchAvaliacoes = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Iniciando busca de avaliações...');
        console.log('Verificando permissões:', { isAdmin, isManager, hasEvaluationAccess });

        // Buscar diretamente da tabela avaliacoes_desempenho (nome correto)
        console.log('Buscando avaliações na tabela avaliacoes_desempenho...');
        let query = supabase
          .from('avaliacoes_desempenho')
          .select(`
            *,
            funcionario:funcionarios!avaliacoes_desempenho_funcionario_id_fkey(id, nome, email),
            avaliador:funcionarios!avaliacoes_desempenho_avaliador_id_fkey(id, nome, email)
          `)
          .is('deleted_at', null);

        // Filtrar por usuário se não for admin ou manager
        if (!isAdmin && !isManager) {
          console.log('Filtrando avaliações para usuário comum:', user?.id);
          query = query.eq('funcionario_id', user?.id || '');
        }

        const { data: avaliacoes, error: avaliacoesError } = await query
          .order('created_at', { ascending: false });

        if (avaliacoesError) {
          console.error('Erro ao buscar avaliações:', avaliacoesError);
          throw avaliacoesError;
        }

        console.log('Avaliações encontradas:', avaliacoes?.length || 0);

        if (!avaliacoes || avaliacoes.length === 0) {
          console.log('Nenhuma avaliação encontrada');
          setAvaliacoes([]);
          setLoading(false);
          return;
        }

        // Log para debug
        console.log('Exemplo de avaliação:', avaliacoes[0]);

        // Formatar dados de forma simples
        const avaliacoesFormatadas = avaliacoes.map(item => {
          // Obter nomes do funcionário e avaliador
          let funcionarioNome = 'Desconhecido';
          let avaliadorNome = 'Desconhecido';
          let funcionarioEmail = null;
          let avaliadorEmail = null;

          // Verificar se temos dados do funcionário
          if (item.funcionario) {
            funcionarioNome = item.funcionario.nome || 'Desconhecido';
            funcionarioEmail = item.funcionario.email || null;
          }

          // Verificar se temos dados do avaliador
          if (item.avaliador) {
            avaliadorNome = item.avaliador.nome || 'Desconhecido';
            avaliadorEmail = item.avaliador.email || null;
          }

          return {
            id: item.id,
            funcionario_id: item.funcionario_id,
            avaliador_id: item.avaliador_id,
            periodo: item.periodo || 'N/A',
            status: item.status || 'pending',
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at,
            funcionario_nome: funcionarioNome,
            funcionario_email: funcionarioEmail,
            avaliador_nome: avaliadorNome,
            avaliador_email: avaliadorEmail
          };
        });

        console.log('Avaliações formatadas:', avaliacoesFormatadas.length);
        setAvaliacoes(avaliacoesFormatadas);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar avaliações:', err);

        // Mostrar informações mais detalhadas sobre o erro
        let errorMessage = 'Ocorreu um erro ao carregar as avaliações. Por favor, tente novamente.';

        if (err instanceof Error) {
          errorMessage += ' Detalhes: ' + err.message;
        } else if (typeof err === 'object' && err !== null) {
          errorMessage += ' Detalhes: ' + JSON.stringify(err);
        }

        setError(errorMessage);
        setLoading(false);
      }
    };

    fetchAvaliacoes();
  }, [isAdmin, isManager, hasEvaluationAccess, tablesChecked, tablesExist, tablesError]);

  // Filtrar avaliações com base no termo de pesquisa
  const filteredAvaliacoes = avaliacoes.filter(avaliacao =>
    avaliacao.avaliador_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avaliacao.funcionario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avaliacao.periodo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avaliacao.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Função para traduzir o status usando o sistema de tradução
  const { t } = useI18n();
  const traduzirStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return t('avaliacao.status.pending', 'Pendente');
      case 'in_progress': return t('avaliacao.status.inProgress', 'Em Progresso');
      case 'completed': return t('avaliacao.status.completed', 'Concluída');
      case 'archived': return t('avaliacao.status.archived', 'Arquivada');
      default: return status;
    }
  };

  // Função para obter a cor do status
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para mover uma avaliação para a lixeira
  const handleMoveToTrash = async (id: string) => {
    if (!confirm(t('avaliacao.confirmMoveToTrash', 'Tem certeza que deseja mover esta avaliação para a lixeira? Ela será excluída permanentemente após 30 dias.'))) {
      return;
    }

    try {
      setDeleteLoading(id);

      // Atualizar o campo deleted_at para a data atual
      const { error } = await supabase
        .from('avaliacoes_desempenho')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'arquivada' // Também marcar como arquivada
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Atualizar a lista de avaliações (remover a avaliação excluída)
      setAvaliacoes(prev => prev.filter(avaliacao => avaliacao.id !== id));

      // Mostrar mensagem de sucesso
      setDeleteSuccess(t('avaliacao.movedToTrashSuccess', 'Avaliação movida para a lixeira com sucesso!'));

      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => {
        setDeleteSuccess(null);
      }, 3000);

    } catch (err) {
      console.error('Erro ao mover avaliação para a lixeira:', err);
      alert(t('avaliacao.moveToTrashError', 'Ocorreu um erro ao mover a avaliação para a lixeira. Por favor, tente novamente.'));
    } finally {
      setDeleteLoading(null);
    }
  };

  // Mostrar loading enquanto a autenticação está carregando
  if (isLoading || !user || !profile) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isAdmin || isManager
                ? t('avaliacao.avaliacoes.title', 'Lista de Avaliações')
                : t('avaliacao.minhasAvaliacoes.title', 'Minhas Avaliações')
              }
            </h1>
            {!isAdmin && !isManager && (
              <p className="text-gray-600 mt-1">
                {t('avaliacao.minhasAvaliacoes.description', 'Visualize suas avaliações de desempenho')}
              </p>
            )}
          </div>
          {(isAdmin || isManager) && (
            <div className="flex space-x-2">
              <Link href="/avaliacao/lixeira" className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md flex items-center">
                <FiTrash2 className="mr-2" /> {t('avaliacao.trashLink', 'Lixeira')}
              </Link>
              <Link href="/avaliacao/nova" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center">
                <FiPlus className="mr-2" /> {t('avaliacao.novaAvaliacao', 'Nova Avaliação')}
              </Link>
            </div>
          )}
        </div>

        {/* Mensagem de sucesso */}
        {deleteSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-6">
            <p>{deleteSuccess}</p>
          </div>
        )}

        {/* Barra de pesquisa */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder={t('avaliacao.searchPlaceholder', 'Pesquisar avaliações...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-md">
            <div className="flex items-center mb-2">
              <FiAlertTriangle className="h-5 w-5 mr-2" />
              <h3 className="text-lg font-medium">{t('common.error', 'Erro')}</h3>
            </div>
            <p>{error}</p>

            {/* Mostrar botão para criar tabelas se o erro for relacionado a tabelas */}
            {error.includes('banco de dados') && isAdmin && (
              <div className="mt-4">
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const response = await fetch('/api/avaliacao/create-tables', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        }
                      });

                      if (!response.ok) {
                        throw new Error(`Erro ao criar tabelas: ${response.status}`);
                      }

                      const data = await response.json();
                      if (data.success) {
                        alert('Tabelas criadas com sucesso! A página será recarregada.');
                        window.location.reload();
                      } else {
                        alert(`Erro ao criar tabelas: ${data.error}`);
                      }
                    } catch (err) {
                      console.error('Erro ao criar tabelas:', err);
                      alert(`Erro ao criar tabelas: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Criar Tabelas Necessárias
                </button>
              </div>
            )}
          </div>
        ) : filteredAvaliacoes.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 p-8 rounded-md text-center">
            <FiBarChart2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isAdmin || isManager
                ? t('avaliacao.noAvaliacoes', 'Nenhuma avaliação encontrada')
                : t('avaliacao.noMinhasAvaliacoes', 'Você ainda não possui avaliações')
              }
            </h3>
            <p className="text-gray-500">
              {isAdmin || isManager
                ? t('avaliacao.noAvaliacoesDesc', 'Nenhuma avaliação foi criada ainda. Clique em "Nova Avaliação" para começar.')
                : t('avaliacao.noMinhasAvaliacoesDesc', 'Suas avaliações de desempenho aparecerão aqui quando forem criadas pelos seus supervisores.')
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.avaliador', 'Avaliador')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.funcionario', 'Funcionário')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.periodo', 'Período')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.status.title', 'Status')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.createdAt', 'Data de Criação')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('avaliacao.actions', 'Ações')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAvaliacoes.map((avaliacao) => (
                  <tr key={avaliacao.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{avaliacao.avaliador_nome}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{avaliacao.funcionario_nome}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{avaliacao.periodo}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(avaliacao.status)}`}>
                        {traduzirStatus(avaliacao.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(avaliacao.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link href={`/avaliacao/ver/${avaliacao.id}?source=list`} className="text-blue-600 hover:text-blue-900" title="Visualizar">
                          <FiEye className="h-5 w-5" />
                        </Link>
                        <Link href={`/avaliacao/editar/${avaliacao.id}?source=list`} className="text-green-600 hover:text-green-900" title="Editar">
                          <FiEdit className="h-5 w-5" />
                        </Link>
                        <button
                          onClick={() => handleMoveToTrash(avaliacao.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Mover para a lixeira"
                          disabled={deleteLoading === avaliacao.id}
                        >
                          {deleteLoading === avaliacao.id ? (
                            <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-red-600 rounded-full"></div>
                          ) : (
                            <FiTrash2 className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

