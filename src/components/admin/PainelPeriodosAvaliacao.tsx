'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCalendar, FiClock, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

interface PeriodoAvaliacao {
  id: string;
  nome: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  data_limite_autoavaliacao: string;
  data_limite_aprovacao: string;
  status: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export default function PainelPeriodosAvaliacao() {
  const [periodos, setPeriodos] = useState<PeriodoAvaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationError, setMigrationError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPeriodo, setEditingPeriodo] = useState<PeriodoAvaliacao | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    data_limite_autoavaliacao: '',
    data_limite_aprovacao: '',
    ativo: true
  });

  useEffect(() => {
    carregarPeriodos();
  }, []);

  const carregarPeriodos = async () => {
    try {
      const { data, error } = await supabase
        .from('periodos_avaliacao')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar períodos:', error);
        // Verificar se é um erro de tabela não encontrada (migration não executada)
        if (error.message && (error.message.includes('relation') || error.message.includes('does not exist') || error.code === 'PGRST204' || error.code === '42P01')) {
          setMigrationError(true);
        }
        return;
      }

      setPeriodos(data || []);
      setMigrationError(false);
    } catch (error) {
      console.error('Erro ao carregar períodos:', error);
      setMigrationError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Preparar dados para inserção/atualização
      const periodoData = {
        nome: formData.nome,
        descricao: formData.descricao,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        data_limite_autoavaliacao: formData.data_limite_autoavaliacao,
        data_limite_aprovacao: formData.data_limite_aprovacao,
        ativo: formData.ativo
      };

      if (editingPeriodo) {
        // Atualizar período existente
        const { error } = await supabase
          .from('periodos_avaliacao')
          .update({
            ...periodoData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPeriodo.id);

        if (error) {
          console.error('Erro ao atualizar período:', error);
          alert(`Erro ao atualizar período: ${error.message}`);
          return;
        }
      } else {
        // Criar novo período
        const { data, error } = await supabase
          .from('periodos_avaliacao')
          .insert(periodoData)
          .select()
          .single();

        if (error) {
          console.error('Erro ao criar período:', error);
          alert(`Erro ao criar período: ${error.message}`);
          return;
        }

        console.log('Período criado com sucesso:', data);

        // Se o período está ativo, notificar funcionários (simplificado para evitar erros)
        try {
          if (formData.ativo && data) {
            console.log('Período ativo criado, notificação pode ser implementada posteriormente');
          }
        } catch (notifError) {
          console.warn('Aviso: Falha na notificação, mas período foi criado:', notifError);
        }
      }

      await carregarPeriodos();
      fecharModal();
      alert(editingPeriodo ? 'Período atualizado com sucesso!' : 'Período criado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar período:', error);
      alert(`Erro ao salvar período: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (periodo: PeriodoAvaliacao) => {
    setEditingPeriodo(periodo);
    setFormData({
      nome: periodo.nome,
      descricao: periodo.descricao || '',
      data_inicio: periodo.data_inicio.split('T')[0], // Converter para formato YYYY-MM-DD
      data_fim: periodo.data_fim.split('T')[0], // Converter para formato YYYY-MM-DD
      data_limite_autoavaliacao: periodo.data_limite_autoavaliacao ? periodo.data_limite_autoavaliacao.split('T')[0] : '',
      data_limite_aprovacao: periodo.data_limite_aprovacao ? periodo.data_limite_aprovacao.split('T')[0] : '',
      ativo: periodo.ativo
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este período? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('periodos_avaliacao')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir período:', error);
        alert('Erro ao excluir período');
        return;
      }

      await carregarPeriodos();
    } catch (error) {
      console.error('Erro ao excluir período:', error);
      alert('Erro ao excluir período');
    }
  };

  const toggleAtivo = async (periodo: PeriodoAvaliacao) => {
    try {
      const novoStatus = !periodo.ativo;
      
      const { error } = await supabase
        .from('periodos_avaliacao')
        .update({ ativo: novoStatus })
        .eq('id', periodo.id);

      if (error) {
        console.error('Erro ao alterar status:', error);
        alert('Erro ao alterar status');
        return;
      }

      // Se ativou o período, notificar funcionários
      if (novoStatus) {
        await NotificacoesAvaliacaoService.notificarInicioPeriodo(
          periodo.id,
          periodo.nome,
          periodo.data_limite_autoavaliacao
        );
      }

      await carregarPeriodos();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status');
    }
  };

  const fecharModal = () => {
    setShowModal(false);
    setEditingPeriodo(null);
    setFormData({
      nome: '',
      descricao: '',
      data_inicio: '',
      data_fim: '',
      data_limite_autoavaliacao: '',
      data_limite_aprovacao: '',
      ativo: true
    });
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (periodo: PeriodoAvaliacao) => {
    if (!periodo.ativo) return 'bg-gray-100 text-gray-600';
    
    const hoje = new Date();
    const inicio = new Date(periodo.data_inicio);
    const fim = new Date(periodo.data_fim);
    
    if (hoje < inicio) return 'bg-blue-100 text-blue-600';
    if (hoje > fim) return 'bg-red-100 text-red-600';
    return 'bg-green-100 text-green-600';
  };

  const getStatusText = (periodo: PeriodoAvaliacao) => {
    if (!periodo.ativo) return 'Inativo';
    
    const hoje = new Date();
    const inicio = new Date(periodo.data_inicio);
    const fim = new Date(periodo.data_fim);
    
    if (hoje < inicio) return 'Agendado';
    if (hoje > fim) return 'Finalizado';
    return 'Ativo';
  };

  if (loading && periodos.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (migrationError) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <FiX className="text-red-600 mt-0.5 mr-3 flex-shrink-0" size={32} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Migration Não Executada
            </h3>
            <p className="text-sm text-red-700 mb-4">
              A tabela <code className="bg-red-100 px-2 py-1 rounded">periodos_avaliacao</code> não existe no banco de dados.
            </p>
            <p className="text-sm text-red-700 mb-4">
              Você precisa executar a migration do banco de dados antes de usar esta funcionalidade.
              Vá para a aba <strong>"Banco de Dados"</strong> e clique em <strong>"Executar Migration"</strong>.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Períodos de Avaliação</h2>
          <p className="text-gray-600">Configure os períodos anuais de avaliação de desempenho</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="mr-2" size={16} />
          Novo Período
        </button>
      </div>

      {/* Lista de Períodos */}
      <div className="grid gap-4">
        {periodos.map((periodo) => (
          <div key={periodo.id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{periodo.nome}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(periodo)}`}>
                    {getStatusText(periodo)}
                  </span>
                </div>
                
                {periodo.descricao && (
                  <p className="text-gray-600 mb-4">{periodo.descricao}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    <FiCalendar className="mr-2" size={14} />
                    <span>Início: {formatarData(periodo.data_inicio)}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <FiCalendar className="mr-2" size={14} />
                    <span>Fim: {formatarData(periodo.data_fim)}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <FiClock className="mr-2" size={14} />
                    <span>Autoavaliação: {formatarData(periodo.data_limite_autoavaliacao)}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <FiUsers className="mr-2" size={14} />
                    <span>Aprovação: {formatarData(periodo.data_limite_aprovacao)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => toggleAtivo(periodo)}
                  className={`p-2 rounded-lg transition-colors ${
                    periodo.ativo 
                      ? 'text-green-600 hover:bg-green-50' 
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                  title={periodo.ativo ? 'Desativar período' : 'Ativar período'}
                >
                  {periodo.ativo ? <FiCheck size={16} /> : <FiX size={16} />}
                </button>
                <button
                  onClick={() => handleEdit(periodo)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar período"
                >
                  <FiEdit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(periodo.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Excluir período"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {periodos.length === 0 && (
          <div className="text-center py-12">
            <FiCalendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum período configurado</h3>
            <p className="text-gray-600 mb-4">Crie o primeiro período de avaliação para começar.</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus className="mr-2" size={16} />
              Criar Período
            </button>
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPeriodo ? 'Editar Período' : 'Novo Período'}
              </h3>
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
                  Nome do Período *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Avaliação Anual 2024"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Descrição opcional do período"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_inicio: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Fim *
                  </label>
                  <input
                    type="date"
                    value={formData.data_fim}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_fim: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo para Autoavaliação *
                  </label>
                  <input
                    type="date"
                    value={formData.data_limite_autoavaliacao}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_limite_autoavaliacao: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo para Aprovação *
                  </label>
                  <input
                    type="date"
                    value={formData.data_limite_aprovacao}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_limite_aprovacao: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="ativo" className="text-sm text-gray-700">
                  Período ativo (notificar funcionários)
                </label>
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
                  {loading ? 'Salvando...' : (editingPeriodo ? 'Atualizar' : 'Criar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
