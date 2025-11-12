'use client';

import React, { useState, useEffect } from 'react';
import { FiUsers, FiCheck, FiX, FiSearch, FiSave, FiAlertCircle } from 'react-icons/fi';
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
  status: string;
}

export default function UsuariosElegiveis Page() {
  const { user, isAdmin } = useSupabaseAuth();
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [elegiveisIds, setElegiveisIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState({
    departamento: '',
    cargo: '',
    status: 'active',
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

      // Carregar todos os usuários
      const resUsuarios = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const dataUsuarios = await resUsuarios.json();

      // Carregar usuários já elegíveis
      const resElegiveis = await fetch('/api/avaliacao/usuarios-elegiveis', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const dataElegiveis = await resElegiveis.json();

      if (dataUsuarios.success) {
        setUsuarios(dataUsuarios.users || []);
      }

      if (dataElegiveis.success) {
        const ids = new Set(dataElegiveis.usuarios?.map((u: any) => u.usuario_id) || []);
        setElegiveisIds(ids);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleElegivel = (userId: string) => {
    setElegiveisIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleTodos = () => {
    const todosSelecionados = usuarios.length === elegiveisIds.size;
    if (todosSelecionados) {
      setElegiveisIds(new Set());
    } else {
      setElegiveisIds(new Set(usuarios.map((u) => u.id)));
    }
  };

  const salvar = async () => {
    try {
      setSalvando(true);
      const token = localStorage.getItem('token');

      const response = await fetch('/api/avaliacao/usuarios-elegiveis', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usuarios_ids: Array.from(elegiveisIds),
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Usuários elegíveis salvos com sucesso!');
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar usuários elegíveis');
    } finally {
      setSalvando(false);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchBusca =
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase());

    const matchDepartamento = !filtros.departamento || u.department === filtros.departamento;
    const matchCargo = !filtros.cargo || u.position === filtros.cargo;
    const matchStatus = !filtros.status || u.status === filtros.status;

    return matchBusca && matchDepartamento && matchCargo && matchStatus;
  });

  const departamentos = Array.from(new Set(usuarios.map((u) => u.department).filter(Boolean)));
  const cargos = Array.from(new Set(usuarios.map((u) => u.position).filter(Boolean)));

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Usuários Elegíveis</h1>
          <p className="text-gray-600">
            Selecione quais usuários devem receber avaliações automaticamente
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <FiAlertCircle className="text-blue-600 mt-0.5 mr-3" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Como funciona:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Apenas usuários selecionados receberão avaliações automaticamente</li>
                <li>Usuários precisam ter um gerente configurado para receber avaliação</li>
                <li>Mudanças aqui afetam os próximos períodos de avaliação</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="md:col-span-2">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar usuário..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <select
              value={filtros.departamento}
              onChange={(e) => setFiltros({ ...filtros, departamento: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os departamentos</option>
              {departamentos.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>

            <select
              value={filtros.cargo}
              onChange={(e) => setFiltros({ ...filtros, cargo: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os cargos</option>
              {cargos.map((cargo) => (
                <option key={cargo} value={cargo}>{cargo}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTodos}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {usuarios.length === elegiveisIds.size ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
              <span className="text-sm text-gray-600">
                <FiCheck className="inline text-green-600 mr-1" />
                {elegiveisIds.size} de {usuarios.length} selecionados
              </span>
            </div>

            <button
              onClick={salvar}
              disabled={salvando}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <FiSave className="mr-2" />
              {salvando ? 'Salvando...' : 'Salvar Seleção'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando usuários...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={usuarios.length === elegiveisIds.size && usuarios.length > 0}
                      onChange={toggleTodos}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cargo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Departamento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={elegiveisIds.has(usuario.id)}
                        onChange={() => toggleElegivel(usuario.id)}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {usuario.first_name?.[0]}{usuario.last_name?.[0]}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {usuario.first_name} {usuario.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{usuario.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {usuario.position || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {usuario.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          usuario.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {usuario.status}
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
  );
}
