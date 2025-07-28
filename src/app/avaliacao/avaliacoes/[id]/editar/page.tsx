'use client';

import React, { useState, useEffect, use } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiSave, FiArrowLeft, FiUser, FiCalendar } from 'react-icons/fi';
import Link from 'next/link';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import ManagerProtectedRoute from '@/components/Auth/ManagerProtectedRoute';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { fetchWithToken } from '@/lib/tokenStorage';
import StarRating from '@/components/StarRating';
import CriterioAvaliacao from '@/components/CriterioAvaliacao';

// Interfaces para tipos
interface Criterio {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  peso?: number;
  nota?: number;
  comentario?: string;
}

interface Funcionario {
  id: string;
  nome: string;
  email: string;
  cargo?: string;
}

interface Avaliacao {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  criterios: Criterio[];
  [key: string]: any;
}

export default function EditarAvaliacaoPage({ params }: { params: { id: string } }) {
  // Usar React.use para evitar o aviso de acesso direto a params
  const id = React.use(Promise.resolve(params.id));
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const router = useRouter();

  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [avaliadores, setAvaliadores] = useState<Funcionario[]>([]);
  const [criterios, setCriterios] = useState<Criterio[]>([]);

  // Verificar se o usuário logado é o avaliador da avaliação
  useEffect(() => {
    if (user && user.id && avaliacao && avaliacao.avaliador_id && user.id !== avaliacao.avaliador_id) {
      console.log('Usuário logado não é o avaliador desta avaliação');
      setError('Você só pode editar avaliações onde você é o avaliador.');
    }
  }, [user, avaliacao]);

  // Carregar avaliação
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
            router.push('/avaliacao/avaliacoes');
          }, 3000);

          return;
        }

        // Buscar avaliação da API
        const response = await fetchWithToken(`/api/avaliacao-desempenho/avaliacoes/${id}`);

        if (!response.ok) {
          console.error('Erro ao carregar avaliação:', response.status);
          setError(`Erro ao carregar avaliação: ${response.status}`);
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (data.success && data.data) {
          // Processar os dados para o formato esperado pelo formulário
          const avaliacaoProcessada = {
            id: data.data.id,
            funcionario_id: data.data.funcionario_id,
            avaliador_id: data.data.avaliador_id,
            periodo: data.data.periodo,
            status: data.data.status,
            pontuacao_total: data.data.pontuacao_total,
            data_inicio: data.data.data_inicio,
            data_fim: data.data.data_fim,
            observacoes: data.data.observacoes,
            criterios: data.data.criterios || []
          };

          setAvaliacao(avaliacaoProcessada);
          console.log('Avaliação carregada:', avaliacaoProcessada);
        } else {
          console.error('Dados da avaliação inválidos:', data);
          setError('Avaliação não encontrada ou dados inválidos');
        }
      } catch (error) {
        console.error('Erro ao carregar avaliação:', error);
        setError('Erro ao carregar avaliação. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    }

    loadAvaliacao();
  }, [id]);

  // Carregar funcionários e avaliadores
  useEffect(() => {
    async function loadFuncionariosEAvaliadores() {
      try {
        console.log('Carregando funcionários e avaliadores...');

        // Buscar funcionários usando a API
        const funcionariosResponse = await fetchWithToken('/api/avaliacao-desempenho/usuarios?purpose=funcionarios');

        if (!funcionariosResponse.ok) {
          console.error('Erro ao carregar funcionários:', funcionariosResponse.status);
        } else {
          const funcionariosResult = await funcionariosResponse.json();
          if (funcionariosResult.success) {
            console.log('Funcionários carregados:', funcionariosResult.data?.length || 0);
            setFuncionarios(funcionariosResult.data || []);
          } else {
            console.error('API retornou erro ao carregar funcionários:', funcionariosResult.error);
          }
        }

        // Buscar avaliadores (gerentes) usando a API
        const avaliadoresResponse = await fetchWithToken('/api/avaliacao-desempenho/usuarios?purpose=avaliadores');

        if (!avaliadoresResponse.ok) {
          console.error('Erro ao carregar avaliadores:', avaliadoresResponse.status);
        } else {
          const avaliadoresResult = await avaliadoresResponse.json();
          if (avaliadoresResult.success) {
            console.log('Avaliadores carregados:', avaliadoresResult.data?.length || 0);
            setAvaliadores(avaliadoresResult.data || []);
          } else {
            console.error('API retornou erro ao carregar avaliadores:', avaliadoresResult.error);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    }

    loadFuncionariosEAvaliadores();
  }, []);

  // Carregar critérios
  useEffect(() => {
    async function loadCriterios() {
      try {
        console.log('Carregando critérios de avaliação...');
        const response = await fetchWithToken('/api/avaliacao-desempenho/criterios');

        if (!response.ok) {
          console.error('Erro ao carregar critérios:', response.status);
          return;
        }

        const data = await response.json();
        console.log('Resposta da API de critérios:', data);

        if (data.success && data.data) {
          console.log(`Critérios carregados com sucesso: ${data.data.length} critérios`);
          setCriterios(data.data);
        } else {
          console.error('API retornou sucesso=false ou dados vazios:', data);
        }
      } catch (error) {
        console.error('Erro ao carregar critérios:', error);
      }
    }

    loadCriterios();
  }, []);

  // Função para atualizar um campo da avaliação
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAvaliacao((prev: Avaliacao | null) => prev ? ({ ...prev, [name]: value }) : null);
  };

  // Função para atualizar a nota e comentário de um critério
  const handleCriterioChange = (criterioId: string, nota: number, comentario: string) => {
    console.log('Atualizando avaliação do critério:', {
      criterioId,
      nota,
      comentario: comentario ? 'Preenchido' : 'Vazio'
    });

    setAvaliacao((prev: Avaliacao | null) => {
      if (!prev) return null;

      // Se não houver critérios, criar um array vazio
      if (!prev.criterios) {
        prev.criterios = [];
      }

      // Verificar se o critério já existe na lista
      const criterioExistente = prev.criterios.find((c: any) =>
        (c.criterioId === criterioId || c.id === criterioId || c.criterio_id === criterioId)
      );

      if (criterioExistente) {
        // Atualizar critério existente
        return {
          ...prev,
          criterios: prev.criterios.map((c: any) =>
            (c.criterioId === criterioId || c.id === criterioId || c.criterio_id === criterioId)
              ? { ...c, nota: nota, comentario: comentario }
              : c
          )
        };
      } else {
        // Adicionar novo critério
        const novoCriterio = {
          id: `temp-${Date.now()}`,
          criterioId: criterioId,
          criterio_id: criterioId,
          nota: nota,
          comentario: comentario,
          // Buscar informações do critério na lista de critérios
          ...criterios.find(c => c.id === criterioId)
        };

        return {
          ...prev,
          criterios: [...prev.criterios, novoCriterio]
        };
      }
    });
  };

  // Função para salvar a avaliação
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);

      // Garantir que o avaliador seja sempre o usuário logado
      const avaliacaoAtualizada = {
        ...avaliacao,
        avaliador_id: user?.id || avaliacao?.avaliador_id // Forçar o ID do usuário logado
      };

      console.log('Salvando avaliação:', avaliacaoAtualizada);

      // Enviar dados para a API
      const response = await fetchWithToken(`/api/avaliacao-desempenho/avaliacoes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(avaliacaoAtualizada)
      });

      if (!response.ok) {
        console.error('Erro ao salvar avaliação:', response.status);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao salvar avaliação: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        alert(t('avaliacao.saveSuccess', 'Avaliação salva com sucesso!'));
        // Redirecionar para a página de avaliações com timestamp para evitar cache
        const timestamp = Date.now();
        window.location.href = `/avaliacao/avaliacoes?t=${timestamp}`;
      } else {
        throw new Error(data.error || 'Erro ao salvar avaliação');
      }
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
      setError(error instanceof Error ? error.message : 'Erro ao salvar avaliação');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ManagerProtectedRoute>
        <MainLayout>
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-abz-blue mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('common.loading')}</p>
            </div>
          </div>
        </MainLayout>
      </ManagerProtectedRoute>
    );
  }

  if (!avaliacao) {
    return (
      <ManagerProtectedRoute>
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
            <Link href="/avaliacao/avaliacoes" className="text-abz-blue hover:underline flex items-center">
              <FiArrowLeft className="mr-2" />
              {t('common.back')}
            </Link>
          </div>
        </MainLayout>
      </ManagerProtectedRoute>
    );
  }

  return (
    <ManagerProtectedRoute>
      <MainLayout>
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/avaliacao/${id}?t=${Date.now()}`} className="text-abz-blue hover:underline flex items-center">
            <FiArrowLeft className="mr-2" />
            {t('common.back')}
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded flex items-center disabled:opacity-50"
          >
            <FiSave className="mr-2" />
            {saving ? t('common.saving', 'Salvando...') : t('common.save', 'Salvar')}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-abz-blue text-white p-6">
            <h1 className="text-2xl font-bold">{t('avaliacao.editAvaliacao', 'Editar Avaliação')}</h1>
            <p className="text-blue-100">ID: {avaliacao.id}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.funcionario')}
                </label>
                <select
                  name="funcionario_id"
                  value={avaliacao.funcionario_id}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-abz-blue focus:ring-abz-blue sm:text-sm"
                  required
                >
                  <option value="">{t('common.select')}</option>
                  {funcionarios.map(funcionario => (
                    <option key={funcionario.id || (funcionario as any).funcionario_id} value={funcionario.id || (funcionario as any).funcionario_id}>
                      {funcionario.nome || 'Não informado'} - {funcionario.cargo || 'Não informado'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.avaliador')}
                </label>
                {/* Campo de texto somente leitura mostrando o gerente logado */}
                <div className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-gray-700 sm:text-sm">
                  {avaliadores.find(a => a.id === user?.id)?.nome ||
                   (user ? `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() : 'Gerente atual')}
                </div>
                <input
                  type="hidden"
                  name="avaliador_id"
                  value={user?.id || avaliacao.avaliador_id}
                />
                <p className="mt-1 text-sm text-gray-500">
                  {t('avaliacao.avaliacaoGerenteLogado', 'Você está editando esta avaliação como gerente avaliador')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.periodo')} *
                </label>
                <input
                  type="text"
                  name="periodo"
                  value={avaliacao.periodo}
                  onChange={handleChange}
                  placeholder="Ex: 2023-1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-abz-blue focus:ring-abz-blue sm:text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.dataInicio')}
                </label>
                <input
                  type="date"
                  name="data_inicio"
                  value={avaliacao.data_inicio ? avaliacao.data_inicio.substring(0, 10) : ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-abz-blue focus:ring-abz-blue sm:text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.dataFim')}
                </label>
                <input
                  type="date"
                  name="data_fim"
                  value={avaliacao.data_fim ? avaliacao.data_fim.substring(0, 10) : ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-abz-blue focus:ring-abz-blue sm:text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.status')} *
              </label>
              <select
                name="status"
                value={avaliacao.status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-abz-blue focus:ring-abz-blue sm:text-sm"
                required
              >
                <option value="pendente">{t('avaliacao.status.pendente', 'Pendente')}</option>
                <option value="em_andamento">{t('avaliacao.status.emAndamento', 'Em andamento')}</option>
                <option value="concluida">{t('avaliacao.status.concluida', 'Concluída')}</option>
                <option value="cancelada">{t('avaliacao.status.cancelada', 'Cancelada')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.observacoes')}
              </label>
              <textarea
                name="observacoes"
                value={avaliacao.observacoes || ''}
                onChange={handleChange}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-abz-blue focus:ring-abz-blue sm:text-sm"
              />
            </div>

            {/* Critérios de avaliação */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-3">{t('avaliacao.criterios')}</h2>

              {/* Mostrar critérios da avaliação ou critérios padrão */}
              {avaliacao.criterios && avaliacao.criterios.length > 0 ? (
                <div className="space-y-4">
                  {avaliacao.criterios.map((criterio: any) => (
                    <CriterioAvaliacao
                      key={criterio.id || criterio.criterioId || criterio.criterio_id}
                      id={criterio.criterioId || criterio.criterio_id || criterio.id}
                      nome={criterio.nome}
                      descricao={criterio.descricao || ''}
                      categoria={criterio.categoria || ''}
                      peso={criterio.peso || 1}
                      notaMaxima={criterio.notaMaxima || criterio.pontuacao_maxima || 5}
                      initialNota={criterio.nota || criterio.valor || 0}
                      initialComentario={criterio.comentario || criterio.observacao || ''}
                      onChange={handleCriterioChange}
                      readOnly={saving}
                    />
                  ))}
                </div>
              ) : criterios && criterios.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                    <p className="text-yellow-700">{t('avaliacao.useCriterios', 'Nenhum critério encontrado para esta avaliação. Selecione os critérios abaixo para avaliar.')}</p>
                  </div>

                  {/* Agrupar critérios por categoria */}
                  {Object.entries(
                    criterios.reduce((acc, criterio) => {
                      const categoria = criterio.categoria || 'Sem categoria';
                      if (!acc[categoria]) acc[categoria] = [];
                      acc[categoria].push(criterio);
                      return acc;
                    }, {} as Record<string, any[]>)
                  ).map(([categoria, criteriosCategoria]) => (
                    <div key={categoria} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700">
                        {categoria}
                      </div>
                      <div className="p-4 space-y-4">
                        {(criteriosCategoria as any[]).map((criterio: any) => (
                          <CriterioAvaliacao
                            key={criterio.id}
                            id={criterio.id}
                            nome={criterio.nome}
                            descricao={criterio.descricao || ''}
                            categoria={criterio.categoria || ''}
                            peso={criterio.peso || 1}
                            notaMaxima={criterio.pontuacao_maxima || 5}
                            initialNota={0}
                            initialComentario={''}
                            onChange={handleCriterioChange}
                            readOnly={saving}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-gray-500">{t('avaliacao.noCriterios', 'Nenhum critério encontrado para esta avaliação.')}</p>
                </div>
              )}
            </div>
          </div>
        </form>
      </MainLayout>
    </ManagerProtectedRoute>
  );
}
