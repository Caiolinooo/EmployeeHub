'use client';

import React, { useState, useEffect } from 'react';
import { FiAward, FiX, FiSearch, FiAlertCircle } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  email: string;
  is_lider: boolean;
}

export default function PainelLideresSetor() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  const carregarFuncionarios = async () => {
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, departamento, email, is_lider')
        .eq('status', 'ativo')
        .order('nome');

      if (error) {
        console.error('Erro ao carregar funcionários:', error);
        return;
      }

      setFuncionarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLider = async (funcionarioId: string, isLider: boolean) => {
    setUpdating(funcionarioId);
    try {
      const { error } = await supabase
        .from('funcionarios')
        .update({ is_lider: !isLider })
        .eq('id', funcionarioId);

      if (error) {
        console.error('Erro ao atualizar líder:', error);
        alert('Erro ao atualizar líder de setor');
        return;
      }

      await carregarFuncionarios();
    } catch (error) {
      console.error('Erro ao atualizar líder:', error);
      alert('Erro ao atualizar líder de setor');
    } finally {
      setUpdating(null);
    }
  };

  const funcionariosFiltrados = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cargo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.departamento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lideres = funcionariosFiltrados.filter(f => f.is_lider);
  const naoLideres = funcionariosFiltrados.filter(f => !f.is_lider);

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
        <h2 className="text-2xl font-bold text-gray-900">Líderes de Setor</h2>
        <p className="text-gray-600 mt-2">
          Configure quais funcionários são líderes de setor e devem responder às questões de liderança na avaliação.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start">
          <FiAlertCircle className="text-purple-600 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <div className="text-sm text-purple-800">
            <p className="font-medium mb-1">Critérios de Liderança</p>
            <p>
              Líderes de setor devem responder aos critérios específicos de liderança durante a avaliação:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Liderança - Delegar:</strong> Capacidade de delegar tarefas e acompanhar resultados</li>
              <li><strong>Liderança - Desenvolvimento de Equipe:</strong> Capacidade de desenvolver e capacitar membros da equipe</li>
            </ul>
            <p className="mt-2">
              Colaboradores que não são líderes não verão estas questões em suas avaliações.
            </p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome, cargo, departamento ou email..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Líderes Ativos</p>
              <p className="text-2xl font-bold text-purple-900">{lideres.length}</p>
            </div>
            <FiAward className="text-purple-600" size={32} />
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total de Funcionários</p>
              <p className="text-2xl font-bold text-gray-900">{funcionarios.length}</p>
            </div>
            <FiAward className="text-gray-600" size={32} />
          </div>
        </div>
      </div>

      {/* Lista de Líderes Atuais */}
      {lideres.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Líderes de Setor Atuais
          </h3>
          <div className="grid gap-3">
            {lideres.map((funcionario) => (
              <div key={funcionario.id} className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-purple-100 rounded-full p-2">
                      <FiAward className="text-purple-600" size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{funcionario.nome}</h4>
                      <div className="text-sm text-gray-600 space-x-2">
                        {funcionario.cargo && <span>{funcionario.cargo}</span>}
                        {funcionario.cargo && funcionario.departamento && <span>•</span>}
                        {funcionario.departamento && <span>{funcionario.departamento}</span>}
                      </div>
                      {funcionario.email && (
                        <p className="text-xs text-gray-500 mt-1">{funcionario.email}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleLider(funcionario.id, funcionario.is_lider)}
                    disabled={updating === funcionario.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {updating === funcionario.id ? 'Removendo...' : 'Remover'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Funcionários Disponíveis */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Adicionar Líderes de Setor
        </h3>
        {naoLideres.length > 0 ? (
          <div className="grid gap-3">
            {naoLideres.map((funcionario) => (
              <div key={funcionario.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gray-100 rounded-full p-2">
                      <FiAward className="text-gray-400" size={20} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{funcionario.nome}</h4>
                      <div className="text-sm text-gray-600 space-x-2">
                        {funcionario.cargo && <span>{funcionario.cargo}</span>}
                        {funcionario.cargo && funcionario.departamento && <span>•</span>}
                        {funcionario.departamento && <span>{funcionario.departamento}</span>}
                      </div>
                      {funcionario.email && (
                        <p className="text-xs text-gray-500 mt-1">{funcionario.email}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleLider(funcionario.id, funcionario.is_lider)}
                    disabled={updating === funcionario.id}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {updating === funcionario.id ? 'Adicionando...' : 'Adicionar como Líder'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              {searchTerm
                ? 'Nenhum funcionário encontrado com os critérios de busca.'
                : 'Todos os funcionários já são líderes de setor.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
