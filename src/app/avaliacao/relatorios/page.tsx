'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiFileText, FiDownload, FiCalendar, FiBarChart2, FiFilter, FiUser } from 'react-icons/fi';
import PageHeader from '@/components/PageHeader';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';

interface Funcionario {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
}

interface Avaliacao {
  id: string;
  periodo: string;
  data_inicio: string;
  funcionario_id: string;
  avaliador_id: string;
  pontuacao_total: number;
  status: string;
  funcionarios?: {
    nome: string;
  };
}

export default function RelatoriosPage() {
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const [tipoRelatorio, setTipoRelatorio] = useState('geral');

  // Novos estados para relatórios reais
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [selectedFuncionario, setSelectedFuncionario] = useState<string>('');
  const [selectedAno, setSelectedAno] = useState<string>(new Date().getFullYear().toString());

  // Anos disponíveis (últimos 5 anos)
  const anosDisponiveis = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  );



  // Carregar funcionários
  useEffect(() => {
    async function loadFuncionarios() {
      try {
        setIsLoading(true);

        // Obter o token de autenticação do localStorage
        const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

        if (!token) {
          console.error('Token de autenticação não encontrado');
          throw new Error('Não autorizado. Faça login novamente.');
        }

        // Incluir o token no cabeçalho da requisição
        const response = await fetch('/api/avaliacao-desempenho/usuarios', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Erro ao carregar funcionários');
        }

        const data = await response.json();

        if (data.success && data.data) {
          setFuncionarios(data.data);
        } else {
          setFuncionarios([]);
        }
      } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');

        // Se o erro for de autenticação, redirecionar para a página de login
        if (error instanceof Error &&
            (error.message.includes('autorizado') ||
             error.message.includes('Token') ||
             error.message.includes('login'))) {
          window.location.href = '/login';
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadFuncionarios();
  }, []);

  // Carregar avaliações com base nos filtros
  useEffect(() => {
    async function loadAvaliacoes() {
      try {
        setIsLoading(true);

        // Obter o token de autenticação do localStorage
        const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

        if (!token) {
          console.error('Token de autenticação não encontrado');
          throw new Error('Não autorizado. Faça login novamente.');
        }

        // Construir URL com filtros
        let url = '/api/avaliacao-desempenho/avaliacoes?';

        if (selectedFuncionario) {
          url += `funcionarioId=${selectedFuncionario}&`;
        }

        if (selectedAno) {
          url += `ano=${selectedAno}&`;
        }

        // Incluir o token no cabeçalho da requisição
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Erro ao carregar avaliações');
        }

        const data = await response.json();

        if (data.success && data.data) {
          setAvaliacoes(data.data);
        } else {
          setAvaliacoes([]);
        }
      } catch (error) {
        console.error('Erro ao carregar avaliações:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');

        // Se o erro for de autenticação, redirecionar para a página de login
        if (error instanceof Error &&
            (error.message.includes('autorizado') ||
             error.message.includes('Token') ||
             error.message.includes('login'))) {
          window.location.href = '/login';
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadAvaliacoes();
  }, [selectedFuncionario, selectedAno]);

  // Exportar relatório para Excel
  const exportarExcel = () => {
    if (avaliacoes.length === 0) return;

    // Cabeçalhos
    const headers = ['ID', 'Funcionário', 'Período', 'Data', 'Avaliador', 'Pontuação', 'Status'];

    // Dados
    const rows = avaliacoes.map(avaliacao => [
      avaliacao.id,
      funcionarios.find(f => f.id === avaliacao.funcionario_id)?.first_name + ' ' +
      funcionarios.find(f => f.id === avaliacao.funcionario_id)?.last_name,
      avaliacao.periodo,
      new Date(avaliacao.data_inicio).toLocaleDateString(),
      funcionarios.find(f => f.id === avaliacao.avaliador_id)?.first_name + ' ' +
      funcionarios.find(f => f.id === avaliacao.avaliador_id)?.last_name,
      avaliacao.pontuacao_total,
      avaliacao.status
    ]);

    // Criar CSV (formato que Excel pode abrir)
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_anual_desempenho_${selectedAno}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar relatório para PDF
  const exportarPDF = () => {
    // Implementação futura para exportação de PDF
    console.log('Exportando PDF...');
    alert('Exportação de PDF será implementada em breve.');
  };

  // Gerar relatório completo
  const handleGerarRelatorio = () => {
    // Implementação futura para geração de relatório completo
    console.log('Gerando relatório completo...');
    alert('Relatório será gerado em breve.');
  };

  return (
    <ProtectedRoute>
      <MainLayout>
      <PageHeader
        title="Relatório Anual de Desempenho"
        description="Gere relatórios de desempenho dos funcionários"
        icon={<FiFileText className="w-8 h-8" />}
      />

      <div className="bg-white rounded-lg shadow p-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Relatório
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={tipoRelatorio}
              onChange={(e) => setTipoRelatorio(e.target.value)}
            >
              <option value="geral">Geral</option>
              <option value="individual">Individual</option>
              <option value="departamento">Por Departamento</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ano
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={selectedAno}
              onChange={(e) => setSelectedAno(e.target.value)}
            >
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            className="flex items-center bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
            onClick={exportarExcel}
          >
            <FiDownload className="mr-2" />
            Exportar Excel
          </button>
          <button
            className="flex items-center bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
            onClick={exportarPDF}
          >
            <FiDownload className="mr-2" />
            Exportar PDF
          </button>
          <button
            className="bg-abz-blue hover:bg-abz-blue-dark text-white px-4 py-2 rounded"
            onClick={handleGerarRelatorio}
          >
            Gerar Relatório
          </button>
        </div>
      </div>

      {/* Resultados das Avaliações */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Resultados</h2>
        </div>

        {/* Filtros Simplificados */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="funcionarioFiltro" className="block text-sm font-medium text-gray-700 mb-1">
              Funcionário
            </label>
            <select
              id="funcionarioFiltro"
              value={selectedFuncionario}
              onChange={(e) => setSelectedFuncionario(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm rounded-md"
            >
              <option value="">Todos os funcionários</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.first_name} {f.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="anoFiltro" className="block text-sm font-medium text-gray-700 mb-1">
              Ano
            </label>
            <select
              id="anoFiltro"
              value={selectedAno}
              onChange={(e) => setSelectedAno(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-abz-blue focus:border-abz-blue sm:text-sm rounded-md"
            >
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
          </div>
        ) : avaliacoes.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <FiFileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">{t('avaliacao.relatorios.noRelatorios', 'Nenhuma avaliação encontrada com os filtros selecionados.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funcionário</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avaliador</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pontuação</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {avaliacoes.map((avaliacao) => (
                  <tr key={avaliacao.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {funcionarios.find(f => f.id === avaliacao.funcionario_id)?.first_name} {funcionarios.find(f => f.id === avaliacao.funcionario_id)?.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{avaliacao.periodo}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{new Date(avaliacao.data_inicio).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {funcionarios.find(f => f.id === avaliacao.avaliador_id)?.first_name} {funcionarios.find(f => f.id === avaliacao.avaliador_id)?.last_name}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
    </ProtectedRoute>
  );
}

