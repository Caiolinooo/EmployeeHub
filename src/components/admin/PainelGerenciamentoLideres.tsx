'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiUser, FiUsers, FiCheck, FiX, FiSearch } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import { 
import { useI18n } from '@/contexts/I18nContext';
  listarLideresAtivos, 
  adicionarLider, 
  removerLider, 
  type DadosLideranca 
} from '@/lib/utils/lideranca';

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function PainelGerenciamentoLideres() {
  const { t } = useI18n();

  const [lideres, setLideres] = useState<DadosLideranca[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    user_id: '',
    cargo_lideranca: '',
    departamento: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar líderes ativos
      const lideresAtivos = await listarLideresAtivos();
      setLideres(lideresAtivos);

      // Carregar todos os usuários
      const { data: todosUsuarios, error } = await supabase
        .from('users_unified')
        .select('id, name, email, role')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error(t('components.erroAoCarregarUsuarios'), error);
        return;
      }

      setUsuarios(todosUsuarios || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const sucesso = await adicionarLider(
        formData.user_id,
        formData.cargo_lideranca,
        formData.departamento || undefined
      );

      if (sucesso) {
        await carregarDados();
        fecharModal();
        alert('Líder adicionado com sucesso!');
      } else {
        alert('Erro ao adicionar líder');
      }
    } catch (error) {
      console.error(t('components.erroAoAdicionarLider'), error);
      alert('Erro ao adicionar líder');
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (userId: string, nomeUsuario: string) => {
    if (!confirm(t('components.temCertezaQueDesejaRemoverNomeusuarioDaFuncaoDeLid'))) {
      return;
    }

    try {
      const sucesso = await removerLider(userId);
      
      if (sucesso) {
        await carregarDados();
        alert('Líder removido com sucesso!');
      } else {
        alert('Erro ao remover líder');
      }
    } catch (error) {
      console.error(t('components.erroAoRemoverLider'), error);
      alert('Erro ao remover líder');
    }
  };

  const fecharModal = () => {
    setShowModal(false);
    setFormData({
      user_id: '',
      cargo_lideranca: '',
      departamento: ''
    });
  };

  const usuariosFiltrados = usuarios.filter(usuario =>
    usuario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const usuariosNaoLideres = usuariosFiltrados.filter(usuario =>
    !lideres.some(lider => lider.user_id === usuario.id)
  );

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  if (loading && lideres.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gerenciamento de Líderes</h2>
          <p className="text-gray-600">
            Gerencie usuários com funções de liderança para critérios específicos de avaliação
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="mr-2" size={16} />
          Adicionar Líder
        </button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiUsers className="text-blue-600" size={20} />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total de Líderes</p>
              <p className="text-2xl font-semibold text-gray-900">{lideres.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <FiUser className="text-green-600" size={20} />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Usuários Ativos</p>
              <p className="text-2xl font-semibold text-gray-900">{usuarios.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FiCheck className="text-purple-600" size={20} />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Departamentos</p>
              <p className="text-2xl font-semibold text-gray-900">
                {new Set(lideres.map(l => l.departamento).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Líderes */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Líderes Ativos</h3>
        </div>

        {lideres.length === 0 ? (
          <div className="text-center py-12">
            <FiUsers className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum líder cadastrado</h3>
            <p className="text-gray-600 mb-4">Adicione o primeiro líder para começar.</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="mr-2" size={16} />
              Adicionar Líder
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cargo de Liderança
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Departamento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data de Início
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lideres.map((lider) => (
                  <tr key={lider.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <FiUser className="text-blue-600" size={16} />
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {(lider as any).users_unified?.name || t('components.nomeNaoEncontrado')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {(lider as any).users_unified?.email || t('components.emailNaoEncontrado')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {lider.cargo_lideranca}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lider.departamento || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatarData(lider.data_inicio)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleRemover(
                          lider.user_id, 
                          (lider as any).users_unified?.name || t('components.usuario')
                        )}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title={t('components.removerLideranca')}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Adição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Adicionar Líder</h3>
              <button
                onClick={fecharModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuário *
                </label>
                <div className="relative mb-2">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder={t('components.buscarUsuario')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, user_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um usuário</option>
                  {usuariosNaoLideres.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.name} ({usuario.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo de Liderança *
                </label>
                <select
                  value={formData.cargo_lideranca}
                  onChange={(e) => setFormData(prev => ({ ...prev, cargo_lideranca: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um cargo</option>
                  <option value="Gerente">Gerente</option>
                  <option value="Coordenador">Coordenador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value={t('components.liderDeEquipe')}>Líder de Equipe</option>
                  <option value="Diretor">Diretor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departamento
                </label>
                <input
                  type="text"
                  value={formData.departamento}
                  onChange={(e) => setFormData(prev => ({ ...prev, departamento: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: TI, RH, Vendas..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
