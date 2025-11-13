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
  FiRefreshCw,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

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

interface GerenteResponse {
  usuarios: User[];
  gerentesAtuais: User[];
  usuariosDisponiveis: User[];
  gerentesConfig: GerenteConfig[];
  estatisticas: {
    totalUsuarios: number;
    totalGerentes: number;
    totalDisponiveis: number;
  };
}

export default function PainelConfigGerentesAvaliacaoAdvanced() {
  const [data, setData] = useState<GerenteResponse | null>(null);
  const [mapeamentosEdit, setMapeamentosEdit] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    departamento: '',
    cargo: '',
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithToken('/api/admin/gerentes-avaliacao');

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao carregar dados');
      }

      setData(result.data);

      // Criar mapa de mapeamentos para edição
      const mapeamentosObj: Record<string, string> = {};
      result.data.gerentesConfig.forEach((config: GerenteConfig) => {
        mapeamentosObj[config.colaborador_id] = config.gerente_id;
      });
      setMapeamentosEdit(mapeamentosObj);

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados. Tente recarregar a página.');
    } finally {
      setLoading(false);
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithToken('/api/admin/gerentes-avaliacao');

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao carregar dados');
      }

      setData(result.data);

      // Criar mapa de mapeamentos para edição
      const mapeamentosObj: Record<string, string> = {};
      result.data.gerentesConfig.forEach((config: GerenteConfig) => {
        mapeamentosObj[config.colaborador_id] = config.gerente_id;
      });
      setMapeamentosEdit(mapeamentosObj);

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados. Tente recarregar a página.');
    } finally {
      setLoading(false);
    }
  };

  const salvarMapeamento = async (colaborador_id: string, gerente_id: string) => {
    try {
      if (colaborador_id === gerente_id) {
        setError('❌ Erro: Um usuário não pode ser gerente de si mesmo!');
        return false;
      }

      const response = await fetchWithToken('/api/admin/gerentes-avaliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaborador_id, gerente_id }),
      });

      const result = await response.json();

      if (result.success) {
        return true;
      } else {
        setError(`Erro: ${result.error}`);
        return false;
      }
    } catch (err) {
      console.error('Erro ao salvar mapeamento:', err);
      setError('Erro ao salvar mapeamento');
      return false;
    }
  };

  const salvarTodosMapeamentos = async () => {
    try {
      setSalvando(true);
      setError(null);
      setSuccess(null);
      
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
        setSuccess(`✅ ${sucesso} mapeamentos salvos com sucesso!`);
        await carregarDados();
      } else {
        setError(`⚠️ ${sucesso} salvos, ${erros} com erro`);
        await carregarDados();
      }

      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    } catch (err) {
      console.error('Erro ao salvar mapeamentos:', err);
      setError('Erro ao salvar mapeamentos');
    } finally {
      setSalvando(false);
    }
  };

  const atualizarMapeamento = (colaboradorId: string, gerenteId: string) => {
    if (colaboradorId === gerenteId) {
      setError('❌ Um usuário não pode ser gerente de si mesmo!');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setMapeamentosEdit((prev) => ({
      ...prev,
      [colaboradorId]: gerenteId,
    }));
  };

  if (!data) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Filtrar usuários
  const filteredUsuarios = data.usuarios.filter(usuario => {
    const searchMatch = `${usuario.first_name} ${usuario.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.role?.toLowerCase().includes(searchTerm.toLowerCase());

    const roleMatch = filterRole === 'todos' || usuario.role === filterRole;
    const departmentMatch = filterDepartment === 'todos' || usuario.department === filterDepartment;

    return searchMatch && roleMatch && departmentMatch;
  });

  // Separar usuários
  const gerentesAtuais = filteredUsuarios.filter(u => data.gerentesConfig.some(g => g.usuario_id === u.id));
  const usuariosDisponiveis = filteredUsuarios.filter(u => !data.gerentesConfig.some(g => g.usuario_id === u.id));

  // Se mostrar apenas selecionados
  const displayGerentes = showOnlySelected
    ? gerentesAtuais.filter(u => selectedUsers.includes(u.id))
    : gerentesAtuais;
  const displayDisponiveis = showOnlySelected
    ? usuariosDisponiveis.filter(u => selectedUsers.includes(u.id))
    : usuariosDisponiveis;

  const uniqueRoles = [...new Set(data.usuarios.map(u => u.role))];
  const uniqueDepartments = [...new Set(data.usuarios.map(u => u.department).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configurar Gerentes de Avaliação</h2>
        <p className="text-gray-600 mt-2">
          Defina quais usuários podem atuar como gerentes de avaliação, independente da sua role no sistema.
        </p>
      </div>

      {/* Alerta de informação */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <FiAlertCircle className="text-blue-600 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Sistema Avançado de Gerenciamento</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Totalmente independente das roles do sistema (ADMIN/MANAGER/FUNCIONARY)</li>
              <li>Selecione múltiplos usuários para operações em lote</li>
              <li>Filtre por role, departamento ou busca por nome/email</li>
              <li>A configuração afeta apenas o módulo de avaliação</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md">
          <p>{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <p>{error}</p>
        </div>
      )}

      {/* Botões de ação e estatísticas */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <span className="text-sm text-gray-600">
            {selectedUsers.length} usuário(s) selecionado(s)
          </span>
          {selectedUsers.length > 0 && (
            <>
              <button
                onClick={() => bulkToggleGerentes(true)}
                disabled={bulkUpdating}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                {bulkUpdating ? 'Processando...' : 'Tornar Gerentes'}
              </button>
              <button
                onClick={() => bulkToggleGerentes(false)}
                disabled={bulkUpdating}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {bulkUpdating ? 'Processando...' : 'Remover Gerentes'}
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                Limpar Seleção
              </button>
            </>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total de Usuários</p>
              <p className="text-2xl font-bold text-blue-900">{data.estatisticas.totalUsuarios}</p>
            </div>
            <FiAlertCircle className="text-blue-600" size={32} />
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Gerentes Ativos</p>
              <p className="text-2xl font-bold text-green-900">{data.estatisticas.totalGerentes}</p>
            </div>
            <FiUserPlus className="text-green-600" size={32} />
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Disponíveis</p>
              <p className="text-2xl font-bold text-gray-900">{data.estatisticas.totalDisponiveis}</p>
            </div>
            <FiUserMinus className="text-gray-600" size={32} />
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Selecionados</p>
              <p className="text-2xl font-bold text-purple-900">{selectedUsers.length}</p>
            </div>
            <FiCheckSquare className="text-purple-600" size={32} />
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiSearch className="inline mr-1" />
                Buscar Usuários
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, email, cargo ou role..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="min-w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiFilter className="inline mr-1" />
                Filtrar por Role
              </label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todas as Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="min-w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Departamento
              </label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos os Departamentos</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRole('todos');
                setFilterDepartment('todos');
              }}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Limpar Filtros
            </button>
            <button
              onClick={() => setShowOnlySelected(!showOnlySelected)}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
            >
              {showOnlySelected ? 'Mostrar Todos' : 'Mostrar Apenas Selecionados'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Gerentes Atuais */}
      {displayGerentes.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="bg-green-50 px-6 py-4 border-b border-green-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-green-900">
                👥 Gerentes de Avaliação Atuais ({displayGerentes.length})
              </h3>
              <button
                onClick={() => selectAllVisible(displayGerentes)}
                className="text-sm text-green-700 hover:text-green-900"
              >
                <FiCheckSquare className="inline mr-1" />
                Selecionar Todos
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={displayGerentes.every(u => selectedUsers.includes(u.id))}
                      onChange={() => selectAllVisible(displayGerentes)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cargo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role Sistema
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Departamento
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayGerentes.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(usuario.id)}
                        onChange={() => toggleUserSelection(usuario.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="bg-green-100 rounded-full p-1 mr-3">
                          <FiUserPlus className="text-green-600" size={16} />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.first_name} {usuario.last_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {usuario.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {usuario.position || 'Sem cargo'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {usuario.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {usuario.department || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleGerente(usuario.id, true)}
                        disabled={updating === usuario.id}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {updating === usuario.id ? 'Removendo...' : 'Remover'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela de Usuários Disponíveis */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-blue-900">
              👤 Usuários Disponíveis ({displayDisponiveis.length})
            </h3>
            <button
              onClick={() => selectAllVisible(displayDisponiveis)}
              className="text-sm text-blue-700 hover:text-blue-900"
            >
              <FiCheckSquare className="inline mr-1" />
              Selecionar Todos
            </button>
          </div>
        </div>

        {displayDisponiveis.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={displayDisponiveis.every(u => selectedUsers.includes(u.id))}
                      onChange={() => selectAllVisible(displayDisponiveis)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cargo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role Sistema
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Departamento
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayDisponiveis.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(usuario.id)}
                        onChange={() => toggleUserSelection(usuario.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="bg-gray-100 rounded-full p-1 mr-3">
                          <FiUserMinus className="text-gray-400" size={16} />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.first_name} {usuario.last_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {usuario.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {usuario.position || 'Sem cargo'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {usuario.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {usuario.department || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleGerente(usuario.id, false)}
                        disabled={updating === usuario.id}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {updating === usuario.id ? 'Adicionando...' : 'Tornar Gerente'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50">
            <p className="text-gray-600">
              {searchTerm || filterRole !== 'todos' || filterDepartment !== 'todos' || showOnlySelected
                ? 'Nenhum usuário encontrado com os filtros aplicados.'
                : 'Todos os usuários já são gerentes de avaliação.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}