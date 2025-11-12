'use client';

import React, { useState, useEffect } from 'react';
import {
  FiUsers,
  FiSave,
  FiAlertCircle,
  FiSearch,
  FiCheck,
  FiEdit2,
} from 'react-icons/fi';
import MainLayout from '@/components/Layout/MainLayout';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position: string;
  department: string;
  role: string;
}

interface Mapeamento {
  colaborador_id: string;
  gerente_id: string | null;
  lider_id: string | null;
  periodo_id?: string | null;
}

export default function GerentesLideresPage() {
  const { user, isAdmin } = useSupabaseAuth();
  const [funcionarios, setFuncionarios] = useState<User[]>([]);
  const [gerentes, setGerentes] = useState<User[]>([]);
  const [mapeamentos, setMapeamentos] = useState<Record<string, Mapeamento>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState({
    departamento: '',
    cargo: '',
  });

  useEffect(() => {
    if (user && isAdmin) {
      carregarDados();
    }
  }, [user, isAdmin]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Carregar funcionários
      const resFuncionarios = await fetch('/api/users?role=USER&status=active', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const dataFuncionarios = await resFuncionarios.json();

      // Carregar gerentes (ADMIN e MANAGER)
      const resGerentes = await fetch('/api/users?role=MANAGER,ADMIN&status=active', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const dataGerentes = await resGerentes.json();

      // Carregar mapeamentos existentes
      const resMapeamentos = await fetch('/api/avaliacao/mapeamento-gerentes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const dataMapeamentos = await resMapeamentos.json();

      if (dataFuncionarios.success) {
        setFuncionarios(dataFuncionarios.users || []);
      }

      if (dataGerentes.success) {
        setGerentes(dataGerentes.users || []);
      }

      if (dataMapeamentos.success) {
        // Converter array de mapeamentos para objeto indexado por colaborador_id
        const mapeamentosObj: Record<string, Mapeamento> = {};
        dataMapeamentos.mapeamentos?.forEach((m: any) => {
          mapeamentosObj[m.colaborador_id] = {
            colaborador_id: m.colaborador_id,
            gerente_id: m.gerente_id,
            lider_id: m.lider_id || null,
            periodo_id: m.periodo_id || null,
          };
        });
        setMapeamentos(mapeamentosObj);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const salvarMapeamentos = async () => {
    try {
      setSalvando(true);
      const token = localStorage.getItem('token');

      // Converter objeto de mapeamentos para array
      const mapeamentosArray = Object.values(mapeamentos);

      const response = await fetch('/api/avaliacao/mapeamento-gerentes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mapeamentos: mapeamentosArray }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Mapeamentos salvos com sucesso!');
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao salvar mapeamentos:', error);
      alert('Erro ao salvar mapeamentos');
    } finally {
      setSalvando(false);
    }
  };

  const atualizarMapeamento = (
    colaboradorId: string,
    campo: 'gerente_id' | 'lider_id',
    valor: string
  ) => {
    setMapeamentos((prev) => ({
      ...prev,
      [colaboradorId]: {
        ...(prev[colaboradorId] || {
          colaborador_id: colaboradorId,
          gerente_id: null,
          lider_id: null,
        }),
        [campo]: valor || null,
      },
    }));
  };

  const funcionariosFiltrados = funcionarios.filter((f) => {
    const matchBusca =
      `${f.first_name} ${f.last_name}`.toLowerCase().includes(busca.toLowerCase()) ||
      f.email.toLowerCase().includes(busca.toLowerCase()) ||
      f.position?.toLowerCase().includes(busca.toLowerCase());

    const matchDepartamento =
      !filtros.departamento || f.department === filtros.departamento;

    const matchCargo = !filtros.cargo || f.position === filtros.cargo;

    return matchBusca && matchDepartamento && matchCargo;
  });

  const departamentos = Array.from(
    new Set(funcionarios.map((f) => f.department).filter(Boolean))
  );
  const cargos = Array.from(
    new Set(funcionarios.map((f) => f.position).filter(Boolean))
  );

  const totalMapeados = Object.values(mapeamentos).filter(
    (m) => m.gerente_id !== null
  ).length;

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto text-center py-12">
          <FiAlertCircle className="mx-auto h-16 w-16 text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Configuração de Gerentes e Líderes
          </h1>
          <p className="text-gray-600">
            Defina o gerente (avaliador) e o líder de cada colaborador
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <FiAlertCircle className="text-blue-600 mt-0.5 mr-3" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Importante:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Gerente (Avaliador):</strong> Responsável por avaliar o desempenho do
                  colaborador
                </li>
                <li>
                  <strong>Líder:</strong> Líder técnico ou de equipe (quando aplicável)
                </li>
                <li>As perguntas 16 e 17 (Liderança) só aparecem se o colaborador for um líder</li>
                <li>
                  Colaboradores sem gerente configurado <strong>NÃO</strong> receberão avaliações
                  automaticamente
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Barra de Ferramentas */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar funcionário..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <select
                value={filtros.departamento}
                onChange={(e) => setFiltros({ ...filtros, departamento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os departamentos</option>
                {departamentos.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filtros.cargo}
                onChange={(e) => setFiltros({ ...filtros, cargo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os cargos</option>
                {cargos.map((cargo) => (
                  <option key={cargo} value={cargo}>
                    {cargo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              <FiCheck className="inline text-green-600 mr-1" />
              {totalMapeados} de {funcionarios.length} colaboradores com gerente definido
            </div>
            <button
              onClick={salvarMapeamentos}
              disabled={salvando}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <FiSave className="mr-2" />
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Lista de Funcionários */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando funcionários...</p>
          </div>
        ) : funcionariosFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FiUsers className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Nenhum funcionário encontrado
            </h3>
            <p className="text-gray-600">
              Ajuste os filtros ou busca para ver os resultados
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Colaborador
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cargo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Departamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gerente (Avaliador)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Líder
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {funcionariosFiltrados.map((funcionario) => (
                    <tr key={funcionario.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {funcionario.first_name?.[0]}
                            {funcionario.last_name?.[0]}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {funcionario.first_name} {funcionario.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{funcionario.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{funcionario.position || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {funcionario.department || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={mapeamentos[funcionario.id]?.gerente_id || ''}
                          onChange={(e) =>
                            atualizarMapeamento(funcionario.id, 'gerente_id', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Selecione um gerente</option>
                          {gerentes.map((gerente) => (
                            <option key={gerente.id} value={gerente.id}>
                              {gerente.first_name} {gerente.last_name} ({gerente.position})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={mapeamentos[funcionario.id]?.lider_id || ''}
                          onChange={(e) =>
                            atualizarMapeamento(funcionario.id, 'lider_id', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Sem líder</option>
                          {gerentes.map((lider) => (
                            <option key={lider.id} value={lider.id}>
                              {lider.first_name} {lider.last_name} ({lider.position})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
