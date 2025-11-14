'use client';

import React, { useState, useEffect } from 'react';
import { Evaluation, EvaluationCriterion, User } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { FiUser, FiCalendar, FiArrowLeft, FiSave, FiCheckCircle } from 'react-icons/fi';
import QuestionarioAvaliacaoCardBased from '@/components/avaliacao/QuestionarioAvaliacaoCardBased';
import EvaluationCharts from '@/components/avaliacao/EvaluationCharts';
import StatusBadge from '@/components/avaliacao/StatusBadge';
import { QUESTIONARIO_PADRAO } from '@/lib/schemas/evaluation-schemas';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ViewEvaluationClientProps {
  evaluation: Evaluation;
  criteria: EvaluationCriterion[];
  employee: User | null;
  manager: User | null;
}

export default function ViewEvaluationClient({
  evaluation,
  criteria,
  employee,
  manager,
}: ViewEvaluationClientProps) {
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const [isManagerView, setIsManagerView] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, any>>(evaluation.respostas || {});
  const [notasGerente, setNotasGerente] = useState<Record<string, number>>(evaluation.notas_gerente || {});
  const [activeTab, setActiveTab] = useState<'questionnaire' | 'charts'>('questionnaire');
  const [comentarioGerente, setComentarioGerente] = useState(evaluation.comentario_gerente || '');
  const [comentarioFinalFuncionario, setComentarioFinalFuncionario] = useState(evaluation.comentario_final_funcionario || '');
  const [showManagerActions, setShowManagerActions] = useState(false);

  useEffect(() => {
    if (user && evaluation) {
      setIsManagerView(user.id === evaluation.avaliador_id || user.role === 'ADMIN');
    }
  }, [user, evaluation]);

  const handleRespostaChange = (questionId: string, value: any) => {
    setRespostas(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNotaGerenteChange = (questionId: string, nota: number) => {
    setNotasGerente(prev => ({
      ...prev,
      [questionId]: nota
    }));
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/avaliacao/${evaluation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          respostas,
          notas_gerente: notasGerente 
        })
      });

      if (response.ok) {
        alert('Avaliação salva com sucesso!');
        router.refresh();
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar avaliação');
    }
  };

  const handleFinalComment = async () => {
    if (!comentarioFinalFuncionario.trim()) {
      alert('Por favor, adicione seu comentário final sobre a avaliação');
      return;
    }

    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('abzToken='))?.split('=')[1];
      const response = await fetch(`/api/avaliacao-desempenho/avaliacoes/${evaluation.id}/final-comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comentario_final: comentarioFinalFuncionario
        })
      });

      if (response.ok) {
        alert('Comentário final enviado com sucesso! Aguardando finalização do gerente.');
        router.push('/avaliacao');
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao enviar comentário final');
      }
    } catch (error) {
      console.error('Erro ao enviar comentário final:', error);
      alert('Erro ao enviar comentário final');
    }
  };

  const handleManagerAction = async (action: 'approve' | 'return' | 'finalize') => {
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('abzToken='))?.split('=')[1];

      if (action === 'finalize') {
        // Finalizar avaliação após comentário do funcionário
        const response = await fetch(`/api/avaliacao-desempenho/avaliacoes/${evaluation.id}/finalize`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          alert('Avaliação finalizada com sucesso!');
          router.push('/avaliacao');
          router.refresh();
        } else {
          const data = await response.json();
          alert(data.error || 'Erro ao finalizar avaliação');
        }
      } else if (action === 'approve') {
        // Usar a nova API de aprovação
        const response = await fetch(`/api/avaliacao-desempenho/avaliacoes/${evaluation.id}/approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            comentario_avaliador: comentarioGerente,
            notas_gerente: notasGerente
          })
        });

        if (response.ok) {
          alert('Avaliação aprovada e finalizada!');
          router.push('/avaliacao');
          router.refresh();
        } else {
          const data = await response.json();
          alert(data.error || 'Erro ao aprovar avaliação');
        }
      } else {
        // Devolver para ajustes
        const response = await fetch(`/api/avaliacao/${evaluation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'devolvida',
            comentario_gerente: comentarioGerente
          })
        });

        if (response.ok) {
          alert('Avaliação devolvida para ajustes!');
          router.push('/avaliacao');
          router.refresh();
        } else {
          const data = await response.json();
          alert(data.error || 'Erro ao devolver avaliação');
        }
      }
    } catch (error) {
      console.error('Erro ao processar avaliação:', error);
      alert('Erro ao processar avaliação');
    }
  };

  const handleSubmitForReview = async () => {
    try {
      const response = await fetch(`/api/avaliacao/${evaluation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          respostas,
          status: 'pendente_aprovacao_gerente' 
        })
      });

      if (response.ok) {
        alert('Avaliação enviada para aprovação do gerente!');
        router.refresh();
      }
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      alert('Erro ao enviar avaliação');
    }
  };

  if (!evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Avaliação não encontrada.</p>
      </div>
    );
  }

  const readOnly = evaluation.status === 'concluida';
  const isDevolvida = evaluation.status === 'devolvida';
  const isPendingManagerReview = evaluation.status === 'aguardando_aprovacao';
  const isAwaitingFinalComment = evaluation.status === 'aprovada_aguardando_comentario';
  const isAwaitingFinalization = evaluation.status === 'aguardando_finalizacao';
  const canEmployeeEdit = ['pendente', 'em_andamento', 'devolvida'].includes(evaluation.status) && evaluation.status !== 'concluida';
  const canEmployeeComment = isAwaitingFinalComment;
  const canManagerReview = isManagerView && isPendingManagerReview && evaluation.status !== 'concluida';
  const canManagerFinalize = isManagerView && isAwaitingFinalization;
  const isEmployee = user?.id === evaluation.funcionario_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="abz-container py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link 
            href="/avaliacao"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <FiArrowLeft />
            Voltar para lista
          </Link>
          
          <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h1 className="text-4xl font-bold text-gray-900">
                Avaliação de Desempenho
              </h1>
              <StatusBadge status={evaluation.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className="relative">
                  {(employee?.avatar || employee?.drive_photo_url) ? (
                    <img 
                      src={employee.avatar || employee.drive_photo_url} 
                      alt={employee.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-blue-500 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center border-2 border-blue-500 shadow-md">
                      <FiUser className="w-7 h-7 text-blue-600" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Colaborador</p>
                  <p className="text-lg font-semibold text-gray-900">{employee?.name}</p>
                  <p className="text-sm text-gray-500">{employee?.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="relative">
                  {(manager?.avatar || manager?.drive_photo_url) ? (
                    <img 
                      src={manager.avatar || manager.drive_photo_url} 
                      alt={manager.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-purple-500 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center border-2 border-purple-500 shadow-md">
                      <FiUser className="w-7 h-7 text-purple-600" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avaliador</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {manager?.name || 'Não atribuído'}
                  </p>
                  {manager?.email && (
                    <p className="text-sm text-gray-500">{manager.email}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-3 bg-green-50 rounded-lg">
                  <FiCalendar className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Período</p>
                  <p className="text-lg font-semibold text-gray-900">{evaluation.periodo?.nome || evaluation.periodo || 'N/A'}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(evaluation.data_inicio), 'dd/MM/yyyy', { locale: ptBR })} até{' '}
                    {format(new Date(evaluation.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-3 bg-orange-50 rounded-lg">
                  <FiCheckCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Criação</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {format(new Date(evaluation.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                  {evaluation.data_aprovacao && (
                    <p className="text-sm text-green-600">
                      Aprovada em {format(new Date(evaluation.data_aprovacao), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-md p-2 mb-6 inline-flex gap-2"
        >
          <button
            onClick={() => setActiveTab('questionnaire')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'questionnaire'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Questionário
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'charts'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Análises e Gráficos
          </button>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {activeTab === 'questionnaire' ? (
            <QuestionarioAvaliacaoCardBased
              respostas={respostas}
              onChange={handleRespostaChange}
              isManager={isManagerView}
              readOnly={readOnly}
              notasGerente={notasGerente}
              onNotaGerenteChange={handleNotaGerenteChange}
            />
          ) : (
            <EvaluationCharts
              respostas={respostas}
              questionarioData={QUESTIONARIO_PADRAO}
              notasGerente={notasGerente}
            />
          )}
        </motion.div>

        {/* Comments Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Observações e Comentários</h3>
          
          {/* Comentário Final do Funcionário */}
          {(evaluation.comentario_final_funcionario || isAwaitingFinalization) && (
            <div className="mb-6 p-6 rounded-xl border-2 bg-green-50 border-green-300">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                💬 Comentário Final do Colaborador
              </h4>
              <div className="text-gray-700 leading-relaxed">
                {evaluation.comentario_final_funcionario || 'Aguardando comentário final...'}
              </div>
            </div>
          )}

          {/* Comentários do Gerente - Destaque se avaliação foi devolvida */}
          {(evaluation.comentario_gerente || isDevolvida) && (
            <div className={`mb-6 p-6 rounded-xl border-2 ${
              isDevolvida 
                ? 'bg-orange-50 border-orange-300' 
                : 'bg-purple-50 border-purple-200'
            }`}>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  isDevolvida ? 'bg-orange-500' : 'bg-purple-500'
                }`}></span>
                {isDevolvida ? '🔄 Comentários para Ajustes' : 'Comentários do Gerente'}
              </h4>
              <div className="text-gray-700 leading-relaxed">
                {evaluation.comentario_gerente || 'Aguardando comentários do gerente...'}
              </div>
            </div>
          )}

          {/* Interface para Funcionário Adicionar Comentário Final */}
          {isEmployee && canEmployeeComment && (
            <div className="mb-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                💬 Seu Comentário Final sobre a Avaliação
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                O gerente aprovou sua avaliação. Adicione seu comentário final antes da finalização.
              </p>
              <textarea
                value={comentarioFinalFuncionario}
                onChange={(e) => setComentarioFinalFuncionario(e.target.value)}
                placeholder="Adicione suas considerações finais sobre a avaliação..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                rows={4}
              />
            </div>
          )}

          {/* Interface para Gerente Adicionar Comentários */}
          {canManagerReview && (
            <div className="mb-6 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                Adicionar Comentários (Opcional)
              </h4>
              <textarea
                value={comentarioGerente}
                onChange={(e) => setComentarioGerente(e.target.value)}
                placeholder="Adicione comentários para o colaborador (obrigatório apenas se devolver para ajustes)..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all resize-none"
                rows={4}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Observações do Colaborador
              </h4>
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
                <p className="text-gray-700">
                  {evaluation.observacoes || 'Nenhuma observação registrada.'}
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Status da Avaliação
              </h4>
              <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
                <StatusBadge status={evaluation.status} />
                {evaluation.data_aprovacao && (
                  <p className="text-sm text-green-600 mt-2">
                    Finalizada em {format(new Date(evaluation.data_aprovacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200"
        >
          <div className="flex flex-wrap justify-end gap-4">
            {/* Botão Preencher Avaliação (Colaborador) */}
            {isEmployee && canEmployeeEdit && evaluation.status !== 'concluida' && (
              <Link
                href={`/avaliacao/preencher/${evaluation.id}`}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <FiSave className="w-5 h-5" />
                Preencher Avaliação
              </Link>
            )}

            {/* Botão Enviar Comentário Final (Colaborador) */}
            {isEmployee && canEmployeeComment && (
              <button
                onClick={handleFinalComment}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <FiCheckCircle className="w-5 h-5" />
                Enviar Comentário Final
              </button>
            )}

            {/* Botões para Gerente - Finalização */}
            {canManagerFinalize && (
              <>
                <button
                  onClick={() => {
                    if (confirm('Deseja devolver esta avaliação para o colaborador revisar o comentário final?')) {
                      handleManagerAction('return');
                    }
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors font-semibold"
                >
                  🔄 Devolver para Revisão
                </button>
                <button
                  onClick={() => {
                    if (confirm('Tem certeza que deseja finalizar e concluir esta avaliação definitivamente?')) {
                      handleManagerAction('finalize');
                    }
                  }}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl font-semibold"
                >
                  <FiCheckCircle className="w-5 h-5" />
                  Finalizar e Concluir
                </button>
              </>
            )}

            {/* Botões para Gerente - Aprovação Inicial */}
            {canManagerReview && (
              <>
                <button
                  onClick={() => {
                    if (!comentarioGerente.trim()) {
                      alert('Adicione comentários para devolver a avaliação');
                      return;
                    }
                    if (confirm('Tem certeza que deseja devolver esta avaliação para ajustes?')) {
                      handleManagerAction('return');
                    }
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors font-semibold"
                >
                  🔄 Devolver para Ajustes
                </button>
                <button
                  onClick={() => {
                    if (confirm('Tem certeza que deseja aprovar e finalizar esta avaliação?')) {
                      handleManagerAction('approve');
                    }
                  }}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl font-semibold"
                >
                  <FiCheckCircle className="w-5 h-5" />
                  Aprovar e Finalizar
                </button>
              </>
            )}

            {/* Mensagem se não houver ações disponíveis */}
            {!canEmployeeEdit && !canManagerReview && !readOnly && (
              <p className="text-gray-600 italic">
                Aguardando ação de outra parte
              </p>
            )}

            {readOnly && (
              <p className="text-green-600 font-semibold flex items-center gap-2">
                <FiCheckCircle className="w-5 h-5" />
                Avaliação Concluída
              </p>
            )}
          </div>

          <p className="text-xs text-gray-500 text-right mt-4">
            {isEmployee && canEmployeeEdit && 'Clique em "Preencher Avaliação" para responder o questionário'}
            {canManagerReview && 'Revise as respostas e aprove ou devolva para ajustes'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
