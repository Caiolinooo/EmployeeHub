'use client';

import React, { useState, useEffect } from 'react';
import {
  FiUsers,
  FiSave,
  FiAlertCircle,
  FiSearch,
  FiCheck,
  FiX,
  FiUserCheck,
  FiUserPlus,
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
  is_authorized: boolean;
  active: boolean;
}

interface GerenteConfig {
  gerente_id: string;
  colaborador_id: string;
  ativo: boolean;
}

interface MapeamentoEdit {
  colaborador_id: string;
  gerente_id: string;
}

export default function GerentesLideresPage() {
  const { user, isAdmin } = useSupabaseAuth();
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [gerentesAtuais, setGerentesAtuais] = useState<User[]>([]);
  const [gerentesConfig, setGerentesConfig] = useState<GerenteConfig[]>([]);
  const [mapeamentosEdit, setMapeamentosEdit] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [visuMode, setVisuMode] = useState<'colaboradores' | 'gerentes'>('colaboradores');
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
      const token = localStorage.getItem('abzToken') || localStorage.getItem('token');

      const response = await fetch('/api/admin/gerentes-avaliacao', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success) {
        setUsuarios(data.data.usuarios || []);
        setGerentesAtuais(data.data.gerentesAtuais || []);
        setGerentesConfig(data.data.gerentesConfig || []);

        // Criar mapa de mapeamentos para edição
        const mapeamentosObj: Record<string, string> = {};
        data.data.gerentesConfig.forEach((config: GerenteConfig) => {
          mapeamentosObj[config.colaborador_id] = config.gerente_id;
        });
        setMapeamentosEdit(mapeamentosObj);
      } else {
        console.error('Erro ao carregar dados:', data.error);
        alert('Erro ao carregar dados: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const salvarMapeamento = async (colaborador_id: string, gerente_id: string) => {
    try {
      const token = localStorage.getItem('abzToken') || localStorage.getItem('token');

      if (colaborador_id === gerente_id) {
        alert('❌ Erro: Um usuário não pode ser gerente de si mesmo!');
        return false;
      }

      const response = await fetch('/api/admin/gerentes-avaliacao', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ colaborador_id, gerente_id }),
      });

      const data = await response.json();

      if (data.success) {
        return true;
      } else {
        alert(`Erro: ${data.error}`);
        return false;
      }
    } catch (error) {
      console.error('Erro ao salvar mapeamento:', error);
      alert('Erro ao salvar mapeamento');
      return false;
    }
  };

  const salvarTodosMapeamentos = async () => {
    try {
      setSalvando(true);
      let sucesso = 0;
      let erros = 0;

      for (const [colaborador_id, gerente_id] of Object.entries(mapeamentosEdit)) {
        if (gerente_id) {
          const resultado = await salvarMapeamento(colaborador_id, gerente_id);
          if (resultado) sucesso++;
          else erros++;
        }
      }

      if (erros === 0) {
        alert(`✅ ${sucesso} mapeamentos salvos com sucesso!`);
        await carregarDados();
      } else {
        alert(`⚠️ ${sucesso} salvos, ${erros} com erro`);
        await carregarDados();
      }
    } catch (error) {
      console.error('Erro ao salvar mapeamentos:', error);
      alert('Erro ao salvar mapeamentos');
    } finally {
      setSalvando(false);
    }
  };

  const atualizarMapeamento = (colaboradorId: string, gerenteId: string) => {
    if (colaboradorId === gerenteId) {
      alert('❌ Um usuário não pode ser gerente de si mesmo!');
      return;
    }
    setMapeamentosEdit((prev) => ({
      ...prev,
      [colaboradorId]: gerenteId,
    }));
  };

  const colaboradoresFiltrados = usuarios.filter((u) => {
    const nomeCompleto = `${u.first_name} ${u.last_name}`;
    const matchBusca =
      nomeCompleto.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase()) ||
      u.position?.toLowerCase().includes(busca.toLowerCase());

    const matchDepartamento =
      !filtros.departamento || u.department === filtros.departamento;

    const matchCargo = !filtros.cargo || u.position === filtros.cargo;

    return matchBusca && matchDepartamento && matchCargo;
  });

  const departamentos = Array.from(
    new Set(usuarios.map((f) => f.department).filter(Boolean))
  );
  const cargos = Array.from(
    new Set(usuarios.map((f) => f.position).filter(Boolean))
  );

  const totalMapeados = Object.keys(mapeamentosEdit).filter(
    (key) => mapeamentosEdit[key]
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
            Configuração de Gerentes de Avaliação
          </h1>
          <p className="text-gray-600">
            Defina qual gerente será responsável por avaliar cada colaborador
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
                  <strong>Gerente:</strong> Responsável por avaliar o desempenho do colaborador nas perguntas Q15-Q17
                </li>
                <li>
                  O colaborador preenche a autoavaliação (Q11-Q14) e o gerente revisa e completa (Q15-Q17)
                </li>
                <li>
                  Colaboradores sem gerente configurado <strong>NÃO</strong> receberão avaliações automaticamente
                </li>
                <li>
                  <strong className="text-red-600">Não é possível configurar alguém como gerente de si mesmo</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Usuários</p>
                <p className="text-2xl font-bold text-gray-900">{usuarios.length}</p>
              </div>
              <FiUsers className="text-blue-600" size={32} />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gerentes Configurados</p>
                <p className="text-2xl font-bold text-green-600">{gerentesAtuais.length}</p>
              </div>
              <FiUserCheck className="text-green-600" size={32} />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Colaboradores Mapeados</p>
                <p className="text-2xl font-bold text-purple-600">{totalMapeados}</p>
              </div>
              <FiUserPlus className="text-purple-600" size={32} />
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
                  placeholder="Buscar colaborador..."
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
              {totalMapeados} de {usuarios.length} colaboradores com gerente definido
            </div>
            <button
              onClick={salvarTodosMapeamentos}
              disabled={salvando}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <FiSave className="mr-2" />
              {salvando ? 'Salvando...' : 'Salvar Todas Alterações'}
            </button>
          </div>
        </div>

        {/* Lista de Colaboradores */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando colaboradores...</p>
          </div>
        ) : colaboradoresFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FiUsers className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Nenhum colaborador encontrado
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
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {colaboradoresFiltrados.map((colaborador) => {
                    const temGerente = mapeamentosEdit[colaborador.id];
                    const gerenteAtual = usuarios.find(u => u.id === mapeamentosEdit[colaborador.id]);
                    
                    return (
                      <tr key={colaborador.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                              {colaborador.first_name?.[0]}
                              {colaborador.last_name?.[0]}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {colaborador.first_name} {colaborador.last_name}
                              </div>
                              <div className="text-sm text-gray-500">{colaborador.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{colaborador.position || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {colaborador.department || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={mapeamentosEdit[colaborador.id] || ''}
                            onChange={(e) =>
                              atualizarMapeamento(colaborador.id, e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Selecione um gerente</option>
                            {usuarios
                              .filter(u => u.id !== colaborador.id) // Não pode ser gerente de si mesmo
                              .map((gerente) => (
                                <option key={gerente.id} value={gerente.id}>
                                  {gerente.first_name} {gerente.last_name} ({gerente.position || 'Sem cargo'})
                                </option>
                              ))}
                          </select>
                          {gerenteAtual && (
                            <div className="mt-1 text-xs text-gray-500">
                              Atual: {gerenteAtual.first_name} {gerenteAtual.last_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {temGerente ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <FiCheck className="mr-1" />
                              Configurado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <FiAlertCircle className="mr-1" />
                              Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
