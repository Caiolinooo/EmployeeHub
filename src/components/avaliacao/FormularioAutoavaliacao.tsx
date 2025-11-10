'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiSave, FiSend, FiUser, FiTarget, FiTrendingUp, FiBookOpen } from 'react-icons/fi';
import { getCriteriosPorTipoUsuario } from '@/data/criterios-avaliacao';
import { isUsuarioLider } from '@/lib/utils/lideranca';
import { WorkflowAvaliacaoService } from '@/lib/services/workflow-avaliacao';
import SeletorEstrelas, { LegendaEscalaAvaliacao } from './SeletorEstrelas';
import type { CriterioAvaliacao } from '@/data/criterios-avaliacao';
import type { Autoavaliacao } from '@/lib/services/workflow-avaliacao';

interface FormularioAutoavaliacaoProps {
  avaliacaoId: string;
  funcionarioId: string;
  onSalvar?: () => void;
  onEnviar?: () => void;
  dadosExistentes?: Partial<Autoavaliacao>;
}

export default function FormularioAutoavaliacao({
  avaliacaoId,
  funcionarioId,
  onSalvar,
  onEnviar,
  dadosExistentes
}: FormularioAutoavaliacaoProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [isLider, setIsLider] = useState(false);
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>([]);
  
  const [formData, setFormData] = useState({
    questao_11_pontos_fortes: dadosExistentes?.questao_11_pontos_fortes || '',
    questao_12_areas_melhoria: dadosExistentes?.questao_12_areas_melhoria || '',
    questao_13_objetivos_alcancados: dadosExistentes?.questao_13_objetivos_alcancados || '',
    questao_14_planos_desenvolvimento: dadosExistentes?.questao_14_planos_desenvolvimento || '',
    autoavaliacao_criterios: dadosExistentes?.autoavaliacao_criterios || {}
  });

  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Verificar se é líder
        const lider = await isUsuarioLider(funcionarioId);
        setIsLider(lider);

        // Carregar critérios baseado no tipo de usuário
        const criteriosDisponiveis = getCriteriosPorTipoUsuario(lider);
        setCriterios(criteriosDisponiveis);

        // Inicializar notas dos critérios se não existirem
        if (!dadosExistentes?.autoavaliacao_criterios) {
          const criteriosIniciais: Record<string, number> = {};
          criteriosDisponiveis.forEach(criterio => {
            criteriosIniciais[criterio.id] = 0;
          });
          setFormData(prev => ({
            ...prev,
            autoavaliacao_criterios: criteriosIniciais
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };

    carregarDados();
  }, [funcionarioId, dadosExistentes]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCriterioChange = (criterioId: string, nota: number) => {
    setFormData(prev => ({
      ...prev,
      autoavaliacao_criterios: {
        ...prev.autoavaliacao_criterios,
        [criterioId]: nota
      }
    }));
  };

  const handleSalvar = async () => {
    setLoading(true);
    try {
      const sucesso = await WorkflowAvaliacaoService.salvarAutoavaliacao(
        avaliacaoId,
        funcionarioId,
        formData
      );

      if (sucesso) {
        onSalvar?.();
      } else {
        alert('Erro ao salvar autoavaliação');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar autoavaliação');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviar = async () => {
    // Validar se todos os campos obrigatórios estão preenchidos
    if (!formData.questao_11_pontos_fortes.trim() ||
        !formData.questao_12_areas_melhoria.trim() ||
        !formData.questao_13_objetivos_alcancados.trim() ||
        !formData.questao_14_planos_desenvolvimento.trim()) {
      alert('Por favor, preencha todas as questões obrigatórias');
      return;
    }

    // Validar se todos os critérios foram avaliados
    const criteriosNaoAvaliados = criterios.filter(criterio => 
      !formData.autoavaliacao_criterios[criterio.id] || 
      formData.autoavaliacao_criterios[criterio.id] === 0
    );

    if (criteriosNaoAvaliados.length > 0) {
      alert('Por favor, avalie todos os critérios antes de enviar');
      return;
    }

    setLoading(true);
    try {
      const sucesso = await WorkflowAvaliacaoService.salvarAutoavaliacao(
        avaliacaoId,
        funcionarioId,
        formData
      );

      if (sucesso) {
        onEnviar?.();
      } else {
        alert('Erro ao enviar autoavaliação');
      }
    } catch (error) {
      console.error('Erro ao enviar:', error);
      alert('Erro ao enviar autoavaliação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Autoavaliação de Desempenho
        </h2>
        <p className="text-gray-600">
          Complete sua autoavaliação respondendo às questões abaixo e avaliando seu desempenho nos critérios estabelecidos.
        </p>
      </div>

      {/* Questões de Autoavaliação - Conforme AN-TED-002-R0 */}
      <div className="space-y-8">
        {/* Questão 11 - Principais resultados obtidos e metas atingidas */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <FiTarget className="text-blue-600 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">
              Questão 11: Principais resultados obtidos e metas atingidas
            </h3>
          </div>
          <p className="text-gray-700 mb-4">
            Principais resultados obtidos e metas atingidas durante o ano. Dê evidências:
          </p>
          <textarea
            value={formData.questao_11_pontos_fortes}
            onChange={(e) => handleInputChange('questao_11_pontos_fortes', e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Descreva os principais resultados obtidos e metas atingidas, com evidências..."
            required
          />
        </div>

        {/* Questão 12 - Melhorias obtidas desde a última avaliação */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <FiTrendingUp className="text-yellow-600 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">
              Questão 12: Melhorias obtidas desde a última avaliação
            </h3>
          </div>
          <p className="text-gray-700 mb-4">
            Melhorias obtidas desde a última avaliação. Dê evidências:
          </p>
          <textarea
            value={formData.questao_12_areas_melhoria}
            onChange={(e) => handleInputChange('questao_12_areas_melhoria', e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            placeholder="Descreva as melhorias obtidas desde a última avaliação, com evidências..."
            required
          />
        </div>

        {/* Questão 13 - Aspectos que precisam de desenvolvimento e LNT */}
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <FiBookOpen className="text-purple-600 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">
              Questão 13: Aspectos que precisam de desenvolvimento e LNT
            </h3>
          </div>
          <p className="text-gray-700 mb-4">
            Aspectos que precisam de desenvolvimento e LNT (Levantamento de Necessidades de Treinamento):
          </p>
          <textarea
            value={formData.questao_13_objetivos_alcancados}
            onChange={(e) => handleInputChange('questao_13_objetivos_alcancados', e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Liste os aspectos que precisam de desenvolvimento e necessidades de treinamento..."
            required
          />
        </div>

        {/* Questão 14 - Objetivos para o próximo ano */}
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <FiUser className="text-green-600 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">
              Questão 14: Objetivos para o próximo ano
            </h3>
          </div>
          <p className="text-gray-700 mb-4">
            Objetivos para o próximo ano:
          </p>
          <textarea
            value={formData.questao_14_planos_desenvolvimento}
            onChange={(e) => handleInputChange('questao_14_planos_desenvolvimento', e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Descreva seus objetivos para o próximo ano..."
            required
          />
        </div>
      </div>

      {/* Legenda da Escala de Avaliação */}
      <div className="mt-12">
        <LegendaEscalaAvaliacao />
      </div>

      {/* Avaliação por Critérios */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Autoavaliação por Critérios
        </h3>
        <div className="grid gap-6">
          {criterios.map((criterio) => (
            <div key={criterio.id} className="bg-white p-6 rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-colors">
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-lg">{criterio.nome}</h4>
                    <p className="text-sm text-gray-600 mt-1">{criterio.descricao}</p>
                  </div>
                  {criterio.apenas_lideres && (
                    <span className="ml-3 px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
                      Liderança
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <SeletorEstrelas
                  valor={formData.autoavaliacao_criterios[criterio.id] || 0}
                  onChange={(nota) => handleCriterioChange(criterio.id, nota)}
                  tamanho="md"
                  mostrarLegenda={true}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
        <button
          onClick={handleSalvar}
          disabled={loading}
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <FiSave className="mr-2" size={16} />
          Salvar Rascunho
        </button>
        <button
          onClick={handleEnviar}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <FiSend className="mr-2" size={16} />
          Enviar para Aprovação
        </button>
      </div>
    </div>
  );
}
