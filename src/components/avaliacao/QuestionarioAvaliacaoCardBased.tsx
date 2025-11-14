'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiChevronUp, FiUser, FiUsers } from 'react-icons/fi';
import { QUESTIONARIO_PADRAO, ESCALA_AVALIACAO } from '@/lib/schemas/evaluation-schemas';
import StarRating from '@/components/StarRating';

interface QuestionarioAvaliacaoCardBasedProps {
  respostas: Record<string, any>;
  onChange: (questionId: string, value: any) => void;
  isManager?: boolean;
  readOnly?: boolean;
  isEmployeeLeader?: boolean; // Se o funcionário sendo avaliado é líder
  notasGerente?: Record<string, number>; // Notas do gerente para questões do colaborador
  onNotaGerenteChange?: (questionId: string, nota: number) => void;
}

export default function QuestionarioAvaliacaoCardBased({
  respostas,
  onChange,
  isManager = false,
  readOnly = false,
  isEmployeeLeader = false,
  notasGerente = {},
  onNotaGerenteChange
}: QuestionarioAvaliacaoCardBasedProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    autoavaliacao: true,
    gerencial: isManager
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Agrupar questões por categoria
  const questionsByCategory = QUESTIONARIO_PADRAO.reduce((acc, question) => {
    if (!acc[question.categoria]) {
      acc[question.categoria] = [];
    }
    acc[question.categoria].push(question);
    return acc;
  }, {} as Record<string, typeof QUESTIONARIO_PADRAO>);

  // Filtrar questões baseado no tipo de usuário e categoria
  const getQuestionsForUser = (categoria: string, forceType?: 'collaborator' | 'manager') => {
    const questions = questionsByCategory[categoria] || [];
    return questions.filter(q => {
      // Filtrar questões de liderança se o funcionário não é líder
      if (q.apenas_lideres && !isEmployeeLeader) {
        return false;
      }
      
      if (forceType) {
        return q.tipo === forceType;
      }
      if (isManager) {
        return q.tipo === 'manager';
      } else {
        return q.tipo === 'collaborator';
      }
    });
  };

  const renderStarRating = (questionId: string, currentValue: number, isReadOnly: boolean = readOnly) => {
    const resposta = respostas[questionId];
    
    return (
      <StarRating
        maxRating={5}
        initialRating={currentValue}
        onChange={(newRating) => onChange(questionId, {
          ...resposta,
          nota: newRating
        })}
        size="lg"
        readOnly={isReadOnly}
        showLabel={true}
        showTooltip={!isReadOnly}
      />
    );
  };

  const renderQuestion = (question: typeof QUESTIONARIO_PADRAO[0], isReadOnly: boolean = readOnly) => {
    const resposta = respostas[question.id];
    const isCollaboratorQuestion = question.tipo === 'collaborator';
    const notaGerente = notasGerente[question.id];

    return (
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md p-6"
      >
        {/* Cabeçalho da pergunta */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {question.pergunta}
          </h3>
          {question.descricao && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {question.descricao}
            </p>
          )}
        </div>

        {/* Rating - Apenas para avaliações do gerente (Q15, Q16, Q17) */}
        {question.tipo === 'manager' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">
                Avaliação:
              </label>
              {resposta?.nota && (
                <span className={`text-lg font-bold ${
                  resposta.nota >= 4 ? 'text-green-600' :
                  resposta.nota >= 3 ? 'text-blue-600' :
                  resposta.nota >= 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {resposta.nota} / 5
                </span>
              )}
            </div>
            <div className="mb-4">
              {renderStarRating(question.id, resposta?.nota || 0, isReadOnly)}
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>1</strong> - Frequentemente não alcançou a expectativa</p>
              <p><strong>2</strong> - Não alcançou a expectativa</p>
              <p><strong>3</strong> - Alcançou a expectativa</p>
              <p><strong>4</strong> - Frequentemente excedeu a expectativa</p>
              <p><strong>5</strong> - Consistentemente excedeu a expectativa</p>
            </div>
          </div>
        )}

        {/* Comentário */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Comentários ou Justificativa:
          </label>
          <textarea
            value={resposta?.comentario || ''}
            onChange={e => onChange(question.id, { 
              ...resposta, 
              comentario: e.target.value 
            })}
            readOnly={isReadOnly}
            placeholder="Descreva evidências, exemplos ou contextos relevantes..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-2">
            {question.obrigatorio ? '* Campo obrigatório' : 'Opcional'}
          </p>
        </div>

        {/* Nota do Gerente (apenas para questões do colaborador quando gerente está avaliando) */}
        {isManager && isCollaboratorQuestion && onNotaGerenteChange && (
          <div className="mt-6 pt-6 border-t-2 border-purple-200 bg-purple-50 -mx-6 -mb-6 px-6 pb-6 rounded-b-xl">
            <label className="block text-sm font-semibold text-purple-700 mb-3">
              📊 Nota do Gerente para esta resposta:
            </label>
            <div className="flex items-center gap-4">
              <StarRating
                maxRating={5}
                initialRating={notaGerente || 0}
                onChange={(nota) => onNotaGerenteChange(question.id, nota)}
                size="lg"
                readOnly={readOnly}
                showLabel={true}
                showTooltip={!readOnly}
              />
              {notaGerente && (
                <span className={`text-2xl font-bold ${
                  notaGerente >= 4 ? 'text-green-600' :
                  notaGerente >= 3 ? 'text-blue-600' :
                  notaGerente >= 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {notaGerente}/5
                </span>
              )}
            </div>
            <p className="text-xs text-purple-600 mt-2">
              Avalie a qualidade e completude da resposta do colaborador
            </p>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Seção de Autoavaliação */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl overflow-hidden border-2 border-blue-200">
        <button
          onClick={() => toggleSection('autoavaliacao')}
          className="w-full p-6 flex items-center justify-between hover:bg-white/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <FiUser className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-bold text-gray-900">
                Autoavaliação (Colaborador)
              </h2>
              <p className="text-sm text-gray-600">
                Questões 11-14  Sua percepção sobre seu desempenho
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: expandedSections.autoavaliacao ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <FiChevronDown className="w-6 h-6 text-gray-600" />
          </motion.div>
        </button>

        <AnimatePresence>
          {expandedSections.autoavaliacao && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="px-6 pb-6"
            >
              <div className="space-y-6">
                {getQuestionsForUser('Autoavaliação', 'collaborator').map(q => renderQuestion(q, isManager))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Seção Gerencial (se aplicável) */}
      {isManager && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl overflow-hidden border-2 border-purple-200">
          <button
            onClick={() => toggleSection('gerencial')}
            className="w-full p-6 flex items-center justify-between hover:bg-white/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <FiUsers className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-bold text-gray-900">
                  Avaliação Gerencial
                </h2>
                <p className="text-sm text-gray-600">
                  Questões 15-17  Avaliação do gestor direto
                </p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: expandedSections.gerencial ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <FiChevronDown className="w-6 h-6 text-gray-600" />
            </motion.div>
          </button>

          <AnimatePresence>
            {expandedSections.gerencial && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="px-6 pb-6"
              >
                <div className="space-y-6">
                  {getQuestionsForUser('Avaliação do Gerente', 'manager').map(q => renderQuestion(q, false))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
