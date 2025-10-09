'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiClock, FiUser, FiCheckCircle } from 'react-icons/fi';
import MainLayout from '@/components/Layout/MainLayout';
import FormularioAutoavaliacao from '@/components/avaliacao/FormularioAutoavaliacao';
import { WorkflowAvaliacaoService } from '@/lib/services/workflow-avaliacao';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { PeriodoAvaliacao, Autoavaliacao } from '@/lib/services/workflow-avaliacao';

export default function AutoavaliacaoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [periodoAtivo, setPeriodoAtivo] = useState<PeriodoAvaliacao | null>(null);
  const [avaliacaoAtual, setAvaliacaoAtual] = useState<any>(null);
  const [autoavaliacaoExistente, setAutoavaliacaoExistente] = useState<Autoavaliacao | null>(null);
  const [podeAutoavaliar, setPodeAutoavaliar] = useState(false);

  useEffect(() => {
    if (user) {
      carregarDados();
    }
  }, [user]);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Carregar período ativo
      const periodo = await WorkflowAvaliacaoService.getPeriodoAvaliacaoAtivo();
      setPeriodoAtivo(periodo);

      if (!periodo) {
        return;
      }

      // Verificar se pode autoavaliar
      const pode = await WorkflowAvaliacaoService.podeAutoavaliar(user!.id);
      setPodeAutoavaliar(pode);

      // Buscar avaliação existente para o período atual
      const { data: avaliacaoExistente, error: avaliacaoError } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('funcionario_id', user!.id)
        .eq('periodo_avaliacao_id', periodo.id)
        .single();

      if (avaliacaoError && avaliacaoError.code !== 'PGRST116') {
        console.error('Erro ao buscar avaliação:', avaliacaoError);
        return;
      }

      if (avaliacaoExistente) {
        setAvaliacaoAtual(avaliacaoExistente);

        // Buscar autoavaliação existente
        const { data: autoavaliacao, error: autoavaliacaoError } = await supabase
          .from('autoavaliacoes')
          .select('*')
          .eq('avaliacao_id', avaliacaoExistente.id)
          .single();

        if (autoavaliacaoError && autoavaliacaoError.code !== 'PGRST116') {
          console.error('Erro ao buscar autoavaliação:', autoavaliacaoError);
          return;
        }

        if (autoavaliacao) {
          setAutoavaliacaoExistente(autoavaliacao);
        }
      } else {
        // Criar nova avaliação se não existir
        const avaliacaoId = await WorkflowAvaliacaoService.iniciarAvaliacao(
          user!.id,
          periodo.id
        );

        if (avaliacaoId) {
          setAvaliacaoAtual({ id: avaliacaoId, etapa_atual: 'autoavaliacao' });
        }
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = () => {
    alert('Autoavaliação salva como rascunho!');
    carregarDados(); // Recarregar dados
  };

  const handleEnviar = () => {
    alert('Autoavaliação enviada para aprovação do gerente!');
    router.push('/avaliacao');
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusEtapa = (etapa: string) => {
    switch (etapa) {
      case 'autoavaliacao':
        return { text: 'Aguardando Autoavaliação', color: 'text-yellow-600 bg-yellow-100' };
      case 'aguardando_gerente':
        return { text: 'Enviada para Gerente', color: 'text-blue-600 bg-blue-100' };
      case 'em_aprovacao':
        return { text: 'Em Aprovação', color: 'text-orange-600 bg-orange-100' };
      case 'finalizada':
        return { text: 'Finalizada', color: 'text-green-600 bg-green-100' };
      default:
        return { text: 'Pendente', color: 'text-gray-600 bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!periodoAtivo) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push('/avaliacao')}
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <FiArrowLeft className="mr-2" size={16} />
              Voltar para Avaliações
            </button>
          </div>

          <div className="text-center py-12">
            <FiClock className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Nenhum Período de Avaliação Ativo
            </h2>
            <p className="text-gray-600 mb-6">
              Não há períodos de avaliação ativos no momento. Entre em contato com o administrador.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!podeAutoavaliar) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push('/avaliacao')}
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <FiArrowLeft className="mr-2" size={16} />
              Voltar para Avaliações
            </button>
          </div>

          <div className="text-center py-12">
            <FiClock className="mx-auto h-16 w-16 text-red-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Prazo de Autoavaliação Expirado
            </h2>
            <p className="text-gray-600 mb-6">
              O prazo para autoavaliação do período "{periodoAtivo.nome}" expirou em{' '}
              {formatarData(periodoAtivo.data_limite_autoavaliacao)}.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (avaliacaoAtual?.etapa_atual !== 'autoavaliacao') {
    const status = getStatusEtapa(avaliacaoAtual?.etapa_atual);
    
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push('/avaliacao')}
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <FiArrowLeft className="mr-2" size={16} />
              Voltar para Avaliações
            </button>
          </div>

          <div className="text-center py-12">
            <FiCheckCircle className="mx-auto h-16 w-16 text-green-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Autoavaliação Concluída
            </h2>
            <p className="text-gray-600 mb-4">
              Sua autoavaliação para o período "{periodoAtivo.nome}" foi enviada.
            </p>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium">
              <span className={`px-3 py-1 rounded-full ${status.color}`}>
                Status: {status.text}
              </span>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/avaliacao')}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-4"
          >
            <FiArrowLeft className="mr-2" size={16} />
            Voltar para Avaliações
          </button>

          {/* Informações do Período */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-blue-900 mb-1">
                  {periodoAtivo.nome}
                </h1>
                {periodoAtivo.descricao && (
                  <p className="text-blue-700 mb-2">{periodoAtivo.descricao}</p>
                )}
                <div className="flex items-center space-x-4 text-sm text-blue-600">
                  <span>Período: {formatarData(periodoAtivo.data_inicio)} - {formatarData(periodoAtivo.data_fim)}</span>
                  <span>Prazo para autoavaliação: {formatarData(periodoAtivo.data_limite_autoavaliacao)}</span>
                </div>
              </div>
              <div className="flex items-center text-blue-600">
                <FiUser className="mr-2" size={16} />
                <span className="text-sm font-medium">Autoavaliação</span>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário de Autoavaliação */}
        {avaliacaoAtual && (
          <FormularioAutoavaliacao
            avaliacaoId={avaliacaoAtual.id}
            funcionarioId={user!.id}
            onSalvar={handleSalvar}
            onEnviar={handleEnviar}
            dadosExistentes={autoavaliacaoExistente || undefined}
          />
        )}
      </div>
    </MainLayout>
  );
}
