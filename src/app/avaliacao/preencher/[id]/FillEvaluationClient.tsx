'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiSave, FiSend, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import QuestionarioAvaliacaoCardBased from '@/components/avaliacao/QuestionarioAvaliacaoCardBased';
import { Evaluation } from '@/types';
import { QUESTIONARIO_PADRAO } from '@/lib/schemas/evaluation-schemas';
import { useI18n } from '@/contexts/I18nContext';
import { useAlert } from '@/contexts/AlertContext';
import { fetchWithToken } from '@/lib/tokenStorage';

interface FillEvaluationClientProps {
  evaluation: Evaluation;
  isManager: boolean;
  userId: string;
  isEmployeeLeader: boolean;
}

export default function FillEvaluationClient({
  evaluation,
  isManager,
  userId,
  isEmployeeLeader
}: FillEvaluationClientProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { showAlert } = useAlert();
  const [respostas, setRespostas] = useState<Record<string, any>>(
    evaluation.respostas || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [evaluatorComment, setEvaluatorComment] = useState(evaluation.comentario_avaliador || '');

  // Verificar se avaliação está concluída e bloquear edição
  useEffect(() => {
    if (evaluation.status === 'concluida') {
      showAlert({
        type: 'warning',
        title: t('evaluation.completed'),
        message: t('evaluation.alreadyCompleted'),
        onConfirm: () => router.push(`/avaliacao/ver/${evaluation.id}`)
      });
    }
  }, [evaluation.status, evaluation.id, router, t, showAlert]);

  // Bloquear renderização se avaliação estiver concluída
  if (evaluation.status === 'concluida') {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-yellow-200 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <FiAlertCircle className="w-8 h-8 text-yellow-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('evaluation.completed')}</h2>
          </div>
          <p className="text-gray-700 mb-6">
            {t('evaluation.alreadyCompletedMessage')}
          </p>
          <button
            onClick={() => router.push(`/avaliacao/ver/${evaluation.id}`)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {t('evaluation.viewEvaluation')}
          </button>
        </div>
      </div>
    );
  }

  // Verificar se o funcionário é líder (baseado no role ou cargo)
  // Agora recebemos via prop isEmployeeLeader calculada no backend

  const handleChange = (questionId: string, value: any) => {
    setRespostas(prev => ({
      ...prev,
      [questionId]: value
    }));
    setError(null);
  };

  const validateRespostas = (): boolean => {
    // Verificar se há pelo menos uma resposta preenchida
    const hasAnyResponse = Object.values(respostas).some(r =>
      (r?.comentario && r.comentario.trim().length > 0) || (r?.nota && r.nota > 0)
    );

    if (!hasAnyResponse) {
      setError(t('evaluation.fillAtLeastOne'));
      return false;
    }

    return true;
  };

  const validateEvaluatorComment = (): boolean => {
    if (isManager && (!evaluatorComment || evaluatorComment.trim().length === 0)) {
      setError(t('evaluation.evaluatorCommentRequired'));
      // Scroll para o campo de comentário
      const commentElement = document.getElementById('evaluator-comment-section');
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: 'smooth' });
      }
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    // Verificação adicional antes de salvar
    if (evaluation.status === 'concluida') {
      setError(t('evaluation.alreadyCompleted'));
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload = {
        respostas,
        comentario_avaliador: isManager ? evaluatorComment : undefined,
        status: evaluation.status
      };
      // DEBUG: Alert user with payload
      alert(`DEBUG SAVE:\nManager: ${isManager}\nComment: "${evaluatorComment}"\nPayload Comment: "${payload.comentario_avaliador}"`);
      console.log('[DEBUG CLIENT] Sending draft payload:', payload);

      const response = await fetch(`/api/avaliacao/${evaluation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('evaluation.errorSavingDraft'));
      }

      setSuccessMessage(t('evaluation.draftSaved'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evaluation.errorSavingDraft'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitClick = () => {
    // Verificação adicional antes de mostrar modal
    if (evaluation.status === 'concluida') {
      setError(t('evaluation.alreadyCompleted'));
      return;
    }

    if (!validateRespostas()) {
      return;
    }

    if (isManager && !validateEvaluatorComment()) {
      return;
    }

    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    setShowConfirmModal(false);

    try {
      setIsSaving(true);
      setError(null);

      if (isManager) {
        // Gerente aprova a avaliação e salva suas respostas (Q15-Q24)
        const approveResponse = await fetchWithToken(`/api/avaliacao-desempenho/avaliacoes/${evaluation.id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            comentario_avaliador: evaluatorComment, // Usar o state dedicado
            respostas: respostas  // Enviar respostas completas (Q15-Q24)
          }),
        });

        if (!approveResponse.ok) {
          const data = await approveResponse.json();
          throw new Error(data.error || t('evaluation.errorApproving'));
        }

        showAlert({
          type: 'success',
          title: t('common.success'),
          message: t('evaluation.approvedSuccess'),
          onConfirm: () => {
            router.push('/avaliacao');
            router.refresh();
          }
        });
      } else {
        // Colaborador submete para revisão
        const submitResponse = await fetchWithToken(`/api/avaliacao-desempenho/avaliacoes/${evaluation.id}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            respostas
          }),
        });

        if (!submitResponse.ok) {
          const data = await submitResponse.json();
          throw new Error(data.error || t('evaluation.errorSubmitting'));
        }

        showAlert({
          type: 'success',
          title: t('common.success'),
          message: t('evaluation.sentForApproval'),
          onConfirm: () => {
            router.push('/avaliacao');
            router.refresh();
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evaluation.errorSubmitting'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-purple-50">
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
            {t('common.back')}
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isManager ? t('evaluation.managerialEvaluation') : t('evaluation.selfEvaluation')}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div>
                <span className="font-semibold">{t('evaluation.period')}:</span> {
                  typeof evaluation.periodo === 'string'
                    ? evaluation.periodo
                    : (evaluation.periodo?.nome || 'N/A')
                }
              </div>
              <div>
                <span className="font-semibold">{t('evaluation.employee')}:</span> {evaluation.funcionario?.name || 'N/A'}
              </div>
              {isManager && (
                <div>
                  <span className="font-semibold">{t('evaluation.yourRole')}:</span> {t('evaluation.managerEvaluator')}
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
            📋 {t('evaluation.instructions')}
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {isManager ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  {t('evaluation.instructionManager1')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  {t('evaluation.instructionManager2')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  {t('evaluation.instructionManager3')}
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  {t('evaluation.instructionEmployee1')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  {t('evaluation.instructionEmployee2')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  {t('evaluation.instructionEmployee3')}
                </li>
              </>
            )}
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              {t('evaluation.canSaveDraft')}
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
            isEmployeeLeader={isEmployeeLeader}
          />
        </motion.div>

        {/* Campo de Comentário Final do Avaliador (Apenas Gerente) */}
        {isManager && (
          <motion.div
            id="evaluator-comment-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-8 bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-200"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-purple-600">✍️</span>
              {t('evaluation.finalEvaluatorComment')}
              <span className="text-red-500 text-sm ml-1">*</span>
            </h3>

            {t('evaluation.finalEvaluatorCommentDesc')}
            <br />
            <span className="text-red-500 font-bold">{t('evaluation.evaluatorCommentRequiredNote')}</span>

            <textarea
              value={evaluatorComment}
              onChange={(e) => {
                setEvaluatorComment(e.target.value);
                setError(null);
              }}
              placeholder={t('evaluation.finalEvaluatorCommentPlaceholder')}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none h-40"
            />

            <p className="text-xs text-gray-500 mt-2 text-right">
              {evaluatorComment.length} {t('common.characters')}
            </p>
          </motion.div>
        )}

        {/* Botões de ação — rodapé sticky: Salvar/Enviar ficam visíveis no fim do formulário
            (no mobile o submit não some após as 24 questões) + safe-area da home indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="sticky bottom-0 z-30 mt-8 bg-white/95 backdrop-blur rounded-t-2xl shadow-lg border-2 border-gray-200 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex flex-wrap gap-4 justify-end">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSave className="w-5 h-5" />
              {isSaving ? t('evaluation.saving') : t('evaluation.saveDraft')}
            </button>

            <button
              onClick={handleSubmitClick}
              disabled={isSaving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSend className="w-5 h-5" />
              {isSaving ? t('evaluation.sending') : isManager ? t('evaluation.finalize') : t('evaluation.sendForApproval')}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-right mt-4 hidden sm:block">
            {isManager
              ? t('evaluation.finalizeNote')
              : t('evaluation.sendNote')
            }
          </p>
        </motion.div>

        {/* Modal de Confirmação */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FiAlertCircle className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {isManager ? t('evaluation.confirmFinalizeTitle') : t('evaluation.confirmSubmitTitle')}
                </h3>
              </div>

              <p className="text-gray-700 mb-6">
                {isManager ? t('evaluation.confirmFinalizeMessage') : t('evaluation.confirmSubmitMessage')}
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
                >
                  {t('evaluation.cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
                >
                  {t('evaluation.confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
