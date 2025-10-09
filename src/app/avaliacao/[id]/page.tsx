'use client';

import React, { useState, useEffect, use } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiBarChart2, FiUser, FiCalendar, FiEdit, FiTrash, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import { useRouter } from 'next/navigation';

export default function AvaliacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params usando React.use()
  const { id } = use(params);
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const router = useRouter();
  const [avaliacao, setAvaliacao] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAvaliacao() {
      try {
        setLoading(true);
        setError(null);
        console.log('Carregando avaliação com ID:', id);

        // Verificar se o ID é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          console.error('ID inválido, não é um UUID válido:', id);
          setError(`ID inválido: "${id}". O ID deve ser um UUID válido.`);
          setLoading(false);

          // Redirecionar para a página de avaliações após um breve atraso
          setTimeout(() => {
            router.push('/avaliacao');
          }, 3000);

          return;
        }

        // Buscar avaliação da API
        const response = await fetch(`/api/avaliacao-desempenho/avaliacoes/${id}`, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        console.log('Resposta da API:', response.status);

        if (!response.ok) {
          console.error('Erro ao carregar avaliação:', response.status);
          setAvaliacao(null);
          setLoading(false);
          return;
        }

        const data = await response.json();
        console.log('Dados da avaliação recebidos:', data.success);

        if (data.success && data.data) {
          // Processar os dados para o formato esperado pelo componente
          const avaliacaoProcessada = {
            id: data.data.id,
            funcionario: data.data.funcionario,
            avaliador: data.data.avaliador,
            periodo: data.data.periodo,
            status: data.data.status,
            pontuacao: data.data.pontuacao_total,
            dataAvaliacao: data.data.data_inicio,
            dataProximaAvaliacao: data.data.data_fim,
            comentarios: data.data.observacoes,
            criterios: data.data.criterios || []
          };

          setAvaliacao(avaliacaoProcessada);
          console.log('Avaliação processada:', avaliacaoProcessada);
        } else {
          console.error('Dados da avaliação inválidos:', data);
          setAvaliacao(null);
        }
      } catch (error) {
        console.error('Erro ao carregar avaliação:', error);
        setAvaliacao(null);
      } finally {
        setLoading(false);
      }
    }

    loadAvaliacao();
  }, [id]);

  if (loading) {
    return (
      <ProtectedRoute managerOnly>
        <MainLayout>
          <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-abz-blue mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('common.loading')}</p>
          </div>
        </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  if (!avaliacao) {
    return (
      <ProtectedRoute managerOnly>
        <MainLayout>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || t('avaliacao.noAvaliacoes')}
            {error && error.includes('ID inválido') && (
              <p className="mt-2 text-sm">
                {t('avaliacao.redirectingToList', 'Redirecionando para a lista de avaliações em alguns segundos...')}
              </p>
            )}
          </div>
          <div className="mt-4">
            <Link href="/avaliacao" className="text-abz-blue hover:underline flex items-center">
              <FiArrowLeft className="mr-2" />
              {t('common.back')}
            </Link>
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute managerOnly>
      <MainLayout>
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/avaliacao/avaliacoes?t=${Date.now()}`} className="text-abz-blue hover:underline flex items-center">
          <FiArrowLeft className="mr-2" />
          {t('common.back')}
        </Link>
        <div className="flex space-x-2">
          <Link
            href={`/avaliacao/${avaliacao.id}/editar`}
            className="bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded flex items-center"
          >
            <FiEdit className="mr-2" />
            {t('avaliacao.editAvaliacao')}
          </Link>
          <button
            onClick={async () => {
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
                    // Adicionar timestamp para evitar cache
                    const timestamp = Date.now();
                    window.location.href = `/avaliacao/avaliacoes?t=${timestamp}`;
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
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded flex items-center"
          >
            <FiTrash className="mr-2" />
            {t('avaliacao.deleteAvaliacao')}
          </button>
        </div>
      </div>

      {/* Formato de PDF */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-4xl mx-auto border border-gray-200">
        {/* Cabeçalho do "PDF" */}
        <div className="bg-abz-blue text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FiBarChart2 className="w-10 h-10 mr-3" />
              <div>
                <h1 className="text-2xl font-bold">{t('avaliacao.avaliacaoDetails', 'Relatório de Avaliação de Desempenho')}</h1>
                <p className="text-blue-100 text-sm">ID: {avaliacao.id}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100">{t('avaliacao.dataEmissao', 'Data de Emissão')}:</p>
              <p className="font-medium">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Corpo do "PDF" */}
        <div className="p-8">
          {/* Seção de informações do funcionário e avaliador */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-b border-gray-200 pb-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center text-abz-blue">
                <FiUser className="mr-2" />
                {t('avaliacao.funcionario', 'Funcionário Avaliado')}
              </h2>
              <div className="space-y-3">
                <p className="flex">
                  <span className="font-medium w-32">{t('avaliacao.funcionarios.nome', 'Nome')}:</span>
                  <span className="flex-1">{avaliacao.funcionario.nome || t('common.naoInformado', 'Não informado')}</span>
                </p>
                <p className="flex">
                  <span className="font-medium w-32">{t('avaliacao.funcionarios.cargo', 'Cargo')}:</span>
                  <span className="flex-1">{avaliacao.funcionario.cargo || t('common.naoInformado', 'Não informado')}</span>
                </p>
                <p className="flex">
                  <span className="font-medium w-32">{t('avaliacao.funcionarios.departamento', 'Departamento')}:</span>
                  <span className="flex-1">{avaliacao.funcionario.departamento || t('common.naoInformado', 'Não informado')}</span>
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center text-abz-blue">
                <FiUser className="mr-2" />
                {t('avaliacao.avaliador', 'Avaliador')}
              </h2>
              <div className="space-y-3">
                <p className="flex">
                  <span className="font-medium w-32">{t('avaliacao.funcionarios.nome', 'Nome')}:</span>
                  <span className="flex-1">{avaliacao.avaliador.nome || t('common.naoInformado', 'Não informado')}</span>
                </p>
                <p className="flex">
                  <span className="font-medium w-32">{t('avaliacao.funcionarios.cargo', 'Cargo')}:</span>
                  <span className="flex-1">{avaliacao.avaliador.cargo || t('common.naoInformado', 'Não informado')}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Seção de informações da avaliação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 border-b border-gray-200 pb-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2 text-abz-blue">{t('avaliacao.periodo', 'Período')}</h2>
              <p className="text-lg">{avaliacao.periodo}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2 text-abz-blue">{t('avaliacao.status', 'Status')}</h2>
              <p>
                <span
                  className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                    avaliacao.status === 'concluida'
                      ? 'bg-green-100 text-green-800'
                      : avaliacao.status === 'pendente'
                      ? 'bg-yellow-100 text-yellow-800'
                      : avaliacao.status === 'em_andamento'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {avaliacao.status === 'pendente'
                    ? t('avaliacao.status.pendente', 'Pendente')
                    : avaliacao.status === 'em_andamento'
                    ? t('avaliacao.status.emAndamento', 'Em andamento')
                    : avaliacao.status === 'concluida'
                    ? t('avaliacao.status.concluida', 'Concluída')
                    : avaliacao.status === 'cancelada'
                    ? t('avaliacao.status.cancelada', 'Cancelada')
                    : avaliacao.status
                  }
                </span>
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2 text-abz-blue">{t('avaliacao.pontuacao', 'Pontuação')}</h2>
              <div className="flex items-center">
                <div className="text-3xl font-bold text-abz-blue">{avaliacao.pontuacao || 0}</div>
                <div className="text-gray-500 ml-2 text-lg">/ 5</div>
              </div>
            </div>
          </div>

          {/* Seção de datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-gray-200 pb-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2 flex items-center text-abz-blue">
                <FiCalendar className="mr-2" />
                {t('avaliacao.dataInicio', 'Data de Início')}
              </h2>
              <p className="text-lg">{new Date(avaliacao.dataAvaliacao).toLocaleDateString()}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2 flex items-center text-abz-blue">
                <FiCalendar className="mr-2" />
                {t('avaliacao.dataFim', 'Data de Fim')}
              </h2>
              <p className="text-lg">{new Date(avaliacao.dataProximaAvaliacao).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Seção de critérios */}
          <div className="mb-8 border-b border-gray-200 pb-8">
            <h2 className="text-xl font-semibold mb-4 text-abz-blue">{t('avaliacao.criterios', 'Critérios de Avaliação')}</h2>

            {avaliacao.criterios && avaliacao.criterios.length > 0 ? (
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('avaliacao.criterio.nome', 'Critério')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('avaliacao.criterio.categoria', 'Categoria')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('avaliacao.criterio.peso', 'Peso')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('avaliacao.criterio.nota', 'Nota')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.total', 'Total')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {avaliacao.criterios.map((criterio: any) => (
                      <tr key={criterio.id || criterio.criterioId}>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{criterio.nome}</div>
                          {criterio.descricao && (
                            <div className="text-sm text-gray-500 mt-1">{criterio.descricao}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {criterio.categoria || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {criterio.peso || 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-lg font-medium text-gray-900">{criterio.nota || 0}</span>
                            <span className="text-sm text-gray-500 ml-1">/ {criterio.notaMaxima || 5}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {((criterio.nota || 0) * (criterio.peso || 1)).toFixed(1)}
                        </td>
                      </tr>
                    ))}

                    {/* Linha de total */}
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="px-6 py-4 text-right font-medium">
                        {t('common.pontuacaoTotal', 'Pontuação Total')}:
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-abz-blue">
                        {avaliacao.pontuacao || 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-gray-500">{t('avaliacao.semCriterios', 'Nenhum critério de avaliação disponível.')}</p>
              </div>
            )}
          </div>

          {/* Seção de comentários */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-abz-blue">{t('avaliacao.observacoes', 'Observações')}</h2>
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 min-h-[100px]">
              {avaliacao.comentarios ? (
                <p className="whitespace-pre-line">{avaliacao.comentarios}</p>
              ) : (
                <p className="text-gray-400 italic">{t('avaliacao.semComentarios', 'Nenhuma observação registrada.')}</p>
              )}
            </div>
          </div>

          {/* Rodapé do "PDF" */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
            <p>{t('avaliacao.documentoConfidencial', 'Este documento é confidencial e de uso interno da empresa.')}</p>
            <p className="mt-1">{t('avaliacao.geradoEm', 'Gerado em')} {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </MainLayout>
    </ProtectedRoute>
  );
}
