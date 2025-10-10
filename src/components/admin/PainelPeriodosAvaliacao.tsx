'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCalendar, FiClock, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import { NotificacoesAvaliacaoService } from '@/lib/services/notificacoes-avaliacao';
import type { PeriodoAvaliacao } from '@/lib/services/workflow-avaliacao';
import { useI18n } from '@/contexts/I18nContext';

export default function PainelPeriodosAvaliacao() {
  const { t } = useI18n();

  const [periodos, setPeriodos] = useState<PeriodoAvaliacao[]>([]);
  const [loading, setLoading] = useState(true);
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
        .order('data_inicio', { ascending: false });

      if (error) {
        console.error({t('components.erroAoCarregarPeriodos')}, error);
        return;
      }

      setPeriodos(data || []);
    } catch (error) {
      console.error({t('components.erroAoCarregarPeriodos')}, error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingPeriodo) {
        // Atualizar período existente
        const { error } = await supabase
          .from('periodos_avaliacao')
          .update(formData)
          .eq('id', editingPeriodo.id);

        if (error) {
          console.error({t('components.erroAoAtualizarPeriodo')}, error);
          alert('Erro ao atualizar período');
          return;
        }
      } else {
        // Criar novo período
        const { data, error } = await supabase
          .from('periodos_avaliacao')
          .insert(formData)
          .select()
          .single();

        if (error) {
          console.error({t('components.erroAoCriarPeriodo')}, error);
          alert('Erro ao criar período');
          return;
        }

        // Se o período está ativo, notificar funcionários
        if (formData.ativo) {
          await NotificacoesAvaliacaoService.notificarInicioPeriodo(
            data.id,
            formData.nome,
            formData.data_limite_autoavaliacao
          );
        }
      }

      await carregarPeriodos();
      fecharModal();
    } catch (error) {
      console.error({t('components.erroAoSalvarPeriodo')}, error);
      alert('Erro ao salvar período');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (periodo: PeriodoAvaliacao) => {
    setEditingPeriodo(periodo);
    setFormData({
      nome: periodo.nome,
      descricao: periodo.descricao || '',
      data_inicio: periodo.data_inicio,
      data_fim: periodo.data_fim,
      data_limite_autoavaliacao: periodo.data_limite_autoavaliacao,
      data_limite_aprovacao: periodo.data_limite_aprovacao,
      ativo: periodo.ativo
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm({t('components.temCertezaQueDesejaExcluirEstePeriodoEstaAcaoNaoPo')})) {
      return;
    }

    try {
      const { error } = await supabase
        .from('periodos_avaliacao')
        .delete()
        .eq('id', id);

      if (error) {
        console.error({t('components.erroAoExcluirPeriodo')}, error);
        alert('Erro ao excluir período');
        return;
      }

      await carregarPeriodos();
    } catch (error) {
      console.error({t('components.erroAoExcluirPeriodo')}, error);
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
                  title={periodo.ativo ? {t('components.desativarPeriodo')} : {t('components.ativarPeriodo')}}
                >
                  {periodo.ativo ? <FiCheck size={16} /> : <FiX size={16} />}
                </button>
                <button
                  onClick={() => handleEdit(periodo)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title={t('components.editarPeriodo')}
                >
                  <FiEdit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(periodo.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title={t('components.excluirPeriodo')}
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
                {editingPeriodo ? {t('components.editarPeriodo')} : {t('components.novoPeriodo')}}
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
                  placeholder={t('components.exAvaliacaoAnual2024')}
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
                  placeholder={t('components.descricaoOpcionalDoPeriodo')}
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
