'use client';

import React, { useState, useEffect } from 'react';
import {
  FiCalendar,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiClock,
  FiUsers,
} from 'react-icons/fi';
import MainLayout from '@/components/Layout/MainLayout';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface Periodo {
  id: string;
  nome: string;
  descricao: string;
  ano: number;
  data_inicio: string;
  data_fim: string;
  data_limite_autoavaliacao: string;
  data_limite_aprovacao: string;
  status: string;
  ativo: boolean;
  criacao_automatica_executada: boolean;
  data_criacao_automatica: string | null;
  total_avaliacoes_criadas: number;
  created_at: string;
  updated_at: string;
}

export default function PeriodosAvaliacaoPage() {
  const { user, isAdmin } = useSupabaseAuth();
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPeriodo, setEditingPeriodo] = useState<Periodo | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    ano: new Date().getFullYear(),
    data_inicio: '',
    data_fim: '',
    data_limite_autoavaliacao: '',
    data_limite_aprovacao: '',
    status: 'planejado',
    ativo: true,
  });

  useEffect(() => {
    if (user && isAdmin) {
      carregarPeriodos();
    }
  }, [user, isAdmin]);

  const carregarPeriodos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch('/api/avaliacao/periodos', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setPeriodos(data.periodos || []);
      }
    } catch (error) {
      console.error('Erro ao carregar períodos:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setEditingPeriodo(null);
    setFormData({
      nome: '',
      descricao: '',
      ano: new Date().getFullYear(),
      data_inicio: '',
      data_fim: '',
      data_limite_autoavaliacao: '',
      data_limite_aprovacao: '',
      status: 'planejado',
      ativo: true,
    });
    setShowModal(true);
  };

  const abrirModalEditar = (periodo: Periodo) => {
    setEditingPeriodo(periodo);
    setFormData({
      nome: periodo.nome,
      descricao: periodo.descricao || '',
      ano: periodo.ano,
      data_inicio: periodo.data_inicio?.split('T')[0] || '',
      data_fim: periodo.data_fim?.split('T')[0] || '',
      data_limite_autoavaliacao: periodo.data_limite_autoavaliacao?.split('T')[0] || '',
      data_limite_aprovacao: periodo.data_limite_aprovacao?.split('T')[0] || '',
      status: periodo.status || 'planejado',
      ativo: periodo.ativo,
    });
    setShowModal(true);
  };

  const salvarPeriodo = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const url = editingPeriodo
        ? `/api/avaliacao/periodos/${editingPeriodo.id}`
        : '/api/avaliacao/periodos';

      const method = editingPeriodo ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert(editingPeriodo ? 'Período atualizado com sucesso!' : 'Período criado com sucesso!');
        setShowModal(false);
        carregarPeriodos();
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao salvar período:', error);
      alert('Erro ao salvar período');
    }
  };

  const deletarPeriodo = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este período?')) return;

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/avaliacao/periodos/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        alert('Período excluído com sucesso!');
        carregarPeriodos();
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao deletar período:', error);
      alert('Erro ao deletar período');
    }
  };

  const calcularDataInicio = (dataFim: string) => {
    if (!dataFim) return '';
    const fim = new Date(dataFim);
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - 14); // 2 semanas antes
    return inicio.toISOString().split('T')[0];
  };

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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Períodos de Avaliação
            </h1>
            <p className="text-gray-600">
              Gerencie os períodos de avaliação de desempenho
            </p>
          </div>
          <button
            onClick={abrirModalNovo}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiPlus className="mr-2" />
            Novo Período
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <FiAlertCircle className="text-blue-600 mt-0.5 mr-3" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Como funciona:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>As avaliações são criadas automaticamente <strong>2 semanas antes</strong> da data fim do período</li>
                <li>Colaboradores recebem notificação para preencher a autoavaliação</li>
                <li>Após o preenchimento, o gerente é notificado para avaliar</li>
                <li>O período é marcado como executado após a criação das avaliações</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Lista de Períodos */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando períodos...</p>
          </div>
        ) : periodos.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FiCalendar className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Nenhum período cadastrado
            </h3>
            <p className="text-gray-600 mb-4">
              Comece criando o primeiro período de avaliação
            </p>
            <button
              onClick={abrirModalNovo}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiPlus className="mr-2" />
              Criar Período
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {periodos.map((periodo) => (
              <div
                key={periodo.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {periodo.nome}
                      </h3>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          periodo.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {periodo.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      {periodo.criacao_automatica_executada && (
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Executado
                        </span>
                      )}
                    </div>
                    {periodo.descricao && (
                      <p className="text-gray-600 text-sm mb-3">{periodo.descricao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => abrirModalEditar(periodo)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Editar"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button
                      onClick={() => deletarPeriodo(periodo.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Excluir"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start space-x-3">
                    <FiCalendar className="text-gray-400 mt-1" size={18} />
                    <div>
                      <p className="text-xs text-gray-500">Período</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(periodo.data_inicio).toLocaleDateString('pt-BR')} -{' '}
                        {new Date(periodo.data_fim).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <FiClock className="text-gray-400 mt-1" size={18} />
                    <div>
                      <p className="text-xs text-gray-500">Autoavaliação até</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(periodo.data_limite_autoavaliacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <FiUsers className="text-gray-400 mt-1" size={18} />
                    <div>
                      <p className="text-xs text-gray-500">Avaliações Criadas</p>
                      <p className="text-sm font-medium text-gray-900">
                        {periodo.total_avaliacoes_criadas || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {periodo.criacao_automatica_executada && periodo.data_criacao_automatica && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-800">
                      <FiCheck className="inline mr-1" />
                      Avaliações criadas automaticamente em{' '}
                      {new Date(periodo.data_criacao_automatica).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingPeriodo ? 'Editar Período' : 'Novo Período'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX size={24} />
                  </button>
                </div>

                <form onSubmit={salvarPeriodo} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Período *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Avaliação Anual 2024"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrição
                    </label>
                    <textarea
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Descrição opcional do período"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ano *
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.ano}
                        onChange={(e) => setFormData({ ...formData, ano: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="planejado">Planejado</option>
                        <option value="em_andamento">Em Andamento</option>
                        <option value="concluido">Concluído</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 mb-3">
                      <FiAlertCircle className="inline mr-1" />
                      <strong>Importante:</strong> As avaliações serão criadas automaticamente 2 semanas antes da data fim.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-1">
                          Data Fim *
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.data_fim}
                          onChange={(e) => {
                            const dataFim = e.target.value;
                            const dataInicio = calcularDataInicio(dataFim);
                            setFormData({
                              ...formData,
                              data_fim: dataFim,
                              data_inicio: dataInicio,
                            });
                          }}
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-900 mb-1">
                          Data Criação (auto)
                        </label>
                        <input
                          type="date"
                          value={formData.data_inicio}
                          readOnly
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-blue-100 text-blue-900"
                          title="Calculado automaticamente: 2 semanas antes da data fim"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Limite Autoavaliação *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.data_limite_autoavaliacao}
                        onChange={(e) =>
                          setFormData({ ...formData, data_limite_autoavaliacao: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Limite Aprovação *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.data_limite_aprovacao}
                        onChange={(e) =>
                          setFormData({ ...formData, data_limite_aprovacao: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="ativo"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label htmlFor="ativo" className="ml-2 text-sm text-gray-700">
                      Período ativo
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {editingPeriodo ? 'Atualizar' : 'Criar'} Período
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
