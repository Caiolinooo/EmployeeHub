/**
 * Componente principal do questionário de avaliação
 * Implementa perguntas 11-15 com validações
 */

'use client';

import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiAlertTriangle, FiUser, FiClock, FiSend } from 'react-icons/fi';
import {
  ESCALA_AVALIACAO,
  QUESTIONARIO_PADRAO,
  VALIDACOES,
  QuestionarioPergunta,
  RespondentType
} from '@/lib/schemas/evaluation-schemas';

interface QuestionarioAvaliacaoProps {
  avaliacaoId: string;
  respondenteTipo: RespondentType;
  isLider?: boolean; // Se true, mostra perguntas de liderança (16-17)
  onSave?: (respostas: any[]) => void;
  onCancel?: () => void;
  existingData?: any[]; // Respostas existentes para edição
}

interface Resposta {
  pergunta_id: number;
  nota: number;
  comentario?: string;
}

export default function QuestionarioAvaliacao({
  avaliacaoId,
  respondenteTipo,
  isLider = false,
  onSave,
  onCancel,
  existingData = []
}: QuestionarioAvaliacaoProps) {

  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Filtrar perguntas por tipo de respondente E liderança
  const perguntasFiltradas = QUESTIONARIO_PADRAO.filter(
    p => p.tipo === respondenteTipo && (!p.apenas_lideres || isLider)
  );

  // Inicializar respostas existentes
  useEffect(() => {
    if (existingData && existingData.length > 0) {
      const mappedRespostas = existingData.map(item => ({
        pergunta_id: item.pergunta_id,
        nota: item.nota,
        comentario: item.comentario
      }));
      setRespostas(mappedRespostas);
    } else {
      // Inicializar com valores vazios
      const initialRespostas = perguntasFiltradas.map(pergunta => ({
        pergunta_id: pergunta.id,
        nota: 0,
        comentario: ''
      }));
      setRespostas(initialRespostas);
    }
  }, [existingData, perguntasFiltradas]);

  // Validar resposta individual
  const validateResposta = (perguntaId: number, resposta: Resposta): string => {
    if (!resposta.nota || resposta.nota < 1 || resposta.nota > 5) {
      return 'Nota deve estar entre 1 e 5';
    }

    if (resposta.comentario && resposta.comentario.length > VALIDACOES.COMENTARIO_MAX_LENGTH) {
      return `Comentário deve ter no máximo ${VALIDACOES.COMENTARIO_MAX_LENGTH} caracteres`;
    }

    // Para comentário do avaliador (pergunta 15), é obrigatório
    if (perguntaId === 15 && respondenteTipo === 'manager' && !resposta.comentario?.trim()) {
      return 'Comentário do avaliador é obrigatório';
    }

    // Para perguntas de liderança (16-17), são obrigatórias quando isLider = true
    if ((perguntaId === 16 || perguntaId === 17) && isLider && respondenteTipo === 'manager') {
      if (!resposta.comentario?.trim()) {
        return 'Comentário é obrigatório para avaliação de liderança';
      }
    }

    return '';
  };

  // Validar todas as respostas
  const validateAll = (): boolean => {
    const newErrors: Record<number, string> = {};
    let isValid = true;

    for (const resposta of respostas) {
      const error = validateResposta(resposta.pergunta_id, resposta);
      if (error) {
        newErrors[resposta.pergunta_id] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // Atualizar resposta
  const handleNotaChange = (perguntaId: number, nota: number) => {
    setRespostas(prev =>
      prev.map(r =>
        r.pergunta_id === perguntaId
          ? { ...r, nota }
          : r
      )
    );

    // Limpar erro ao corrigir
    if (errors[perguntaId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[perguntaId];
        return newErrors;
      });
    }

    setIsDirty(true);
  };

  const handleComentarioChange = (perguntaId: number, comentario: string) => {
    setRespostas(prev =>
      prev.map(r =>
        r.pergunta_id === perguntaId
          ? { ...r, comentario: comentario.slice(0, VALIDACOES.COMENTARIO_MAX_LENGTH) }
          : r
      )
    );

    // Limpar erro ao corrigir
    if (errors[perguntaId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[perguntaId];
        return newErrors;
      });
    }

    setIsDirty(true);
  };

  // Salvar respostas
  const handleSave = async () => {
    if (!validateAll()) {
      return;
    }

    try {
      setSaving(true);

      // Preparar dados para envio
      const data = {
        avaliacao_id: avaliacaoId,
        respostas: respostas,
        respondente_tipo: respondenteTipo
      };

      // Chamar função de salvamento
      if (onSave) {
        await onSave(respostas);
      }

      setIsDirty(false);

    } catch (error) {
      console.error('Erro ao salvar respostas:', error);
      alert('Ocorreu um erro ao salvar. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Calcular progresso
  const progresso = perguntasFiltradas.length > 0
    ? (respostas.filter(r => r.nota > 0).length / perguntasFiltradas.length) * 100
    : 0;

  // Verificar se pode salvar
  const canSave = respostas.every(r => r.nota >= 1 && r.nota <= 5) &&
    (respondenteTipo === 'collaborator' ||
      (respostas.some(r => r.pergunta_id === 15 && r.comentario?.trim()) &&
       (!isLider || (
         respostas.some(r => r.pergunta_id === 16 && r.comentario?.trim()) &&
         respostas.some(r => r.pergunta_id === 17 && r.comentario?.trim())
       ))
      )
    );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {respondenteTipo === 'collaborator' ? 'Autoavaliação' : 'Avaliação de Equipe'}
            </h2>
            <p className="text-gray-600 mt-1">
              {respondenteTipo === 'collaborator'
                ? 'Perguntas 11-14: Autoavaliação do colaborador'
                : isLider
                  ? 'Perguntas 15-17: Feedback do avaliador (incluindo liderança)'
                  : 'Pergunta 15: Feedback do avaliador'
              }
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              Progresso:
            </span>
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {Math.round(progresso)}%
            </span>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="space-y-8">
        {perguntasFiltradas.map((pergunta) => {
          const resposta = respostas.find(r => r.pergunta_id === pergunta.id);
          const temErro = !!errors[pergunta.id];

          return (
            <div key={pergunta.id} className="border-b border-gray-200 pb-6 last:border-b-0">
              {/* Cabeçalho da pergunta */}
              <div className="flex items-start space-x-3 mb-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                  {pergunta.id}
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {pergunta.titulo}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {pergunta.descricao}
                  </p>
                  {pergunta.obrigatoria && (
                    <span className="inline-flex items-center text-xs text-red-600 mt-1">
                      <FiAlertTriangle className="w-3 h-3 mr-1" />
                      Obrigatório
                    </span>
                  )}
                </div>
              </div>

              {/* Escala de avaliação */}
              {(respondenteTipo === 'collaborator' || pergunta.id === 16 || pergunta.id === 17) && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Avaliação (1 a 5)
                  </label>
                  <div className="flex items-center space-x-4">
                    {ESCALA_AVALIACAO.map((escala) => (
                      <button
                        key={escala.valor}
                        type="button"
                        onClick={() => handleNotaChange(pergunta.id, escala.valor)}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                          resposta?.nota === escala.valor
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400 text-gray-700'
                        }`}
                        title={escala.descricao}
                      >
                        <span className="text-lg font-semibold">{escala.valor}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    {resposta?.nota && ESCALA_AVALIACAO.find(e => e.valor === resposta.nota)?.descricao}
                  </div>
                </div>
              )}

              {/* Campo de comentário */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comentário {pergunta.obrigatoria && <span className="text-red-600">*</span>}
                </label>
                <textarea
                  value={resposta?.comentario || ''}
                  onChange={(e) => handleComentarioChange(pergunta.id, e.target.value)}
                  rows={respondenteTipo === 'manager' ? 4 : 3}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    temErro ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={
                    respondenteTipo === 'manager'
                      ? 'Forneça feedback detalhado sobre o desempenho do colaborador...'
                      : 'Adicione detalhes ou exemplos para complementar sua avaliação...'
                  }
                  maxLength={VALIDACOES.COMENTARIO_MAX_LENGTH}
                />
                <div className="mt-1 text-sm text-gray-500">
                  {resposta?.comentario?.length || 0} / {VALIDACOES.COMENTARIO_MAX_LENGTH} caracteres
                </div>
              </div>

              {/* Erro de validação */}
              {temErro && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center">
                    <FiAlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                    <span className="text-sm text-red-700">{errors[pergunta.id]}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botões de ação */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiX className="w-4 h-4 mr-2" />
            Cancelar
          </button>
        )}

        <div className="flex items-center space-x-3">
          {isDirty && (
            <span className="text-sm text-orange-600">
              <FiAlertTriangle className="w-4 h-4 inline mr-1" />
              Você tem alterações não salvas
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${
              canSave
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                <FiSend className="w-4 h-4 mr-2" />
                Enviar Avaliação
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}