'use client';

import React, { useState, useEffect } from 'react';
import { FiCheck, FiEdit2, FiMessageSquare, FiUser, FiCalendar, FiStar, FiEye } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import { WorkflowAvaliacaoService } from '@/lib/services/workflow-avaliacao';
import { getCriteriosPorTipoUsuario } from '@/data/criterios-avaliacao';
import { isUsuarioLider } from '@/lib/utils/lideranca';
import SeletorEstrelas, { ExibicaoEstrelas } from './SeletorEstrelas';
import type { CriterioAvaliacao } from '@/data/criterios-avaliacao';

interface AvaliacaoParaAprovacao {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_email: string;
  etapa_atual: string;
  data_autoavaliacao: string;
  periodo_nome: string;
  autoavaliacao: {
    questao_11_pontos_fortes: string;
    questao_12_areas_melhoria: string;
    questao_13_objetivos_alcancados: string;
    questao_14_planos_desenvolvimento: string;
    autoavaliacao_criterios: Record<string, number>;
  };
}

interface InterfaceAprovacaoGerenteProps {
  gerenteId: string;
}

export default function InterfaceAprovacaoGerente({ gerenteId }: InterfaceAprovacaoGerenteProps) {
  const [avaliacoesPendentes, setAvaliacoesPendentes] = useState<AvaliacaoParaAprovacao[]>([]);
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState<AvaliacaoParaAprovacao | null>(null);
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [comentarios, setComentarios] = useState('');
  const [notasGerente, setNotasGerente] = useState<Record<string, number>>({});
  const [modoEdicao, setModoEdicao] = useState(false);

  useEffect(() => {
    carregarAvaliacoesPendentes();
  }, [gerenteId]);

  const carregarAvaliacoesPendentes = async () => {
    try {
      setLoading(true);

      // Buscar avaliações aguardando aprovação do gerente
      const { data: avaliacoes, error } = await supabase
        .from('avaliacoes')
        .select(`
          id,
          funcionario_id,
          etapa_atual,
          data_autoavaliacao,
          users_unified!funcionario_id(name, email),
          periodos_avaliacao(nome),
          autoavaliacoes(
            questao_11_pontos_fortes,
            questao_12_areas_melhoria,
            questao_13_objetivos_alcancados,
            questao_14_planos_desenvolvimento,
            autoavaliacao_criterios
          )
        `)
        .eq('etapa_atual', 'aguardando_gerente')
        .order('data_autoavaliacao', { ascending: true });

      if (error) {
        console.error('Erro ao carregar avaliações:', error);
        return;
      }

      const avaliacoesFormatadas = avaliacoes?.map(avaliacao => ({
        id: avaliacao.id,
        funcionario_id: avaliacao.funcionario_id,
        funcionario_nome: (avaliacao.users_unified as any)?.name || 'Nome não encontrado',
        funcionario_email: (avaliacao.users_unified as any)?.email || 'Email não encontrado',
        etapa_atual: avaliacao.etapa_atual,
        data_autoavaliacao: avaliacao.data_autoavaliacao,
        periodo_nome: (avaliacao.periodos_avaliacao as any)?.nome || 'Período não encontrado',
        autoavaliacao: avaliacao.autoavaliacoes?.[0] || {
          questao_11_pontos_fortes: '',
          questao_12_areas_melhoria: '',
          questao_13_objetivos_alcancados: '',
          questao_14_planos_desenvolvimento: '',
          autoavaliacao_criterios: {}
        }
      })) || [];

      setAvaliacoesPendentes(avaliacoesFormatadas);
    } catch (error) {
      console.error('Erro ao carregar avaliações pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalAprovacao = async (avaliacao: AvaliacaoParaAprovacao) => {
    setAvaliacaoSelecionada(avaliacao);
    setComentarios('');
    setModoEdicao(false);

    // Verificar se o funcionário é líder para carregar critérios corretos
    const funcionarioEhLider = await isUsuarioLider(avaliacao.funcionario_id);
    const criteriosDisponiveis = getCriteriosPorTipoUsuario(funcionarioEhLider);
    setCriterios(criteriosDisponiveis);

    // Inicializar notas do gerente com as notas da autoavaliação
    const notasIniciais: Record<string, number> = {};
    criteriosDisponiveis.forEach(criterio => {
      notasIniciais[criterio.id] = avaliacao.autoavaliacao.autoavaliacao_criterios[criterio.id] || 0;
    });
    setNotasGerente(notasIniciais);

    setShowModal(true);
  };

  const handleAprovacao = async (aprovada: boolean) => {
    if (!avaliacaoSelecionada) return;

    try {
      setLoading(true);

      const edicoes = modoEdicao ? { 
        pontuacao_total: calcularPontuacaoTotal(),
        notas_gerente: notasGerente 
      } : undefined;

      const sucesso = await WorkflowAvaliacaoService.aprovarAvaliacao(
        avaliacaoSelecionada.id,
        gerenteId,
        aprovada,
        comentarios,
        edicoes
      );

      if (sucesso) {
        await carregarAvaliacoesPendentes();
        setShowModal(false);
        alert(aprovada ? 'Avaliação aprovada com sucesso!' : 'Avaliação editada com sucesso!');
      } else {
        alert('Erro ao processar avaliação');
      }
    } catch (error) {
      console.error('Erro ao processar avaliação:', error);
      alert('Erro ao processar avaliação');
    } finally {
      setLoading(false);
    }
  };

  const calcularPontuacaoTotal = () => {
    const notas = Object.values(notasGerente);
    const soma = notas.reduce((acc, nota) => acc + nota, 0);
    return notas.length > 0 ? (soma / notas.length) : 0;
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && avaliacoesPendentes.length === 0) {
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
        <h2 className="text-2xl font-bold text-gray-900">Avaliações Pendentes de Aprovação</h2>
        <p className="text-gray-600">
          Revise e aprove as autoavaliações enviadas pelos funcionários
        </p>
      </div>

      {/* Lista de Avaliações Pendentes */}
      {avaliacoesPendentes.length === 0 ? (
        <div className="text-center py-12">
          <FiCheck className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhuma avaliação pendente
          </h3>
          <p className="text-gray-600">
            Todas as avaliações foram processadas ou não há autoavaliações enviadas.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {avaliacoesPendentes.map((avaliacao) => (
            <div key={avaliacao.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <FiUser className="text-blue-600" size={20} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {avaliacao.funcionario_nome}
                      </h3>
                      <p className="text-sm text-gray-600">{avaliacao.funcionario_email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <FiCalendar className="mr-2" size={14} />
                      <span>Período: {avaliacao.periodo_nome}</span>
                    </div>
                    <div className="flex items-center">
                      <FiCalendar className="mr-2" size={14} />
                      <span>Enviada em: {formatarData(avaliacao.data_autoavaliacao)}</span>
                    </div>
                  </div>

                  {/* Preview das respostas */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Principais Pontos Fortes:</h4>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {avaliacao.autoavaliacao.questao_11_pontos_fortes || 'Não informado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => abrirModalAprovacao(avaliacao)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FiEye className="mr-2" size={16} />
                    Revisar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Aprovação */}
      {showModal && avaliacaoSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Avaliação de {avaliacaoSelecionada.funcionario_nome}
                  </h3>
                  <p className="text-sm text-gray-600">{avaliacaoSelecionada.periodo_nome}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Respostas da Autoavaliação */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900">Respostas da Autoavaliação</h4>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Principais Pontos Fortes:</h5>
                  <p className="text-gray-700">{avaliacaoSelecionada.autoavaliacao.questao_11_pontos_fortes}</p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Áreas para Melhoria:</h5>
                  <p className="text-gray-700">{avaliacaoSelecionada.autoavaliacao.questao_12_areas_melhoria}</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Objetivos Alcançados:</h5>
                  <p className="text-gray-700">{avaliacaoSelecionada.autoavaliacao.questao_13_objetivos_alcancados}</p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Planos de Desenvolvimento:</h5>
                  <p className="text-gray-700">{avaliacaoSelecionada.autoavaliacao.questao_14_planos_desenvolvimento}</p>
                </div>
              </div>

              {/* Avaliação por Critérios */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">Avaliação por Critérios</h4>
                  <button
                    onClick={() => setModoEdicao(!modoEdicao)}
                    className={`flex items-center px-3 py-1 rounded-lg text-sm transition-colors ${
                      modoEdicao 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <FiEdit2 className="mr-1" size={14} />
                    {modoEdicao ? 'Modo Edição Ativo' : 'Editar Notas'}
                  </button>
                </div>

                <div className="grid gap-4">
                  {criterios.map((criterio) => (
                    <div key={criterio.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="mb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900">{criterio.nome}</h5>
                            <p className="text-sm text-gray-600 mt-1">{criterio.descricao}</p>
                            {criterio.apenas_lideres && (
                              <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                Critério de Liderança
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Autoavaliação do Colaborador */}
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-xs font-medium text-blue-900 mb-2">Autoavaliação do Colaborador:</p>
                          <ExibicaoEstrelas
                            valor={avaliacaoSelecionada.autoavaliacao.autoavaliacao_criterios[criterio.id] || 0}
                            tamanho="sm"
                            mostrarValor={true}
                            mostrarLabel={true}
                          />
                        </div>

                        {/* Avaliação do Gerente (modo edição) */}
                        {modoEdicao && (
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-xs font-medium text-green-900 mb-2">Sua Avaliação (Gerente):</p>
                            <SeletorEstrelas
                              valor={notasGerente[criterio.id] || 0}
                              onChange={(nota) => setNotasGerente(prev => ({
                                ...prev,
                                [criterio.id]: nota
                              }))}
                              tamanho="sm"
                              mostrarLegenda={false}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {modoEdicao && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Pontuação Total:</strong> {calcularPontuacaoTotal().toFixed(2)} / 5.00
                    </p>
                  </div>
                )}
              </div>

              {/* Comentários do Gerente - Questão 15 */}
              <div className="bg-orange-50 p-6 rounded-lg border-2 border-orange-200">
                <div className="flex items-center mb-3">
                  <FiMessageSquare className="text-orange-600 mr-2" size={20} />
                  <div>
                    <label className="block text-base font-semibold text-gray-900">
                      Questão 15: Comentários do Avaliador
                    </label>
                    <p className="text-sm text-gray-600">
                      Adicione seus comentários e observações finais sobre a avaliação
                    </p>
                  </div>
                </div>
                <textarea
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  className="w-full h-32 border border-orange-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Descreva suas observações sobre o desempenho do colaborador, feedback geral, pontos de destaque, áreas que necessitam atenção especial, etc..."
                />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                {modoEdicao && (
                  <button
                    onClick={() => handleAprovacao(false)}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                  >
                    <FiEdit2 className="mr-2" size={16} />
                    Salvar Edições
                  </button>
                )}
                <button
                  onClick={() => handleAprovacao(true)}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <FiCheck className="mr-2" size={16} />
                  Aprovar Avaliação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
