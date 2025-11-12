'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/Layout/MainLayout';
import { FiSave, FiX, FiArrowLeft, FiUser, FiCalendar, FiFileText, FiUsers } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { AvaliacaoWorkflowService } from '@/lib/services/avaliacao-workflow-service';

interface Usuario {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position: string;
  role: string;
  is_authorized: boolean;
  active: boolean;
}

interface PeriodoAvaliacao {
  value: string;
  label: string;
}

export default function NovaAvaliacaoPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Estados para dados
  const [funcionarios, setFuncionarios] = useState<Usuario[]>([]);
  const [gerentesAvaliacao, setGerentesAvaliacao] = useState<Usuario[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoAvaliacao[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Estado do formulário
  const [formData, setFormData] = useState({
    periodo: '',
    funcionario_id: '',
    gerente_avaliacao_id: ''
  });

  // Carregar dados necessários
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoadingData(true);

      // Criar lista de períodos (anos) - ano atual e próximos 2 anos
      const currentYear = new Date().getFullYear();
      const periodosData: PeriodoAvaliacao[] = [
        { value: currentYear.toString(), label: `Ano ${currentYear}` },
        { value: (currentYear + 1).toString(), label: `Ano ${currentYear + 1}` },
        { value: (currentYear + 2).toString(), label: `Ano ${currentYear + 2}` }
      ];

      // Carregar todos os usuários autorizados e ativos da tabela users_unified
      const { data: usuariosData, error: usuariosError } = await supabase
        .from('users_unified')
        .select('id, first_name, last_name, email, position, role, is_authorized, active')
        .eq('is_authorized', true)
        .eq('active', true)
        .order('first_name', { ascending: true });

      if (usuariosError) throw usuariosError;

      // Carregar gerentes de avaliação configurados no sistema
      const { data: gerentesConfigData, error: gerentesError } = await supabase
        .from('gerentes_avaliacao_config')
        .select('usuario_id')
        .eq('ativo', true);

      if (gerentesError && gerentesError.code !== 'PGRST116') {
        // PGRST116 = table not found, pode não existir ainda
        throw gerentesError;
      }

      // Processar dados
      const usuarios = usuariosData || [];
      const gerentesIds = gerentesConfigData?.map(g => g.usuario_id) || [];

      // Separar funcionários (não gerentes de avaliação)
      const funcionariosList = usuarios.filter(user =>
        !gerentesIds.includes(user.id)
      );

      // Gerentes de avaliação (seja pela configuração ou pela role admin/manager)
      const gerentesList = usuarios.filter(user =>
        gerentesIds.includes(user.id) ||
        user.role === 'ADMIN' ||
        user.role === 'MANAGER'
      );

      setPeriodos(periodosData);
      setFuncionarios(funcionariosList);
      setGerentesAvaliacao(gerentesList);

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados. Por favor, tente novamente.');
    } finally {
      setLoadingData(false);
    }
  };

  // Manipular mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validar formulário
  const validateForm = () => {
    if (!formData.periodo) {
      setError('Selecione um período de avaliação.');
      return false;
    }
    if (!formData.funcionario_id) {
      setError('Selecione um funcionário para avaliar.');
      return false;
    }
    if (!formData.gerente_avaliacao_id) {
      setError('Selecione um gerente de avaliação.');
      return false;
    }
    if (formData.funcionario_id === formData.gerente_avaliacao_id) {
      setError('O funcionário e o gerente de avaliação não podem ser a mesma pessoa.');
      return false;
    }
    return true;
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verificar se já existe uma avaliação para este funcionário neste período
      const { data: existingEvaluations, error: checkError } = await supabase
        .from('avaliacoes_desempenho')
        .select('id')
        .eq('periodo', formData.periodo)
        .eq('funcionario_id', formData.funcionario_id);

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingEvaluations && existingEvaluations.length > 0) {
        setError('Já existe uma avaliação para este funcionário neste período.');
        setLoading(false);
        return;
      }

      // Preparar dados para criação da avaliação
      const avaliacaoData = {
        funcionario_id: formData.funcionario_id,
        avaliador_id: formData.gerente_avaliacao_id,
        periodo: formData.periodo,
        status: 'pendente' as const,
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
        observacoes: '',
        pontuacao_total: 0
      };

      // Usar o serviço de workflow para criar a avaliação com notificações
      const result = await AvaliacaoWorkflowService.createAvaliacao(avaliacaoData);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar avaliação');
      }

      setSuccess(true);

      // Redirecionar após 2 segundos
      setTimeout(() => {
        router.push('/avaliacao');
      }, 2000);

    } catch (err) {
      console.error('Erro ao criar avaliação:', err);
      setError(`Erro ao criar avaliação: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando dados...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/avaliacao" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            <FiArrowLeft className="mr-2" /> Voltar para Avaliações
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
              <div className="flex items-center">
                <FiFileText className="text-3xl mr-3" />
                <div>
                  <h1 className="text-2xl font-bold">Criar Nova Avaliação</h1>
                  <p className="text-blue-100">Sistema de Avaliação de Desempenho</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {success ? (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-6">
                  <div className="flex items-center">
                    <FiSave className="mr-2" />
                    <span>Avaliação criada com sucesso! Notificações enviadas. Redirecionando...</span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
                  <p>{error}</p>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Período de Avaliação */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiCalendar className="inline mr-1" />
                    Período de Avaliação *
                  </label>
                  <select
                    name="periodo"
                    value={formData.periodo}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Selecione um período</option>
                    {periodos.map(periodo => (
                      <option key={periodo.value} value={periodo.value}>
                        {periodo.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Funcionário */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiUser className="inline mr-1" />
                    Funcionário a ser Avaliado *
                  </label>
                  <select
                    name="funcionario_id"
                    value={formData.funcionario_id}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Selecione um funcionário</option>
                    {funcionarios.map(funcionario => (
                      <option key={funcionario.id} value={funcionario.id}>
                        {funcionario.first_name} {funcionario.last_name} - {funcionario.position || 'Sem cargo'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gerente de Avaliação */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiUsers className="inline mr-1" />
                    Gerente de Avaliação *
                  </label>
                  <select
                    name="gerente_avaliacao_id"
                    value={formData.gerente_avaliacao_id}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Selecione um gerente de avaliação</option>
                    {gerentesAvaliacao.map(gerente => (
                      <option key={gerente.id} value={gerente.id}>
                        {gerente.first_name} {gerente.last_name} - {gerente.position || gerente.role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Informações Importantes */}
                <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Informações Importantes:</h3>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Apenas usuários configurados como "Gerentes de Avaliação" podem avaliar</li>
                    <li>O status do usuário no sistema (ADMIN/MANAGER) não afeta esta configuração</li>
                    <li>Cada funcionário só pode ter uma avaliação por ciclo</li>
                    <li>O funcionário e o gerente receberão notificações automaticamente</li>
                    <li>Notificações de lembrete serão enviadas para avaliações pendentes</li>
                  </ul>
                </div>

                {/* Botões */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <Link
                    href="/avaliacao"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FiX className="mr-2" /> Cancelar
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></div>
                        Criando...
                      </>
                    ) : (
                      <>
                        <FiSave className="mr-2" /> Criar Avaliação
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}