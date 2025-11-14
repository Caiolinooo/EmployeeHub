'use client';

import React, { useState, useEffect } from 'react';
import { FiUserPlus, FiUserMinus, FiSearch, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

interface Usuario {
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
  config_id: string;
  usuario_id: string;
  nome_completo: string;
  email: string;
  position: string;
  sistema_role: string;
  ativo: boolean;
  criado_em: string;
}

export default function PainelConfigGerentesAvaliacao() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [gerentesConfig, setGerentesConfig] = useState<GerenteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('todos');
  const [filterDepartment, setFilterDepartment] = useState<string>('todos');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carregar todos os usuários autorizados e ativos
      const { data: usuariosData, error: usuariosError } = await supabase
        .from('users_unified')
        .select('id, first_name, last_name, email, position, department, role, is_authorized, active')
        .eq('is_authorized', true)
        .eq('active', true)
        .order('first_name', { ascending: true });

      // Obter departamentos únicos para filtro
      const departamentos = [...new Set(usuariosData?.map(u => u.department).filter(Boolean) || [])];

      if (usuariosError) throw usuariosError;

      // Carregar configurações de gerentes de avaliação
      const { data: gerentesData, error: gerentesError } = await supabase
        .from('vw_gerentes_avaliacao_ativos')
        .select('*');

      if (gerentesError && gerentesError.code !== 'PGRST116') {
        throw gerentesError;
      }

      setUsuarios(usuariosData || []);
      setGerentesConfig(gerentesData || []);

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados. Tente recarregar a página.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGerente = async (usuarioId: string, isCurrentlyGerente: boolean) => {
    try {
      setUpdating(usuarioId);
      setError(null);
      setSuccess(null);

      // Chamar a função para adicionar/remover gerente
      const { data, error } = await supabase.rpc('toggle_gerente_avaliacao', {
        usuario_id_param: usuarioId,
        ativo_param: !isCurrentlyGerente
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        if (result.sucesso) {
          setSuccess(result.mensagem);
          await loadData(); // Recarregar dados

          // Limpar mensagem após 3 segundos
          setTimeout(() => setSuccess(null), 3000);
        } else {
          setError(result.mensagem);
        }
      }

    } catch (err) {
      console.error('Erro ao atualizar gerente:', err);
      setError('Erro ao atualizar configuração do gerente.');
    } finally {
      setUpdating(null);
    }
  };

  // Filtrar usuários com base nos critérios
  const filteredUsuarios = usuarios.filter(usuario => {
    const searchMatch = `${usuario.first_name} ${usuario.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.role?.toLowerCase().includes(searchTerm.toLowerCase());

    const roleMatch = filterRole === 'todos' || usuario.role === filterRole;
    const departmentMatch = filterDepartment === 'todos' || usuario.department === filterDepartment;

    return searchMatch && roleMatch && departmentMatch;
  });

  // Obter IDs de gerentes configurados
  const gerentesIds = new Set(gerentesConfig.map(g => g.usuario_id));

  // Separar usuários em gerentes e não gerentes
  const gerentesAtuais = filteredUsuarios.filter(u => gerentesIds.has(u.id));
  const naoGerentes = filteredUsuarios.filter(u => !gerentesIds.has(u.id));

  // Estatísticas
  const totalUsuarios = usuarios.length;
  const totalGerentes = gerentesAtuais.length;
  const totalDisponiveis = naoGerentes.length;

  // Obter roles únicas para filtro
  const uniqueRoles = [...new Set(usuarios.map(u => u.role))];
  const uniqueDepartments = [...new Set(usuarios.map(u => u.department).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
            <p className="font-medium mb-1">Como funciona?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Apenas usuários configurados aqui podem ser selecionados como "Gerente de Avaliação"</li>
              <li>Isso é independente da role do usuário (ADMIN/MANAGER/FUNCIONARY)</li>
              <li>Você pode adicionar ou remover gerentes a qualquer momento</li>
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

      {/* Botão de recarregar */}
      <div className="flex justify-end">
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Recarregar
        </button>
      </div>

      {/* Filtros e Busca */}
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

        {/* Botões de ação rápida */}
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
            onClick={() => setShowAllUsers(!showAllUsers)}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            {showAllUsers ? 'Mostrar Apenas Relevantes' : 'Mostrar Todos os Usuários'}
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Gerentes Ativos</p>
              <p className="text-2xl font-bold text-green-900">{gerentesAtuais.length}</p>
            </div>
            <FiUserPlus className="text-green-600" size={32} />
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Disponíveis</p>
              <p className="text-2xl font-bold text-gray-900">{naoGerentes.length}</p>
            </div>
            <FiUserMinus className="text-gray-600" size={32} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total de Usuários</p>
              <p className="text-2xl font-bold text-blue-900">{usuarios.length}</p>
            </div>
            <FiAlertCircle className="text-blue-600" size={32} />
          </div>
        </div>
      </div>

      {/* Gerentes Atuais - Tabela */}
      {gerentesAtuais.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="bg-green-50 px-6 py-4 border-b border-green-200">
            <h3 className="text-lg font-semibold text-green-900">
              👥 Gerentes de Avaliação Atuais ({gerentesAtuais.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                {gerentesAtuais.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
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

      {/* Usuários Disponíveis - Tabela */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900">
            👤 Usuários Disponíveis ({naoGerentes.length})
          </h3>
        </div>

        {naoGerentes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                {naoGerentes.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
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
              {searchTerm || filterRole !== 'todos' || filterDepartment !== 'todos'
                ? 'Nenhum usuário encontrado com os filtros aplicados.'
                : 'Todos os usuários já são gerentes de avaliação.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}