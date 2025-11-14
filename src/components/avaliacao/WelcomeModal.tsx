'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheckCircle, FiClock, FiUser, FiStar, FiArrowRight } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: 'collaborator' | 'manager' | 'admin';
}

export default function WelcomeModal({ isOpen, onClose, userRole = 'collaborator' }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const hasSeenWelcome = localStorage.getItem('evaluation_welcome_seen');
      if (hasSeenWelcome) {
        onClose();
      }
    }
  }, [isOpen, onClose]);

  const handleClose = () => {
    localStorage.setItem('evaluation_welcome_seen', 'true');
    onClose();
  };

  const collaboratorSteps = [
    {
      icon: <FiUser className="w-8 h-8 text-blue-600" />,
      title: 'Bem-vindo ao Sistema de Avaliação',
      description: 'Este é um processo simples e transparente de avaliação 360° que ajudará no seu desenvolvimento profissional.',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      icon: <FiClock className="w-8 h-8 text-yellow-600" />,
      title: 'Passo 1: Autoavaliação',
      description: 'Você responderá 4 perguntas sobre seus pontos fortes, áreas de melhoria, objetivos alcançados e planos de desenvolvimento. Tempo estimado: 20-30 minutos.',
      color: 'bg-yellow-50 border-yellow-200'
    },
    {
      icon: <FiStar className="w-8 h-8 text-purple-600" />,
      title: 'Passo 2: Avaliação do Gerente',
      description: 'Após enviar, seu gerente receberá suas respostas e avaliará suas competências técnicas e comportamentais usando uma escala de 1 a 5.',
      color: 'bg-purple-50 border-purple-200'
    },
    {
      icon: <FiCheckCircle className="w-8 h-8 text-green-600" />,
      title: 'Passo 3: Feedback e Conclusão',
      description: 'Seu gerente pode aprovar a avaliação ou devolver para ajustes. Ao final, você terá acesso a um feedback detalhado e plano de desenvolvimento.',
      color: 'bg-green-50 border-green-200'
    }
  ];

  const managerSteps = [
    {
      icon: <FiUser className="w-8 h-8 text-blue-600" />,
      title: 'Bem-vindo - Visão do Gerente',
      description: 'Como gerente, você tem um papel fundamental no desenvolvimento da sua equipe através da avaliação de desempenho.',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      icon: <FiClock className="w-8 h-8 text-purple-600" />,
      title: 'Suas Responsabilidades',
      description: 'Você receberá notificações quando seus colaboradores enviarem autoavaliações. Revise com atenção e avalie com justiça e empatia.',
      color: 'bg-purple-50 border-purple-200'
    },
    {
      icon: <FiStar className="w-8 h-8 text-yellow-600" />,
      title: 'Avaliação de Competências',
      description: 'Avalie 7-9 competências (comportamentais, técnicas e liderança se aplicável) usando escala 1-5. O comentário da Questão 15 é OBRIGATÓRIO.',
      color: 'bg-yellow-50 border-yellow-200'
    },
    {
      icon: <FiCheckCircle className="w-8 h-8 text-green-600" />,
      title: 'Aprovação ou Devolução',
      description: 'Após avaliar, você pode aprovar (conclusão) ou devolver para ajustes. Use esse momento para construir um feedback construtivo.',
      color: 'bg-green-50 border-green-200'
    }
  ];

  const steps = userRole === 'manager' ? managerSteps : collaboratorSteps;
  const currentStepData = steps[currentStep];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-500" />
            </button>

            <div className="p-8">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className={cn('flex items-center justify-center w-16 h-16 rounded-2xl border-2 mx-auto', currentStepData.color)}>
                  {currentStepData.icon}
                </div>

                <div className="text-center space-y-3">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {currentStepData.title}
                  </h2>
                  <p className="text-base text-gray-600 leading-relaxed">
                    {currentStepData.description}
                  </p>
                </div>

                <div className="flex justify-center items-center gap-2 pt-4">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'h-2 rounded-full transition-all duration-300',
                        index === currentStep ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300'
                      )}
                    />
                  ))}
                </div>
              </motion.div>

              <div className="flex gap-3 mt-8">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="flex-1 px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Anterior
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className={cn(
                    'px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                    currentStep === 0 ? 'flex-1' : 'flex-1',
                    'bg-blue-600 text-white hover:bg-blue-700'
                  )}
                >
                  {currentStep === steps.length - 1 ? 'Começar' : 'Próximo'}
                  <FiArrowRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleClose}
                className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Pular introdução
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
