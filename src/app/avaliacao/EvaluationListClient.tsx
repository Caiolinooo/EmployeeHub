'use client';

import React, { useState, useEffect } from 'react';
import { Evaluation, EvaluationPeriod, User } from '@/types';
import { FiArrowLeft, FiSearch, FiTrendingUp, FiClock, FiCheckCircle, FiAlertCircle, FiCalendar } from 'react-icons/fi';
import Link from 'next/link';
import EvaluationCard from '@/components/avaliacao/EvaluationCard';
import WelcomeModal from '@/components/avaliacao/WelcomeModal';
import ActivePeriodCard from '@/components/avaliacao/ActivePeriodCard';
import MainLayout from '@/components/Layout/MainLayout';
import { motion } from 'framer-motion';

interface PeriodWithEvaluation {
  period: EvaluationPeriod;
  existingEvaluationId: string | null;
}

interface EvaluationListClientProps {
  initialEvaluations: Evaluation[];
  initialPeriods: EvaluationPeriod[];
  initialEmployees: User[];
  activePeriods?: PeriodWithEvaluation[];
  upcomingPeriods?: PeriodWithEvaluation[];
  currentUser: User;
}

export default function EvaluationListClient({
  initialEvaluations,
  initialPeriods,
  initialEmployees,
  activePeriods = [],
  upcomingPeriods = [],
  currentUser
}: EvaluationListClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  
  const isManager = currentUser?.role === 'MANAGER';

  const getEmployeeName = (id: string) => {
    if (!id) return 'Desconhecido';
    const employee = initialEmployees.find(e => e.id === id);
    return employee?.name || 'Desconhecido';
  };
  
  const getManagerName = (id: string) => {
    if (!id) return 'Gestor não atribuído';
    const manager = initialEmployees.find(e => e.id === id);
    return manager?.name || 'Gestor não atribuído';
  };
  
  const getPeriodName = (id: string) => {
    if (!id) return 'N/A';
    const period = initialPeriods.find(p => p.id === id);
    return period?.nome || 'N/A';
  };

  // Filtrar avaliações
  const filteredEvaluations = initialEvaluations.filter(ev => {
    const matchesSearch = !searchTerm || 
      getEmployeeName(ev.funcionario_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPeriod = !selectedPeriod || ev.periodo_id === selectedPeriod;
    return matchesSearch && matchesPeriod;
  });

  // Categorizar por status - USANDO STATUS CORRETOS DO BANCO
  const pending = filteredEvaluations.filter(ev => ev.status === 'pendente' || ev.status === 'em_andamento');
  const awaitingManager = filteredEvaluations.filter(ev => ev.status === 'aguardando_aprovacao');
  const completed = filteredEvaluations.filter(ev => ev.status === 'concluida');
  const needsAction = filteredEvaluations.filter(ev => ev.status === 'devolvida');
  
  // Filtrar avaliações pendentes de revisão do gerente atual
  const myPendingReviews = isManager ? awaitingManager.filter(ev => ev.avaliador_id === currentUser.id) : [];

  // Estatísticas
  const stats = [
    {
      icon: <FiClock className="w-6 h-6" />,
      label: 'Pendentes',
      value: pending.length,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      icon: <FiTrendingUp className="w-6 h-6" />,
      label: isManager ? 'Aguardando Minha Revisão' : 'Aguardando Gerente',
      value: isManager ? myPendingReviews.length : awaitingManager.length,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      icon: <FiCheckCircle className="w-6 h-6" />,
      label: 'Concluídas',
      value: completed.length,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      icon: <FiAlertCircle className="w-6 h-6" />,
      label: 'Requer Ação',
      value: needsAction.length,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  ];

  return (
    <MainLayout>
      <WelcomeModal 
        isOpen={showWelcome} 
        onClose={() => setShowWelcome(false)} 
        userRole={isManager ? "manager" : "collaborator"}
      />

      <div className="w-full px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 mb-8"
        >
          {/* Botão Voltar */}
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors w-fit"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span className="font-medium">Voltar ao Dashboard</span>
          </Link>

          {/* Título */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {isManager ? 'Avaliações da Equipe' : 'Avaliações de Desempenho'}
            </h1>
            <p className="text-gray-600">
              {isManager 
                ? 'Gerencie e acompanhe as avaliações dos seus colaboradores'
                : 'Acompanhe seu desenvolvimento e evolução profissional'
              }
            </p>
          </div>
        </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-xl p-6 border-2 ${stat.borderColor} shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Seção de Períodos Disponíveis */}
          {(activePeriods.length > 0 || upcomingPeriods.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              {/* Períodos Ativos */}
              {activePeriods.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FiCalendar className="text-green-600" />
                    Períodos Ativos - Preencha Sua Avaliação
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Estes períodos de avaliação estão ativos agora. Clique para iniciar ou continuar sua autoavaliação.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activePeriods.filter(item => item?.period?.id).map((item, index) => (
                      <ActivePeriodCard
                        key={item.period.id}
                        period={item.period}
                        existingEvaluationId={item.existingEvaluationId}
                        index={index}
                        type="active"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Períodos Próximos */}
              {upcomingPeriods.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FiClock className="text-blue-600" />
                    Próximos Períodos
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Estes períodos iniciarão em breve. Fique atento às datas!
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingPeriods.filter(item => item?.period?.id).map((item, index) => (
                      <ActivePeriodCard
                        key={item.period.id}
                        period={item.period}
                        existingEvaluationId={item.existingEvaluationId}
                        index={index}
                        type="upcoming"
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Filtros */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-md mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por funcionário..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
              >
                <option value="">Todos os Períodos</option>
                {initialPeriods.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </motion.div>

          {/* Avaliações Pendentes de Revisão do Gerente - DESTAQUE */}
          {isManager && myPendingReviews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 mb-4 text-white">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <FiTrendingUp className="w-7 h-7" />
                  Avaliações Aguardando Sua Revisão
                </h2>
                <p className="text-blue-100">
                  Você tem {myPendingReviews.length} avaliação(ões) aguardando sua aprovação
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myPendingReviews.map((ev, index) => (
                  <EvaluationCard
                    key={ev.id}
                    evaluation={ev}
                    employeeName={getEmployeeName(ev.funcionario_id)}
                    managerName={getManagerName(ev.avaliador_id)}
                    periodName={getPeriodName(ev.periodo_id)}
                    index={index}
                    isManagerView={isManager}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Avaliações Pendentes */}
          {pending.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiClock className="text-yellow-600" />
                Pendentes de Resposta
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pending.map((ev, index) => (
                  <EvaluationCard
                    key={ev.id}
                    evaluation={ev}
                    employeeName={getEmployeeName(ev.funcionario_id)}
                    managerName={getManagerName(ev.avaliador_id)}
                    periodName={getPeriodName(ev.periodo_id)}
                    index={index}
                    isManagerView={isManager}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Aguardando Gerente */}
          {awaitingManager.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiTrendingUp className="text-blue-600" />
                Aguardando Gerente
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {awaitingManager.map((ev, index) => (
                  <EvaluationCard
                    key={ev.id}
                    evaluation={ev}
                    employeeName={getEmployeeName(ev.funcionario_id)}
                    managerName={getManagerName(ev.avaliador_id)}
                    periodName={getPeriodName(ev.periodo_id)}
                    index={index}
                    isManagerView={isManager}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Concluídas */}
          {completed.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiCheckCircle className="text-green-600" />
                Concluídas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completed.map((ev, index) => (
                  <EvaluationCard
                    key={ev.id}
                    evaluation={ev}
                    employeeName={getEmployeeName(ev.funcionario_id)}
                    managerName={getManagerName(ev.avaliador_id)}
                    periodName={getPeriodName(ev.periodo_id)}
                    index={index}
                    isManagerView={isManager}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {filteredEvaluations.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FiCheckCircle className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Nenhuma avaliação encontrada
                </h3>
                <p className="text-gray-600 mb-6">
                  Não há avaliações correspondentes aos filtros selecionados
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedPeriod('');
                  }}
                  className="abz-button-secondary"
                >
                  Limpar Filtros
                </button>
              </div>
            </motion.div>
          )}
      </div>
    </MainLayout>
  );
}
