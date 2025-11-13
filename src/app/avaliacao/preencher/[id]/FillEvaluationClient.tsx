'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiSave, FiSend, FiArrowLeft } from 'react-icons/fi';
import QuestionarioAvaliacaoCardBased from '@/components/avaliacao/QuestionarioAvaliacaoCardBased';
import { Evaluation } from '@/types';
import { QUESTIONARIO_PADRAO } from '@/lib/schemas/evaluation-schemas';

interface FillEvaluationClientProps {
  evaluation: Evaluation;
  isManager: boolean;
  userId: string;
}

export default function FillEvaluationClient({
  evaluation,
  isManager,
  userId
}: FillEvaluationClientProps) {
  const router = useRouter();
  const [respostas, setRespostas] = useState<Record<string, any>>(
    evaluation.respostas || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChange = (questionId: string, value: any) => {
    setRespostas(prev => ({
      ...prev,
      [questionId]: value
    }));
    setError(null);
  };

  const validateRespostas = (): boolean => {
    const questionsToValidate = isManager
      ? QUESTIONARIO_PADRAO.filter(q => ['Q15', 'Q16', 'Q17'].includes(q.id))
      : QUESTIONARIO_PADRAO.filter(q => ['Q11', 'Q12', 'Q13', 'Q14'].includes(q.id));

    for (const question of questionsToValidate) {
      if (question.obrigatoria) {
        const resposta = respostas[question.id];
        if (!resposta || !resposta.nota || resposta.nota === 0) {
          setError(`Por favor, responda a questão ${question.id.replace('Q', '')}: ${question.pergunta}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/avaliacao/${evaluation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          respostas,
          status: evaluation.status // Mantém o status atual
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao salvar rascunho');
      }

      setSuccessMessage('Rascunho salvo com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar rascunho');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateRespostas()) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Primeiro salvar as respostas
      const saveResponse = await fetch(`/api/avaliacao/${evaluation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          respostas,
          status: evaluation.status
        }),
      });

      if (!saveResponse.ok) {
        const data = await saveResponse.json();
        throw new Error(data.error || 'Erro ao salvar avaliação');
      }

      // Depois submeter para revisão (colaborador) ou aprovar (gerente)
      const token = document.cookie.split('; ').find(row => row.startsWith('abzToken='))?.split('=')[1];
      
      if (isManager) {
        // Gerente aprova a avaliação
        const approveResponse = await fetch(`/api/avaliacao-desempenho/avaliacoes/${evaluation.id}/approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            comentario_avaliador: respostas['Q15']?.comentario || ''
          }),
        });

        if (!approveResponse.ok) {
          const data = await approveResponse.json();
          throw new Error(data.error || 'Erro ao aprovar avaliação');
        }
      } else {
        // Colaborador submete para revisão
        const submitResponse = await fetch(`/api/avaliacao-desempenho/avaliacoes/${evaluation.id}/submit`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!submitResponse.ok) {
          const data = await submitResponse.json();
          throw new Error(data.error || 'Erro ao submeter avaliação');
        }
      }

      // Redirecionar para a página de visualização
      router.push(`/avaliacao/ver/${evaluation.id}?success=true`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar avaliação');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
            Voltar
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isManager ? 'Avaliação Gerencial' : 'Autoavaliação'}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div>
                <span className="font-semibold">Período:</span> {evaluation.periodo?.nome || evaluation.periodo || 'N/A'}
              </div>
              <div>
                <span className="font-semibold">Colaborador:</span> {evaluation.funcionario?.name || 'N/A'}
              </div>
              {isManager && (
                <div>
                  <span className="font-semibold">Sua função:</span> Gestor Avaliador
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Mensagens de feedback */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6"
          >
            <p className="text-red-800 font-medium">{error}</p>
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6"
          >
            <p className="text-green-800 font-medium">{successMessage}</p>
          </motion.div>
        )}

        {/* Instruções */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            📋 Instruções
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {isManager ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Avalie o desempenho do colaborador nas questões 15 a 17
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Revise a autoavaliação do colaborador (questões 11-14) se necessário
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Forneça feedback construtivo nos comentários
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Responda as questões 11 a 14 sobre seu desempenho
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Use a escala de 1 a 5 estrelas para avaliar cada aspecto
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Forneça exemplos específicos nos comentários
                </li>
              </>
            )}
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              Você pode salvar como rascunho e continuar depois
            </li>
          </ul>
        </motion.div>

        {/* Questionário */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <QuestionarioAvaliacaoCardBased
            respostas={respostas}
            onChange={handleChange}
            isManager={isManager}
            readOnly={false}
          />
        </motion.div>

        {/* Botões de ação */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200"
        >
          <div className="flex flex-wrap gap-4 justify-end">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSave className="w-5 h-5" />
              {isSaving ? 'Salvando...' : 'Salvar Rascunho'}
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSend className="w-5 h-5" />
              {isSaving ? 'Enviando...' : isManager ? 'Finalizar Avaliação' : 'Enviar para Aprovação'}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-right mt-4">
            {isManager 
              ? 'Ao finalizar, a avaliação será marcada como concluída'
              : 'Ao enviar, a avaliação será enviada para seu gestor revisar'
            }
          </p>
        </motion.div>
      </div>
    </div>
  );
}
