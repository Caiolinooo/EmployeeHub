'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiCalendar, FiClock, FiPlay, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { EvaluationPeriod } from '@/types';

interface ActivePeriodCardProps {
  period: EvaluationPeriod;
  existingEvaluationId?: string | null;
  evaluationStatus?: string;
  index: number;
  type: 'active' | 'upcoming';
}

export default function ActivePeriodCard({
  period,
  existingEvaluationId,
  evaluationStatus,
  index,
  type
}: ActivePeriodCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const hoje = new Date();
  const dataInicio = period?.data_inicio ? new Date(period.data_inicio) : new Date();
  const dataFim = period?.data_fim ? new Date(period.data_fim) : new Date();
  const dataLimiteAuto = period?.data_limite_autoavaliacao ? new Date(period.data_limite_autoavaliacao) : dataFim;

  const diasParaIniciar = differenceInDays(dataInicio, hoje);
  const diasParaEncerrar = differenceInDays(dataLimiteAuto, hoje);

  const handleIniciarAvaliacao = async () => {
    setIsLoading(true);

    try {
      // Se já existe avaliação, redirecionar para preenchimento
      if (existingEvaluationId) {
        router.push(`/avaliacao/preencher/${existingEvaluationId}`);
        return;
      }

      // Caso contrário, criar nova avaliação
      const response = await fetch('/api/avaliacao/iniciar-periodo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ periodo_id: period.id })
      });

      const data = await response.json();

      if (data.success && data.avaliacao) {
        // Redirecionar para página de preenchimento
        router.push(`/avaliacao/preencher/${data.avaliacao.id}`);
      } else {
        alert(data.error || data.hint || 'Erro ao iniciar avaliação');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Erro ao iniciar avaliação:', error);
      alert('Erro ao iniciar avaliação. Tente novamente.');
      setIsLoading(false);
    }
  };

  // Determinar cor do badge baseado no status
  const getBadgeConfig = () => {
    if (type === 'upcoming') {
      return {
        text: `Inicia em ${diasParaIniciar} dia${diasParaIniciar !== 1 ? 's' : ''}`,
        color: 'text-blue-700',
        bg: 'bg-blue-100',
        icon: <FiClock className="w-4 h-4" />
      };
    }

    if (diasParaEncerrar <= 3) {
      return {
        text: `Encerra em ${diasParaEncerrar} dia${diasParaEncerrar !== 1 ? 's' : ''}`,
        color: 'text-red-700',
        bg: 'bg-red-100',
        icon: <FiClock className="w-4 h-4" />
      };
    }

    if (diasParaEncerrar <= 7) {
      return {
        text: `Encerra em ${diasParaEncerrar} dias`,
        color: 'text-orange-700',
        bg: 'bg-orange-100',
        icon: <FiClock className="w-4 h-4" />
      };
    }

    return {
      text: 'Período Ativo',
      color: 'text-green-700',
      bg: 'bg-green-100',
      icon: <FiCheckCircle className="w-4 h-4" />
    };
  };

  const badgeConfig = getBadgeConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-white rounded-xl border-2 ${
        type === 'active' 
          ? 'border-green-200 shadow-md hover:shadow-lg' 
          : 'border-blue-200 shadow-sm hover:shadow-md'
      } transition-all p-6 group`}
    >
      {/* Header com Badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            {period?.nome || 'Período de Avaliação'}
          </h3>
          <p className="text-sm text-gray-600">
            {period?.descricao || 'Ciclo de avaliação de desempenho'}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badgeConfig.color} ${badgeConfig.bg} border border-current border-opacity-20`}>
          {badgeConfig.icon}
          {badgeConfig.text}
        </span>
      </div>

      {/* Datas */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FiCalendar className="w-4 h-4 text-gray-400" />
          <span>
            <strong>Período:</strong>{' '}
            {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })} até{' '}
            {format(dataFim, 'dd/MM/yyyy', { locale: ptBR })}
          </span>
        </div>
        
        {period.data_limite_autoavaliacao && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FiClock className="w-4 h-4 text-orange-400" />
            <span>
              <strong>Prazo Autoavaliação:</strong>{' '}
              {format(dataLimiteAuto, 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          </div>
        )}
      </div>

      {/* Botão de Ação */}
      {evaluationStatus === 'concluida' ? (
        <div className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-green-50 border-2 border-green-200 text-green-700">
          <FiCheckCircle className="w-5 h-5" />
          <span>Avaliação Concluída</span>
        </div>
      ) : evaluationStatus === 'aguardando_aprovacao' || 
         evaluationStatus === 'aprovada_aguardando_comentario' || 
         evaluationStatus === 'aguardando_finalizacao' ? (
        <div className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-yellow-50 border-2 border-yellow-200 text-yellow-700">
          <FiClock className="w-5 h-5" />
          <span>Aguardando Avaliação do Gestor</span>
        </div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleIniciarAvaliacao}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
            existingEvaluationId
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : type === 'active'
              ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Carregando...</span>
            </>
          ) : existingEvaluationId ? (
            <>
              <FiArrowRight className="w-5 h-5" />
              <span>Continuar Avaliação</span>
            </>
          ) : type === 'active' ? (
            <>
              <FiPlay className="w-5 h-5" />
              <span>Iniciar Minha Avaliação</span>
            </>
          ) : (
            <>
              <FiClock className="w-5 h-5" />
              <span>Disponível em breve</span>
            </>
          )}
        </motion.button>
      )}

      {/* Info adicional */}
      {evaluationStatus === 'concluida' && (
        <p className="text-xs text-center text-green-600 mt-2">
          Esta avaliação foi finalizada pelo seu gestor
        </p>
      )}
      {existingEvaluationId && 
       evaluationStatus !== 'aguardando_aprovacao' && 
       evaluationStatus !== 'aprovada_aguardando_comentario' && 
       evaluationStatus !== 'aguardando_finalizacao' && 
       evaluationStatus !== 'concluida' && (
        <p className="text-xs text-center text-gray-500 mt-2">
          Você já iniciou esta avaliação
        </p>
      )}
      {(evaluationStatus === 'aguardando_aprovacao' || 
        evaluationStatus === 'aprovada_aguardando_comentario' || 
        evaluationStatus === 'aguardando_finalizacao') && (
        <p className="text-xs text-center text-gray-500 mt-2">
          Sua autoavaliação foi enviada e está aguardando revisão
        </p>
      )}
    </motion.div>
  );
}
