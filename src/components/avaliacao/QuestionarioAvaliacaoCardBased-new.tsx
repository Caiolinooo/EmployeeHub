'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiUser, FiUsers } from 'react-icons/fi';
import { QUESTIONARIO_PADRAO, ESCALA_AVALIACAO } from '@/lib/schemas/evaluation-schemas-new';
import StarRating from '@/components/StarRating';

interface QuestionarioAvaliacaoCardBasedProps {
  respostas: Record<string, any>;
  onChange: (questionId: string, value: any) => void;
  isManager?: boolean;
  readOnly?: boolean;
}

export default function QuestionarioAvaliacaoCardBased({
  respostas,
  onChange,
  isManager = false,
  readOnly = false
}: QuestionarioAvaliacaoCardBasedProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Autoavaliação': true,
    'Competências Comportamentais': isManager,
    'Habilidades Interpessoais': isManager,
    'Competências Técnicas': isManager,
    'Liderança': isManager,
    'Avaliação do Gerente': isManager
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

  // Filtrar questões baseado no tipo de usuário
  const getQuestionsForUser = (categoria: string) => {
    const questions = questionsByCategory[categoria] || [];
    return questions.filter(q => {
      if (isManager) {
        return q.tipo === 'manager';
      } else {
        return q.tipo === 'collaborator';
      }
    });
  };

  const renderCollaboratorQuestion = (question: typeof QUESTIONARIO_PADRAO[0]) => {
    const resposta = respostas[question.id];

    return (
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md p-6"
      >
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {question.titulo}
          </h3>
          {question.descricao && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {question.descricao}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Sua resposta:
          </label>
          <textarea
            value={resposta?.comentario || ''}
            onChange={e => onChange(question.id, { 
              ...resposta, 
              comentario: e.target.value 
            })}
            readOnly={readOnly}
            placeholder="Descreva sua resposta de forma detalhada..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-2">
            {question.obrigatoria ? '* Campo obrigatório' : 'Opcional'}
          </p>
        </div>
      </motion.div>
    );
  };

  const renderManagerQuestion = (question: typeof QUESTIONARIO_PADRAO[0]) => {
    const resposta = respostas[question.id];

    return (
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border-2 border-gray-200 hover:border-purple-300 transition-all shadow-sm hover:shadow-md p-6"
      >
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {question.titulo}
          </h3>
          {question.descricao && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {question.descricao}
            </p>
          )}
        </div>

        {question.categoria !== 'Avaliação do Gerente' && (
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
            <StarRating
              maxRating={5}
              initialRating={resposta?.nota || 0}
              onChange={(newRating) => onChange(question.id, {
                ...resposta,
                nota: newRating
              })}
              size="lg"
              readOnly={readOnly}
              showLabel={true}
              showTooltip={!readOnly}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Comentários:
          </label>
          <textarea
            value={resposta?.comentario || ''}
            onChange={e => onChange(question.id, { 
              ...resposta, 
              comentario: e.target.value 
            })}
            readOnly={readOnly}
            placeholder="Adicione comentários detalhados sobre esta avaliação..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-2">
            {question.obrigatoria ? '* Campo obrigatório' : 'Opcional'}
          </p>
        </div>
      </motion.div>
    );
  };

  const renderSection = (categoria: string, icon: React.ReactNode, color: string) => {
    const questions = getQuestionsForUser(categoria);
    if (questions.length === 0) return null;

    const isCollaboratorSection = categoria === 'Autoavaliação';

    return (
      <div key={categoria} className={`bg-gradient-to-r ${color} rounded-2xl overflow-hidden border-2 ${isCollaboratorSection ? 'border-blue-200' : 'border-purple-200'}`}>
        <button
          onClick={() => toggleSection(categoria)}
          className="w-full p-6 flex items-center justify-between hover:bg-white/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 ${isCollaboratorSection ? 'bg-blue-500' : 'bg-purple-500'} rounded-xl flex items-center justify-center shadow-lg`}>
              {icon}
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-bold text-gray-900">
                {categoria}
              </h2>
              <p className="text-sm text-gray-600">
                {questions.length} {questions.length === 1 ? 'questão' : 'questões'}
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: expandedSections[categoria] ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <FiChevronDown className="w-6 h-6 text-gray-600" />
          </motion.div>
        </button>

        <AnimatePresence>
          {expandedSections[categoria] && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="px-6 pb-6"
            >
              <div className="space-y-6">
                {questions.map(question => 
                  isCollaboratorSection 
                    ? renderCollaboratorQuestion(question)
                    : renderManagerQuestion(question)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderSection('Autoavaliação', <FiUser className="w-7 h-7 text-white" />, 'from-blue-50 to-blue-100')}
      
      {isManager && (
        <>
          {renderSection('Competências Comportamentais', <FiUsers className="w-7 h-7 text-white" />, 'from-purple-50 to-purple-100')}
          {renderSection('Habilidades Interpessoais', <FiUsers className="w-7 h-7 text-white" />, 'from-purple-50 to-purple-100')}
          {renderSection('Competências Técnicas', <FiUsers className="w-7 h-7 text-white" />, 'from-purple-50 to-purple-100')}
          {renderSection('Liderança', <FiUsers className="w-7 h-7 text-white" />, 'from-purple-50 to-purple-100')}
          {renderSection('Avaliação do Gerente', <FiUsers className="w-7 h-7 text-white" />, 'from-purple-50 to-purple-100')}
        </>
      )}
    </div>
  );
}