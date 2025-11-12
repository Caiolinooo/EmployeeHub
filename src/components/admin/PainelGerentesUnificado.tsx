/**
 * Painel Unificado de Gerentes de Avaliação
 *
 * Permite:
 * - Marcar usuários como gerentes (toggle)
 * - Expandir gerente para ver e configurar funcionários que ele avalia
 * - Buscar funcionários
 * - Checkbox para mapear funcionário → gerente
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  FiChevronDown,
  FiChevronRight,
  FiSearch,
  FiUser,
  FiUsers,
  FiCheckCircle,
  FiX,
  FiSave
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

interface Usuario {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  cargo?: string;
  position?: string;
  departamento?: string;
  department?: string;
}

interface Mapeamento {
  id: string;
  colaborador_id: string;
  gerente_id: string;
}

export default function PainelGerentesUnificado() {
  // Estados principais
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [gerentes, setGerentes] = useState<Set<string>>(new Set());
  const [mapeamentos, setMapeamentos] = useState<Mapeamento[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // Estados de busca e filtro
  const [buscaGeral, setBuscaGeral] = useState('');
  const [buscasPorGerente, setBuscasPorGerente] = useState<Record<string, string>>({});

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carregar usuários
      const respUsuarios = await fetchWithToken('/api/admin/gerentes-avaliacao');
      if (!respUsuarios.ok) throw new Error('Erro ao carregar usuários');

      const dataUsuarios = await respUsuarios.json();
      if (!dataUsuarios.success) throw new Error(dataUsuarios.error);

      setUsuarios(dataUsuarios.data.usuarios || []);

      // Identificar quem é gerente (quem tem mapeamentos como gerente)
      const gerentesIds = new Set(
        (dataUsuarios.data.gerentesConfig || [])
          .map((m: any) => m.gerente_id)
      );
      setGerentes(gerentesIds);

      // Carregar mapeamentos
      const respMapeamentos = await fetchWithToken('/api/avaliacao/mapeamento-gerentes?tipo=global');
      if (respMapeamentos.ok) {
        const dataMapeamentos = await respMapeamentos.json();
        if (dataMapeamentos.success) {
          setMapeamentos(dataMapeamentos.data || []);
        }
      }

    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleGerente = async (usuarioId: string) => {
    try {
      setSalvando(usuarioId);
      setError(null);

      const isAtualmenteGerente = gerentes.has(usuarioId);

      const response = await fetchWithToken('/api/admin/gerentes-avaliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioId,
          ativo: !isAtualmenteGerente
        })
      });

      if (!response.ok) throw new Error('Erro ao atualizar gerente');

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // Atualizar estado local
      const novosGerentes = new Set(gerentes);
      if (isAtualmenteGerente) {
        novosGerentes.delete(usuarioId);
        // Remover da lista de expandidos se estava expandido
        const novosExpandidos = new Set(expandidos);
        novosExpandidos.delete(usuarioId);
        setExpandidos(novosExpandidos);
      } else {
        novosGerentes.add(usuarioId);
      }
      setGerentes(novosGerentes);

      setSuccess(result.message);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error('Erro ao togglear gerente:', err);
      setError(err.message || 'Erro ao atualizar gerente');
    } finally {
      setSalvando(null);
    }
  };

  const toggleExpansao = (gerenteId: string) => {
    const novosExpandidos = new Set(expandidos);
    if (expandidos.has(gerenteId)) {
      novosExpandidos.delete(gerenteId);
    } else {
      novosExpandidos.add(gerenteId);
    }
    setExpandidos(novosExpandidos);
  };

  const toggleMapeamento = async (colaboradorId: string, gerenteId: string) => {
    try {
      setSalvando(`${colaboradorId}-${gerenteId}`);
      setError(null);

      const mapeamentoExiste = mapeamentos.some(
        m => m.colaborador_id === colaboradorId && m.gerente_id === gerenteId
      );

      if (mapeamentoExiste) {
        // Remover mapeamento
        const mapeamento = mapeamentos.find(
          m => m.colaborador_id === colaboradorId && m.gerente_id === gerenteId
        );

        if (mapeamento) {
          const response = await fetchWithToken(`/api/avaliacao/mapeamento-gerentes/${mapeamento.id}`, {
            method: 'DELETE'
          });

          if (!response.ok) throw new Error('Erro ao remover mapeamento');

          setMapeamentos(prev => prev.filter(m => m.id !== mapeamento.id));
        }
      } else {
        // Criar mapeamento
        const response = await fetchWithToken('/api/avaliacao/mapeamento-gerentes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            colaborador_id: colaboradorId,
            gerente_id: gerenteId,
            periodo_id: null // Global
          })
        });

        if (!response.ok) throw new Error('Erro ao criar mapeamento');

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        setMapeamentos(prev => [...prev, result.data]);
      }

      setSuccess('Mapeamento atualizado com sucesso!');
      setTimeout(() => setSuccess(null), 2000);

    } catch (err: any) {
      console.error('Erro ao atualizar mapeamento:', err);
      setError(err.message || 'Erro ao atualizar mapeamento');
    } finally {
      setSalvando(null);
    }
  };

  const isFuncionarioMapeado = (colaboradorId: string, gerenteId: string): boolean => {
    return mapeamentos.some(
      m => m.colaborador_id === colaboradorId && m.gerente_id === gerenteId
    );
  };

  const getFuncionariosDoGerente = (gerenteId: string): string[] => {
    return mapeamentos
      .filter(m => m.gerente_id === gerenteId)
      .map(m => m.colaborador_id);
  };

  // Filtrar usuários para lista de gerentes
  const usuariosFiltrados = usuarios.filter(u =>
    u.name?.toLowerCase().includes(buscaGeral.toLowerCase()) ||
    u.email?.toLowerCase().includes(buscaGeral.toLowerCase()) ||
    (u.cargo || u.position || '').toLowerCase().includes(buscaGeral.toLowerCase())
  );

  // Filtrar funcionários para lista dentro de um gerente específico
  const getFuncionariosFiltrados = (gerenteId: string) => {
    const busca = buscasPorGerente[gerenteId] || '';
    return usuarios
      .filter(u => u.id !== gerenteId) // Não mostrar o próprio gerente
      .filter(u =>
        u.name?.toLowerCase().includes(busca.toLowerCase()) ||
        u.email?.toLowerCase().includes(busca.toLowerCase()) ||
        (u.cargo || u.position || '').toLowerCase().includes(busca.toLowerCase())
      );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mensagens */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <FiX className="flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <FiX />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <FiCheckCircle className="flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Busca Geral */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar usuários por nome, email ou cargo..."
            value={buscaGeral}
            onChange={(e) => setBuscaGeral(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Lista de Usuários/Gerentes */}
      <div className="bg-white rounded-lg shadow-sm divide-y">
        {usuariosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FiUsers className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>Nenhum usuário encontrado</p>
          </div>
        ) : (
          usuariosFiltrados.map(usuario => {
            const isGerente = gerentes.has(usuario.id);
            const isExpandido = expandidos.has(usuario.id);
            const funcionariosDoGerente = getFuncionariosDoGerente(usuario.id);

            return (
              <div key={usuario.id} className="p-4">
                {/* Cabeçalho do Usuário */}
                <div className="flex items-center gap-3">
                  {/* Toggle Gerente */}
                  <button
                    onClick={() => toggleGerente(usuario.id)}
                    disabled={salvando === usuario.id}
                    className={`
                      flex-shrink-0 w-12 h-6 rounded-full transition-colors relative
                      ${isGerente ? 'bg-blue-600' : 'bg-gray-300'}
                      ${salvando === usuario.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className={`
                      absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform
                      ${isGerente ? 'transform translate-x-6' : ''}
                    `} />
                  </button>

                  {/* Botão Expandir (apenas se for gerente) */}
                  {isGerente && (
                    <button
                      onClick={() => toggleExpansao(usuario.id)}
                      className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      {isExpandido ? (
                        <FiChevronDown className="h-5 w-5 text-gray-600" />
                      ) : (
                        <FiChevronRight className="h-5 w-5 text-gray-600" />
                      )}
                    </button>
                  )}

                  {/* Info do Usuário */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FiUser className="flex-shrink-0 text-gray-400" />
                      <p className="font-medium text-gray-900 truncate">
                        {usuario.name}
                      </p>
                      {isGerente && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                          Gerente
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 flex gap-4">
                      <span>{usuario.email}</span>
                      {(usuario.cargo || usuario.position) && (
                        <span>• {usuario.cargo || usuario.position}</span>
                      )}
                      {funcionariosDoGerente.length > 0 && (
                        <span className="text-blue-600 font-medium">
                          • {funcionariosDoGerente.length} funcionário(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lista de Funcionários (quando expandido) */}
                {isGerente && isExpandido && (
                  <div className="mt-4 ml-16 pl-4 border-l-2 border-gray-200">
                    {/* Busca de Funcionários */}
                    <div className="mb-3">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          placeholder="Buscar funcionários..."
                          value={buscasPorGerente[usuario.id] || ''}
                          onChange={(e) => setBuscasPorGerente(prev => ({
                            ...prev,
                            [usuario.id]: e.target.value
                          }))}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Lista de Funcionários */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {getFuncionariosFiltrados(usuario.id).map(funcionario => {
                        const mapeado = isFuncionarioMapeado(funcionario.id, usuario.id);
                        const salvandoEste = salvando === `${funcionario.id}-${usuario.id}`;

                        return (
                          <label
                            key={funcionario.id}
                            className={`
                              flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors
                              ${mapeado ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}
                              ${salvandoEste ? 'opacity-50' : ''}
                            `}
                          >
                            <input
                              type="checkbox"
                              checked={mapeado}
                              onChange={() => toggleMapeamento(funcionario.id, usuario.id)}
                              disabled={salvandoEste}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {funcionario.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {funcionario.email}
                                {(funcionario.cargo || funcionario.position) &&
                                  ` • ${funcionario.cargo || funcionario.position}`
                                }
                              </p>
                            </div>
                          </label>
                        );
                      })}

                      {getFuncionariosFiltrados(usuario.id).length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Nenhum funcionário encontrado
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
