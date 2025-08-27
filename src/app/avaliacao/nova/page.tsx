'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/Layout/MainLayout';
import { FiSave, FiX, FiArrowLeft, FiPlus } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import CriterioAvaliacao from '@/components/CriterioAvaliacao';
import { criteriosPadrao, CriterioAvaliacao as ICriterioAvaliacao } from '@/data/criterios-avaliacao';
import { fetchWithToken } from '@/lib/tokenStorage';

interface Funcionario {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  user_id: string;
  users: {
    id: string;
    role: string;
  };
}

export default function NovaAvaliacaoPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [avaliadores, setAvaliadores] = useState<Funcionario[]>([]);
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(true);
  const [criterios, setCriterios] = useState<ICriterioAvaliacao[]>([]);
  const [loadingCriterios, setLoadingCriterios] = useState(true);
  const [criteriosAvaliacao, setCriteriosAvaliacao] = useState<Array<{
    criterioId: string;
    nota: number;
    comentario: string;
    nome?: string;
    descricao?: string;
    categoria?: string;
    peso?: number;
  }>>([]);

  // Estado do formulário
  const [formData, setFormData] = useState({
    avaliador_id: '',
    funcionario_id: '', // Alterado de avaliado_id para funcionario_id
    periodo: '',
    status: 'pendente',
    observacoes: ''
  });

  // Carregar funcionários e avaliadores
  useEffect(() => {
    const fetchFuncionarios = async () => {
      try {
        setLoadingFuncionarios(true);

        // Buscar todos os funcionários da tabela funcionarios
        const { data, error } = await supabase
          .from('funcionarios')
          .select(`
            id,
            nome,
            email,
            cargo,
            user_id,
            users:user_id (id, role)
          `)
          .is('deleted_at', null)
          .order('nome', { ascending: true });

        if (error) {
          throw error;
        }

        // Separar avaliadores (gerentes e admins) dos funcionários comuns
        const todosFuncionarios = data || [];
        const apenasAvaliadores = todosFuncionarios.filter((f: any) =>
          f.users?.role === 'ADMIN' || f.users?.role === 'MANAGER'
        );

        setFuncionarios(todosFuncionarios as any);
        setAvaliadores(apenasAvaliadores as any);
        setLoadingFuncionarios(false);
      } catch (err) {
        console.error('Erro ao carregar funcionários:', err);
        setError(t('avaliacao.nova.loadFuncionariosError', 'Ocorreu um erro ao carregar os funcionários. Por favor, tente novamente.'));
        setLoadingFuncionarios(false);
      }
    };

    fetchFuncionarios();
  }, []);

  // Carregar critérios de avaliação
  useEffect(() => {
    const fetchCriterios = async () => {
      try {
        setLoadingCriterios(true);
        console.log('Carregando critérios de avaliação...');

        // Tentar carregar critérios do banco de dados
        try {
          const response = await fetchWithToken('/api/avaliacao-desempenho/criterios');

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
              console.log('Critérios carregados do banco de dados:', result.data.length);
              setCriterios(result.data);
              setLoadingCriterios(false);
              return;
            }
          }
        } catch (apiError) {
          console.error('Erro ao carregar critérios da API:', apiError);
        }

        // Se não conseguiu carregar do banco, usar os critérios padrão
        console.log('Usando critérios padrão');
        setCriterios(criteriosPadrao);
        setLoadingCriterios(false);
      } catch (err) {
        console.error('Erro ao carregar critérios:', err);
        // Em caso de erro, usar os critérios padrão
        setCriterios(criteriosPadrao);
        setLoadingCriterios(false);
      }
    };

    fetchCriterios();
  }, []);

  // Inicializar critérios de avaliação quando os critérios forem carregados
  useEffect(() => {
    if (criterios.length > 0 && criteriosAvaliacao.length === 0) {
      // Inicializar os critérios de avaliação com os critérios carregados
      const initialCriterios = criterios.map(criterio => ({
        criterioId: criterio.id,
        nota: 0,
        comentario: '',
        nome: criterio.nome,
        descricao: criterio.descricao,
        categoria: criterio.categoria,
        peso: criterio.peso
      }));

      setCriteriosAvaliacao(initialCriterios);
    }
  }, [criterios, criteriosAvaliacao.length]);

  // Manipular mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Manipular mudanças nos critérios
  const handleCriterioChange = (id: string, nota: number, comentario: string) => {
    setCriteriosAvaliacao(prev =>
      prev.map(criterio =>
        criterio.criterioId === id
          ? { ...criterio, nota, comentario }
          : criterio
      )
    );
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Validar campos obrigatórios
      if (!formData.avaliador_id || !formData.funcionario_id || !formData.periodo) {
        setError(t('avaliacao.nova.requiredFieldsError', 'Por favor, preencha todos os campos obrigatórios.'));
        setLoading(false);
        return;
      }

      // Preparar dados para envio
      const avaliacaoData = {
        avaliador_id: formData.avaliador_id,
        funcionario_id: formData.funcionario_id,
        periodo: formData.periodo,
        status: formData.status,
        observacoes: formData.observacoes,
        criterios: criteriosAvaliacao
      };

      console.log('Enviando dados da avaliação:', avaliacaoData);

      // Tentar primeiro a API de avaliação direta
      try {
        const response = await fetchWithToken('/api/avaliacao/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(avaliacaoData)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Avaliação criada com sucesso via API direta:', result);
          setSuccess(true);

          // Redirecionar para a lista após 2 segundos
          setTimeout(() => {
            router.push('/avaliacao');
          }, 2000);

          return; // Encerrar a função aqui se a primeira API funcionou
        }

        console.log('Falha ao usar API direta, tentando API alternativa...');
      } catch (apiError) {
        console.error('Erro ao usar API direta:', apiError);
      }

      // Se falhar, tentar a API de avaliação-desempenho
      const response = await fetchWithToken('/api/avaliacao-desempenho/avaliacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(avaliacaoData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Avaliação criada com sucesso:', result);
      setSuccess(true);

      // Redirecionar para a lista após 2 segundos
      setTimeout(() => {
        router.push('/avaliacao');
      }, 2000);

    } catch (err) {
      console.error('Erro ao criar avaliação:', err);
      setError(`Erro ao criar avaliação: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
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

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('avaliacao.novaAvaliacao', 'Nova Avaliação')}</h1>

          {success ? (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-6">
              <p>{t('avaliacao.nova.createSuccess', 'Avaliação criada com sucesso! Redirecionando...')}</p>
            </div>
          ) : null}

          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
              <p>{error}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="avaliador_id" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.avaliador', 'Avaliador')} *
                </label>
                <select
                  id="avaliador_id"
                  name="avaliador_id"
                  value={formData.avaliador_id}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={loadingFuncionarios}
                >
                  <option value="">{t('avaliacao.nova.selectAvaliador', 'Selecione um avaliador')}</option>
                  {avaliadores.map(avaliador => (
                    <option key={avaliador.id} value={avaliador.id}>
                      {avaliador.nome} ({avaliador.cargo || avaliador.users?.role || 'Funcionário'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="funcionario_id" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.funcionario', 'Funcionário')} *
                </label>
                <select
                  id="funcionario_id"
                  name="funcionario_id"
                  value={formData.funcionario_id}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={loadingFuncionarios}
                >
                  <option value="">{t('avaliacao.nova.selectFuncionario', 'Selecione um funcionário')}</option>
                  {funcionarios.map(funcionario => (
                    <option key={funcionario.id} value={funcionario.id}>
                      {funcionario.nome} ({funcionario.email || funcionario.cargo || 'Sem email'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="periodo" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.periodo', 'Período')} *
                </label>
                <input
                  type="text"
                  id="periodo"
                  name="periodo"
                  value={formData.periodo}
                  onChange={handleChange}
                  placeholder="Ex: 2025-Q1"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('avaliacao.status.title', 'Status')}
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pending">{t('avaliacao.status.pending', 'Pendente')}</option>
                  <option value="in_progress">{t('avaliacao.status.inProgress', 'Em Progresso')}</option>
                  <option value="completed">{t('avaliacao.status.completed', 'Concluída')}</option>
                  <option value="archived">{t('avaliacao.status.archived', 'Arquivada')}</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="observacoes" className="block text-sm font-medium text-gray-700 mb-1">
                {t('avaliacao.observacoes', 'Observações')}
              </label>
              <textarea
                id="observacoes"
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                rows={4}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            {/* Seção de Critérios de Avaliação */}
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {t('avaliacao.criterios.title', 'Critérios de Avaliação')}
              </h2>

              {loadingCriterios ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
                  <span className="ml-2 text-gray-600">{t('common.loading', 'Carregando...')}</span>
                </div>
              ) : criteriosAvaliacao.length > 0 ? (
                <div className="space-y-4">
                  {/* Agrupar critérios por categoria */}
                  {Array.from(new Set(criteriosAvaliacao.map(c => c.categoria))).map(categoria => (
                    <div key={categoria} className="mb-6">
                      <h3 className="text-md font-medium text-gray-800 mb-3 pb-2 border-b">
                        {categoria}
                      </h3>
                      <div className="space-y-4">
                        {criteriosAvaliacao
                          .filter(c => c.categoria === categoria)
                          .map(criterio => (
                            <CriterioAvaliacao
                              key={criterio.criterioId}
                              id={criterio.criterioId}
                              nome={criterio.nome || ''}
                              descricao={criterio.descricao || ''}
                              categoria={criterio.categoria || ''}
                              peso={criterio.peso || 1}
                              notaMaxima={5}
                              initialNota={criterio.nota}
                              initialComentario={criterio.comentario}
                              onChange={handleCriterioChange}
                              readOnly={loading}
                            />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-md">
                  <p>{t('avaliacao.criterios.noCriterios', 'Nenhum critério de avaliação encontrado. Por favor, adicione critérios para continuar.')}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <Link
                href="/avaliacao"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FiX className="mr-2" /> {t('common.cancel', 'Cancelar')}
              </Link>
              <button
                type="submit"
                disabled={loading || loadingCriterios || criteriosAvaliacao.length === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></div>
                    {t('common.saving', 'Salvando...')}
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2" /> {t('common.save', 'Salvar')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
