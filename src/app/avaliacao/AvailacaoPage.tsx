'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiBarChart2, FiUsers, FiFileText, FiUpload, FiPlus, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { FiSettings } from 'react-icons/fi';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Interfaces para tipos
interface Funcionario {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  role: string;
  position?: string;
  department?: string;
  active: boolean;
}

interface Avaliacao {
  id: string;
  funcionario_id: string;
  avaliador_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  pontuacao_total?: number;
  funcionario?: {
    nome: string;
    cargo?: string;
    departamento?: string;
  };
  avaliador?: {
    nome: string;
    cargo?: string;
  };
  funcionario_nome?: string;
  avaliador_nome?: string;
  funcionario_cargo?: string;
  avaliador_cargo?: string;
  created_at?: string;
  updated_at?: string;
}

export default function AvailacaoPage() {
  const { t } = useI18n();
  const { user, profile, isAdmin, isManager } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const router = useRouter();

  // Log para depuração
  console.log('AvailacaoPage - Estado de autenticação:', {
    user: user ? 'Autenticado' : 'Não autenticado',
    profile: profile ? `Role: ${profile.role}` : 'Sem perfil',
    isAdmin,
    isManager
  });

  // Estado para funcionários
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(true);
  const [errorFuncionarios, setErrorFuncionarios] = useState<string | null>(null);

  // Estado para avaliações
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(true);
  const [errorAvaliacoes, setErrorAvaliacoes] = useState<string | null>(null);

  // Carregar funcionários do Supabase
  useEffect(() => {
    async function loadFuncionarios() {
      try {
        setLoadingFuncionarios(true);
        setErrorFuncionarios(null);

        console.log('Carregando funcionários...');
        const { data, error } = await supabase
          .from('users_unified')
          .select('id, first_name, last_name, email, phone_number, role, position, department, active')
          .eq('active', true)
          .order('first_name', { ascending: true });

        if (error) {
          console.error('Erro ao carregar funcionários da tabela users_unified:', error);

          // Tentar carregar da tabela funcionarios como alternativa
          console.log('Tentando carregar da tabela funcionarios...');
          const { data: funcionariosData, error: funcionariosError } = await supabase
            .from('funcionarios')
            .select(`
              id,
              nome,
              cargo,
              departamento,
              email,
              status,
              user_id
            `)
            .is('deleted_at', null)
            .eq('status', 'ativo')
            .order('nome', { ascending: true });

          if (funcionariosError) {
            console.error('Erro ao carregar funcionários da tabela funcionarios:', funcionariosError);
            throw funcionariosError;
          }

          // Mapear os dados da tabela funcionarios para o formato esperado
          const mappedData = funcionariosData.map(f => ({
            id: f.id,
            first_name: f.nome.split(' ')[0] || '',
            last_name: f.nome.split(' ').slice(1).join(' ') || '',
            email: f.email || '',
            role: 'USER',
            position: f.cargo || '',
            department: f.departamento || '',
            active: f.status === 'ativo'
          }));

          console.log('Funcionários carregados da tabela funcionarios com sucesso:', mappedData.length);
          setFuncionarios(mappedData || []);
          return;
        }

        console.log('Funcionários carregados da tabela users_unified com sucesso:', data?.length || 0);
        setFuncionarios(data || []);
      } catch (error) {
        console.error('Erro ao carregar funcionários:', error);

        // Mensagem de erro mais detalhada
        let errorMessage = 'Erro ao carregar funcionários. Tente novamente.';

        if (error instanceof Error) {
          if (error.message.includes('does not exist')) {
            errorMessage = 'A tabela de funcionários não existe no banco de dados. Entre em contato com o administrador.';
          } else if (error.message.includes('permission denied')) {
            errorMessage = 'Sem permissão para acessar os dados de funcionários. Entre em contato com o administrador.';
          } else if (error.message.includes('network')) {
            errorMessage = 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
          }
        }

        setErrorFuncionarios(errorMessage);
      } finally {
        setLoadingFuncionarios(false);
      }
    }

    if (activeTab === 'funcionarios') {
      loadFuncionarios();
    }
  }, [activeTab]);

  // Carregar avaliações do Supabase
  useEffect(() => {
    async function loadAvaliacoes() {
      try {
        setLoadingAvaliacoes(true);
        setErrorAvaliacoes(null);

        console.log('Carregando avaliações...');

        // Verificar se a tabela avaliacoes_desempenho existe
        console.log('Verificando se a tabela avaliacoes_desempenho existe...');

        try {
          // Tentar carregar da view vw_avaliacoes_desempenho
          const { data, error } = await supabase
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
            `)
            .order('created_at', { ascending: false })
            .limit(10);

          if (error) {
            console.error('Erro ao carregar avaliações da tabela avaliacoes_desempenho:', error);
            throw error;
          }

          console.log('Avaliações carregadas da view vw_avaliacoes_desempenho com sucesso:', data?.length || 0);

          // Log detalhado dos períodos para depuração
          if (data && data.length > 0) {
            console.log('Períodos das avaliações carregadas:', data.map(a => ({
              id: a.id,
              periodo: a.periodo
            })));
          }

          // Processar os dados para garantir compatibilidade com o código existente
          const avaliacoesProcessadas = (data || []).map(avaliacao => {
            // Criar objetos funcionario e avaliador a partir dos campos da view
            return {
              ...avaliacao,
              funcionario: {
                nome: avaliacao.funcionario_nome || 'Funcionário não encontrado',
                cargo: avaliacao.funcionario_cargo,
                departamento: avaliacao.funcionario_departamento
              },
              avaliador: {
                nome: avaliacao.avaliador_nome || 'Avaliador não encontrado',
                cargo: avaliacao.avaliador_cargo
              }
            };
          });

          // Log para depuração
          console.log('Avaliações processadas da view:', avaliacoesProcessadas.map(a => ({
            id: a.id,
            funcionario_id: a.funcionario_id,
            funcionario_nome: a.funcionario_nome,
            funcionario: a.funcionario
          })));

          setAvaliacoes(avaliacoesProcessadas);

          return;
        } catch (error) {
          console.error('Erro ao acessar a tabela avaliacoes_desempenho:', error);
          // Verificar se o erro é porque a tabela não existe
          if (error instanceof Error && error.message && error.message.includes('does not exist')) {
            console.error('A tabela avaliacoes_desempenho não existe. Execute o script para criá-la.');
            throw new Error('A tabela avaliacoes_desempenho não existe. Execute o script scripts/run-create-avaliacoes-desempenho-table.js');
          }

          // Tentar carregar da tabela avaliacoes como alternativa
          console.log('Tentando carregar da tabela avaliacoes...');
          const { data: avaliacoesData, error: avaliacoesError } = await supabase
            .from('avaliacoes')
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
            `)
            .order('created_at', { ascending: false })
            .limit(10);

          if (avaliacoesError) {
            console.error('Erro ao carregar avaliações da tabela avaliacoes:', avaliacoesError);
            throw avaliacoesError;
          }

            console.log('Avaliações carregadas da tabela avaliacoes com sucesso:', avaliacoesData.length);

            // Log detalhado dos períodos para depuração
            if (avaliacoesData && avaliacoesData.length > 0) {
              console.log('Períodos das avaliações carregadas da tabela avaliacoes:', avaliacoesData.map(a => ({
                id: a.id,
                periodo: a.periodo
              })));
            }

            // Processar os dados mesmo quando carregados da tabela avaliacoes
            // Neste caso, não temos os nomes dos funcionários e avaliadores, então usaremos os IDs
            const avaliacoesProcessadas = (avaliacoesData || []).map(avaliacao => {
              return {
                ...avaliacao,
                funcionario: {
                  nome: `ID: ${avaliacao.funcionario_id}`,
                  cargo: undefined,
                  departamento: undefined
                },
                avaliador: {
                  nome: `ID: ${avaliacao.avaliador_id}`,
                  cargo: undefined
                }
              };
            });

            // Log para depuração
            console.log('Avaliações processadas da tabela avaliacoes:', avaliacoesProcessadas.map(a => ({
              id: a.id,
              funcionario_id: a.funcionario_id,
              funcionario: a.funcionario
            })));

            setAvaliacoes(avaliacoesProcessadas);
            return;
        }
      } catch (error) {
        console.error('Erro ao carregar avaliações:', error);

        // Mensagem de erro mais detalhada
        let errorMessage = 'Erro ao carregar avaliações. Tente novamente.';

        if (error instanceof Error) {
          if (error.message.includes('does not exist') || error.message.includes('relation') || error.message.includes('avaliacoes_desempenho')) {
            errorMessage = 'A tabela de avaliações não existe no banco de dados. Execute o script de criação da tabela avaliacoes_desempenho.';
            console.error('Erro detalhado: A tabela avaliacoes_desempenho não existe. Execute o script scripts/run-create-avaliacoes-desempenho-table.js');
            console.error('Consulte o arquivo README_AVALIACOES_DESEMPENHO.md para instruções detalhadas.');
          } else if (error.message.includes('permission denied')) {
            errorMessage = 'Sem permissão para acessar os dados de avaliações. Entre em contato com o administrador.';
          } else if (error.message.includes('network')) {
            errorMessage = 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
          } else if (error.message.includes('foreign key constraint')) {
            errorMessage = 'Erro de integridade referencial. Entre em contato com o administrador.';
          }
        }

        setErrorAvaliacoes(errorMessage);
      } finally {
        setLoadingAvaliacoes(false);
      }
    }

    // Carregar avaliações quando a aba for dashboard ou avaliacoes
    if (activeTab === 'dashboard') {
      loadAvaliacoes();
    }
  }, [activeTab]);

  return (
    <MainLayout>
      <div className="space-y-8">
        <PageHeader
          title={t('avaliacao.title', 'Avaliação de Desempenho')}
          description={t('avaliacao.description', 'Gerencie avaliações de desempenho dos colaboradores')}
          icon={<FiBarChart2 className="w-8 h-8" />}
        />

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'dashboard'
                ? 'text-abz-blue border-b-2 border-abz-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('dashboard')}
          >
            {t('avaliacao.dashboard', 'Dashboard')}
          </button>
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'funcionarios'
                ? 'text-abz-blue border-b-2 border-abz-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('funcionarios')}
          >
            {t('avaliacao.funcionarios.title', 'Funcionários')}
          </button>
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'relatorios'
                ? 'text-abz-blue border-b-2 border-abz-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('relatorios')}
          >
            {t('avaliacao.relatorios.title', 'Relatórios')}
          </button>
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'importacao'
                ? 'text-abz-blue border-b-2 border-abz-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('importacao')}
          >
            {t('avaliacao.importacao.title', 'Importação')}
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Cards de navegação */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card
                title={t('avaliacao.funcionarios.title', 'Funcionários')}
                description={t('avaliacao.funcionarios.description', 'Gerencie os funcionários da empresa')}
                icon={<FiUsers className="w-6 h-6" />}
                onClick={() => setActiveTab('funcionarios')}
                className="bg-white hover:bg-gray-50"
              />
              <Card
                title={t('avaliacao.avaliacoes.title', 'Avaliações')}
                description={t('avaliacao.avaliacoes.description', 'Gerencie as avaliações de desempenho')}
                icon={<FiBarChart2 className="w-6 h-6" />}
                onClick={() => {
                  console.log('Navegando para /avaliacao/dashboard');
                  // Forçar navegação completa para garantir que a página seja carregada corretamente
                  // Adicionar timestamp para evitar cache
                  const timestamp = new Date().getTime();
                  window.location.href = `/avaliacao/dashboard?t=${timestamp}`;
                }}
                className="bg-white hover:bg-gray-50"
              />
              <Card
                title={t('avaliacao.relatorios.title', 'Relatórios')}
                description={t('avaliacao.relatorios.description', 'Visualize relatórios de desempenho')}
                icon={<FiFileText className="w-6 h-6" />}
                onClick={() => setActiveTab('relatorios')}
                className="bg-white hover:bg-gray-50"
              />
              <Card
                title={t('avaliacao.importacao.title', 'Importação')}
                description={t('avaliacao.importacao.description', 'Importe dados de funcionários e avaliações')}
                icon={<FiUpload className="w-6 h-6" />}
                onClick={() => setActiveTab('importacao')}
                className="bg-white hover:bg-gray-50"
              />
            </div>

            {/* Resumo de avaliações recentes */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">{t('avaliacao.avaliacoesRecentes', 'Avaliações Recentes')}</h2>
                <button
                  onClick={() => {
                    // Forçar navegação completa para garantir que a página seja carregada corretamente
                    // Adicionar timestamp para evitar cache
                    const timestamp = new Date().getTime();
                    window.location.href = `/avaliacao/dashboard?t=${timestamp}`;
                  }}
                  className="bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded flex items-center"
                >
                  <FiBarChart2 className="mr-2" />
                  {t('avaliacao.verTodasAvaliacoes', 'Ver Todas')}
                </button>
              </div>

              {/* Estado de carregamento */}
              {loadingAvaliacoes && (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
                  <span className="ml-2 text-gray-600">{t('common.loading', 'Carregando...')}</span>
                </div>
              )}

              {/* Estado de erro */}
              {errorAvaliacoes && !loadingAvaliacoes && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <FiAlertCircle className="text-red-500 mr-2" />
                    <p className="text-red-700">{errorAvaliacoes}</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-2 flex items-center text-red-700 hover:text-red-800"
                  >
                    <FiRefreshCw className="mr-1" />
                    {t('common.tryAgain', 'Tentar novamente')}
                  </button>
                </div>
              )}

              {/* Lista de avaliações */}
              {!loadingAvaliacoes && !errorAvaliacoes && (
                <>
                  {avaliacoes.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="mx-auto h-12 w-12 text-gray-400 flex items-center justify-center">
                        <FiBarChart2 className="h-8 w-8" />
                      </div>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        {t('avaliacao.avaliacoes.empty', 'Nenhuma avaliação cadastrada')}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {t('avaliacao.avaliacoes.emptyDesc', 'Comece criando uma nova avaliação de desempenho.')}
                      </p>
                      <div className="mt-6">
                        <Link
                          href="/avaliacao/avaliacoes/nova"
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
                        >
                          <FiPlus className="-ml-1 mr-2 h-5 w-5" />
                          {t('avaliacao.novaAvaliacao', 'Nova Avaliação')}
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                                {t('avaliacao.avaliacoes.funcionario', 'Funcionário')}
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                {t('avaliacao.avaliacoes.periodo', 'Período')}
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                {t('avaliacao.avaliacoes.status', 'Status')}
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                {t('avaliacao.avaliacoes.pontuacao', 'Pontuação')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {avaliacoes.slice(0, 5).map((avaliacao) => {
                              // Determinar o nome do funcionário
                              let nomeFuncionario = 'Não informado';

                              // Log para depuração
                              console.log('Dados da avaliação para exibição:', {
                                id: avaliacao.id,
                                funcionario_id: avaliacao.funcionario_id,
                                funcionario: avaliacao.funcionario,
                                funcionario_nome: avaliacao.funcionario_nome,
                                periodo: avaliacao.periodo
                              });

                              if (avaliacao.funcionario) {
                                nomeFuncionario = avaliacao.funcionario.nome;
                              } else if (avaliacao.funcionario_nome) {
                                nomeFuncionario = avaliacao.funcionario_nome;
                              }

                              // Formatar o status
                              const statusFormatado = avaliacao.status || 'pendente';
                              let statusClass = 'bg-gray-100 text-gray-800';

                              if (statusFormatado === 'concluida' || statusFormatado === 'concluída') {
                                statusClass = 'bg-green-100 text-green-800';
                              } else if (statusFormatado === 'em_andamento' || statusFormatado === 'em andamento') {
                                statusClass = 'bg-blue-100 text-blue-800';
                              } else if (statusFormatado === 'pendente') {
                                statusClass = 'bg-yellow-100 text-yellow-800';
                              } else if (statusFormatado === 'cancelada') {
                                statusClass = 'bg-red-100 text-red-800';
                              }

                              return (
                                <tr key={avaliacao.id}>
                                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                    {nomeFuncionario}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                    {/* Exibir o período exatamente como está no banco de dados */}
                                    {(() => {
                                      // Log para depuração do valor do período
                                      console.log(`Renderizando período para avaliação ${avaliacao.id}: "${avaliacao.periodo}"`);
                                      return avaliacao.periodo || 'Não definido';
                                    })()}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                                      {statusFormatado.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                    {avaliacao.pontuacao_total || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4">
                        <Link
                          href="/avaliacao/dashboard"
                          className="text-abz-blue hover:underline"
                        >
                          {t('avaliacao.avaliacoes.verMais', 'Ver mais avaliações')} →
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Funcionários Tab */}
        {activeTab === 'funcionarios' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">{t('avaliacao.funcionarios.title', 'Funcionários')}</h2>
              <Link
                href="/avaliacao/funcionarios"
                className="bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded flex items-center"
              >
                <FiUsers className="mr-2" />
                {t('avaliacao.funcionarios.verTodos', 'Ver Todos')}
              </Link>
            </div>

            {/* Estado de carregamento */}
            {loadingFuncionarios && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
                <span className="ml-2 text-gray-600">{t('common.loading', 'Carregando...')}</span>
              </div>
            )}

            {/* Estado de erro */}
            {errorFuncionarios && !loadingFuncionarios && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center">
                  <FiAlertCircle className="text-red-500 mr-2" />
                  <p className="text-red-700">{errorFuncionarios}</p>
                </div>
                <button
                  onClick={() => setActiveTab('funcionarios')}
                  className="mt-2 flex items-center text-red-700 hover:text-red-800"
                >
                  <FiRefreshCw className="mr-1" />
                  {t('common.tryAgain', 'Tentar novamente')}
                </button>
              </div>
            )}

            {/* Lista de funcionários */}
            {!loadingFuncionarios && !errorFuncionarios && (
              <>
                {funcionarios.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto h-12 w-12 text-gray-400 flex items-center justify-center">
                      <FiUsers className="h-8 w-8" />
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      {t('avaliacao.funcionarios.empty', 'Nenhum funcionário cadastrado')}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {t('avaliacao.funcionarios.emptyDesc', 'Comece adicionando funcionários ao sistema.')}
                    </p>
                    <div className="mt-6">
                      <Link
                        href="/avaliacao/funcionarios"
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
                      >
                        <FiPlus className="-ml-1 mr-2 h-5 w-5" />
                        {t('avaliacao.funcionarios.add', 'Adicionar Funcionário')}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-600 mb-4">
                      {t('avaliacao.funcionarios.found', `Encontrados ${funcionarios.length} funcionários.`)}
                    </p>
                    <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                              {t('avaliacao.funcionarios.name', 'Nome')}
                            </th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              {t('avaliacao.funcionarios.email', 'Email')}
                            </th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              {t('avaliacao.funcionarios.role', 'Função')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {funcionarios.slice(0, 5).map((funcionario) => (
                            <tr key={funcionario.id}>
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                {funcionario.first_name} {funcionario.last_name}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {funcionario.email}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {funcionario.role || t('avaliacao.funcionarios.noRole', 'Não definido')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4">
                      <Link
                        href="/avaliacao/funcionarios"
                        className="text-abz-blue hover:underline"
                      >
                        {t('avaliacao.funcionarios.verMais', 'Ver mais detalhes')} →
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Relatórios Tab - Simplificado */}
        {activeTab === 'relatorios' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">{t('avaliacao.relatorios.title', 'Relatórios')}</h2>
              <Link
                href="/avaliacao/relatorios"
                className="bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded flex items-center"
              >
                <FiFileText className="mr-2" />
                {t('avaliacao.relatorios.verRelatorios', 'Ver Relatórios')}
              </Link>
            </div>
            <p className="text-gray-600 mb-4">
              {t('avaliacao.relatorios.description', 'Visualize e exporte relatórios de avaliação de desempenho.')}
            </p>
            <Link
              href="/avaliacao/relatorios"
              className="text-abz-blue hover:underline"
            >
              {t('avaliacao.relatorios.verMais', 'Ver mais detalhes')} →
            </Link>
          </div>
        )}

        {/* Importação Tab - Simplificado */}
        {activeTab === 'importacao' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">{t('avaliacao.importacao.title', 'Importação')}</h2>
              <Link
                href="/avaliacao/importacao"
                className="bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded flex items-center"
              >
                <FiUpload className="mr-2" />
                {t('avaliacao.importacao.importar', 'Importar Dados')}
              </Link>
            </div>
            <p className="text-gray-600 mb-4">
              {t('avaliacao.importacao.description', 'Importe dados de funcionários e avaliações de desempenho.')}
            </p>
            <Link
              href="/avaliacao/importacao"
              className="text-abz-blue hover:underline"
            >
              {t('avaliacao.importacao.verMais', 'Ver mais detalhes')} →
            </Link>
          </div>
        )}

        {/* Botão de Nova Avaliação - sempre visível para facilitar o teste */}
        <div className="mt-8">
          <div className="flex space-x-4">
            <Link
              href="/avaliacao/avaliacoes/nova"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
            >
              <FiPlus className="mr-2 -ml-1 h-5 w-5" />
              {t('avaliacao.novaAvaliacao', 'Nova Avaliação')}
            </Link>

            <Link
              href="/avaliacao/lista-avaliacoes/debug"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
            >
              <FiSettings className="mr-2 -ml-1 h-5 w-5" />
              Diagnóstico
            </Link>
          </div>

          <div className="mt-2 text-sm text-gray-500">
            {isAdmin || isManager ?
              "Você tem permissão para criar avaliações." :
              "Normalmente apenas gerentes e administradores podem criar avaliações, mas o botão está habilitado para testes."}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
