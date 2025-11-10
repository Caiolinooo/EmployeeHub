'use client';

import React, { useState, useEffect } from 'react';
import { FiUserCheck, FiX, FiSearch, FiAlertCircle } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  email: string;
  is_gerente_avaliacao: boolean;
}

export default function PainelGerentesAvaliacao() {
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
        .select('id, nome, cargo, departamento, email, is_gerente_avaliacao')
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

  const toggleGerenteAvaliacao = async (funcionarioId: string, isGerente: boolean) => {
    setUpdating(funcionarioId);
    try {
      const { error } = await supabase
        .from('funcionarios')
        .update({ is_gerente_avaliacao: !isGerente })
        .eq('id', funcionarioId);

      if (error) {
        console.error('Erro ao atualizar gerente:', error);
        alert('Erro ao atualizar gerente de avaliação');
        return;
      }

      await carregarFuncionarios();
    } catch (error) {
      console.error('Erro ao atualizar gerente:', error);
      alert('Erro ao atualizar gerente de avaliação');
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

  const gerentes = funcionariosFiltrados.filter(f => f.is_gerente_avaliacao);
  const naoGerentes = funcionariosFiltrados.filter(f => !f.is_gerente_avaliacao);

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
        <h2 className="text-2xl font-bold text-gray-900">Gerentes de Avaliação</h2>
        <p className="text-gray-600 mt-2">
          Configure quais funcionários são responsáveis por aprovar e revisar as avaliações de desempenho.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <FiAlertCircle className="text-blue-600 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">O que são Gerentes de Avaliação?</p>
            <p>
              Gerentes de avaliação são responsáveis por revisar, aprovar ou editar as autoavaliações
              preenchidas pelos colaboradores. Eles também podem adicionar comentários finais nas avaliações.
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
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Gerentes Ativos</p>
              <p className="text-2xl font-bold text-green-900">{gerentes.length}</p>
            </div>
            <FiUserCheck className="text-green-600" size={32} />
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total de Funcionários</p>
              <p className="text-2xl font-bold text-gray-900">{funcionarios.length}</p>
            </div>
            <FiUserCheck className="text-gray-600" size={32} />
          </div>
        </div>
      </div>

      {/* Lista de Gerentes Atuais */}
      {gerentes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Gerentes de Avaliação Atuais
          </h3>
          <div className="grid gap-3">
            {gerentes.map((funcionario) => (
              <div key={funcionario.id} className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-green-100 rounded-full p-2">
                      <FiUserCheck className="text-green-600" size={20} />
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
                    onClick={() => toggleGerenteAvaliacao(funcionario.id, funcionario.is_gerente_avaliacao)}
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
          Adicionar Gerentes de Avaliação
        </h3>
        {naoGerentes.length > 0 ? (
          <div className="grid gap-3">
            {naoGerentes.map((funcionario) => (
              <div key={funcionario.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gray-100 rounded-full p-2">
                      <FiUserCheck className="text-gray-400" size={20} />
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
                    onClick={() => toggleGerenteAvaliacao(funcionario.id, funcionario.is_gerente_avaliacao)}
                    disabled={updating === funcionario.id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {updating === funcionario.id ? 'Adicionando...' : 'Adicionar como Gerente'}
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
                : 'Todos os funcionários já são gerentes de avaliação.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
