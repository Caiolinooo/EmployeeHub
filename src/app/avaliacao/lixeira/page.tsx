'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/Layout/MainLayout';
import { FiSearch, FiAlertTriangle, FiArrowLeft, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

interface Avaliacao {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  status: string;
  created_at: string;
  deleted_at: string;
  funcionario_nome: string;
  avaliador_nome: string;
}

export default function LixeiraPage() {
  const { t } = useI18n();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvaliacoes = async () => {
      try {
        setLoading(true);

        // Buscar avaliações que estão na lixeira (deleted_at não é null)
        const { data, error } = await supabase
          .from('avaliacoes')
          .select(`
            *,
            funcionario:funcionario_id(id, nome, email),
            avaliador:avaliador_id(id, nome, email)
          `)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });

        if (error) {
          throw error;
        }

        // Formatar dados
        const avaliacoesFormatadas = data.map(item => ({
          id: item.id,
          funcionario_id: item.funcionario_id,
          avaliador_id: item.avaliador_id,
          periodo: item.periodo || 'N/A',
          status: item.status || 'archived',
          created_at: item.created_at,
          deleted_at: item.deleted_at,
          funcionario_nome: item.funcionario ? item.funcionario.nome || 'Desconhecido' : 'Desconhecido',
          avaliador_nome: item.avaliador ? item.avaliador.nome || 'Desconhecido' : 'Desconhecido'
        }));

        setAvaliacoes(avaliacoesFormatadas);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar avaliações da lixeira:', err);
        setError(t('avaliacao.trash.loadError', 'Ocorreu um erro ao carregar as avaliações da lixeira. Por favor, tente novamente.'));
        setLoading(false);
      }
    };

    fetchAvaliacoes();
  }, []);

  // Filtrar avaliações com base no termo de pesquisa
  const filteredAvaliacoes = avaliacoes.filter(avaliacao =>
    avaliacao.avaliador_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avaliacao.funcionario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    avaliacao.periodo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Função para restaurar uma avaliação
  const handleRestore = async (id: string) => {
    if (!confirm(t('avaliacao.trash.confirmRestore', 'Tem certeza que deseja restaurar esta avaliação?'))) {
      return;
    }

    try {
      setRestoreLoading(id);

      // Atualizar o campo deleted_at para null
      const { error } = await supabase
        .from('avaliacoes')
        .update({
          deleted_at: null,
          status: 'pending' // Restaurar com status pendente
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Remover a avaliação da lista
      setAvaliacoes(prev => prev.filter(avaliacao => avaliacao.id !== id));

      // Mostrar mensagem de sucesso
      setSuccessMessage(t('avaliacao.trash.restoreSuccess', 'Avaliação restaurada com sucesso!'));

      // Limpar mensagem após 3 segundos
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

    } catch (err) {
      console.error('Erro ao restaurar avaliação:', err);
      alert(t('avaliacao.trash.restoreError', 'Ocorreu um erro ao restaurar a avaliação. Por favor, tente novamente.'));
    } finally {
      setRestoreLoading(null);
    }
  };

  // Função para excluir permanentemente uma avaliação
  const handleDelete = async (id: string) => {
    if (!confirm(t('avaliacao.trash.confirmDelete', 'Tem certeza que deseja excluir permanentemente esta avaliação? Esta ação não pode ser desfeita.'))) {
      return;
    }

    try {
      setDeleteLoading(id);

      // Excluir a avaliação permanentemente
      const { error } = await supabase
        .from('avaliacoes')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Remover a avaliação da lista
      setAvaliacoes(prev => prev.filter(avaliacao => avaliacao.id !== id));

      // Mostrar mensagem de sucesso
      setSuccessMessage(t('avaliacao.trash.deleteSuccess', 'Avaliação excluída permanentemente!'));

      // Limpar mensagem após 3 segundos
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

    } catch (err) {
      console.error('Erro ao excluir avaliação permanentemente:', err);
      alert(t('avaliacao.trash.deleteError', 'Ocorreu um erro ao excluir a avaliação. Por favor, tente novamente.'));
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/avaliacao" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            <FiArrowLeft className="mr-2" /> {t('avaliacao.trash.backToList', 'Voltar para a lista')}
          </Link>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{t('avaliacao.trash.title', 'Lixeira de Avaliações')}</h1>
        </div>

        {/* Mensagem de sucesso */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-6">
            <p>{successMessage}</p>
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
              placeholder={t('avaliacao.trash.searchPlaceholder', 'Pesquisar avaliações na lixeira...')}
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
          </div>
        ) : filteredAvaliacoes.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 p-6 rounded-md text-center">
            <p className="text-lg">{t('avaliacao.trash.empty', 'Nenhuma avaliação na lixeira.')}</p>
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
                    {t('avaliacao.trash.deletedAt', 'Excluído em')}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(avaliacao.deleted_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleRestore(avaliacao.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title={t('avaliacao.trash.restore', 'Restaurar')}
                          disabled={restoreLoading === avaliacao.id}
                        >
                          {restoreLoading === avaliacao.id ? (
                            <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-blue-600 rounded-full"></div>
                          ) : (
                            <FiRefreshCw className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(avaliacao.id)}
                          className="text-red-600 hover:text-red-900"
                          title={t('avaliacao.trash.deletePermanently', 'Excluir permanentemente')}
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

