'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import StatusBadge from './StatusBadge';
import { FiCalendar, FiUser, FiClock, FiArrowRight, FiTrash2 } from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface EvaluationCardProps {
  evaluation: {
    id: string;
    funcionario_id: string;
    avaliador_id?: string;
    status: string;
    data_inicio: string;
    data_fim: string;
    pontuacao_total?: number;
    periodo?: string;
  };
  employeeName: string;
  managerName?: string;
  periodName: string;
  cycleName?: string;
  index?: number;
  isManagerView?: boolean;
  currentUserRole?: string; // Role do usuário atual
  onDelete?: () => void; // Callback após exclusão
}

export default function EvaluationCard({
  evaluation,
  employeeName,
  managerName,
  periodName,
  cycleName,
  index = 0,
  isManagerView = false,
  currentUserRole,
  onDelete
}: EvaluationCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const isPending = evaluation.status === 'pendente' || evaluation.status === 'em_andamento';
  const isAwaitingManager = evaluation.status === 'aguardando_aprovacao';
  const isCompleted = evaluation.status === 'concluida';
  
  // Nome a ser exibido depende da visão
  const displayName = isManagerView ? employeeName : (managerName || 'Gestor não atribuído');
  
  const isAdmin = currentUserRole === 'ADMIN';
  
  const handleHardDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const confirmMessage = `⚠️ ATENÇÃO: EXCLUSÃO PERMANENTE \n\n` +
      `Esta ação é IRREVERSÍVEL!\n\n` +
      `A avaliação de "${displayName}" será PERMANENTEMENTE excluída do banco de dados.\n\n` +
      `Todos os dados serão perdidos e NÃO poderão ser recuperados.\n\n` +
      `Deseja realmente continuar?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    // Segunda confirmação
    if (!window.confirm('Última confirmação: Tem certeza ABSOLUTA?')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('abzToken='))?.split('=')[1];
      
      const response = await fetch(`/api/avaliacao-desempenho/avaliacoes/${evaluation.id}/hard-delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir avaliação');
      }
      
      alert('✅ Avaliação excluída permanentemente com sucesso!');
      
      if (onDelete) {
        onDelete();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Erro ao excluir avaliação:', error);
      alert(`❌ Erro ao excluir avaliação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/avaliacao/ver/${evaluation.id}`}>
        <Card
          className={cn(
            'cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
            'border-l-4',
            isPending && 'border-l-yellow-500 hover:border-l-yellow-600',
            isAwaitingManager && 'border-l-blue-500 hover:border-l-blue-600',
            isCompleted && 'border-l-green-500 hover:border-l-green-600',
            !isPending && !isAwaitingManager && !isCompleted && 'border-l-gray-300'
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start gap-3">
              {isAdmin && (
                <button
                  onClick={handleHardDelete}
                  disabled={isDeleting}
                  className="absolute top-2 right-2 z-10 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Excluir permanentemente (ADMIN)"
                >
                  <FiTrash2 size={16} />
                </button>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900 mb-1 flex items-center gap-2">
                  <FiUser className="text-abz-blue" />
                  {displayName}
                </h3>
                <div className="space-y-0.5">
                  {cycleName && (
                    <p className="text-sm font-medium text-abz-blue">
                      {cycleName}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    {periodName}
                    {isManagerView && <span className="ml-2 text-xs text-gray-500">• Colaborador</span>}
                    {!isManagerView && <span className="ml-2 text-xs text-gray-500">• Seu Gestor</span>}
                  </p>
                </div>
              </div>
              <StatusBadge status={evaluation.status} />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <FiCalendar className="text-gray-400" size={14} />
                <span>
                  {format(new Date(evaluation.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-1.5">
                <FiClock className="text-gray-400" size={14} />
                <span>
                  {format(new Date(evaluation.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            </div>

            {evaluation.pontuacao_total !== undefined && evaluation.pontuacao_total > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium text-gray-700">Pontuação</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={cn(
                          'w-4 h-4',
                          star <= evaluation.pontuacao_total!
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {evaluation.pontuacao_total.toFixed(1)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-gray-600">
                {evaluation.status === 'pendente' && 'Aguardando preenchimento'}
                {evaluation.status === 'em_andamento' && 'Em andamento'}
                {evaluation.status === 'aguardando_aprovacao' && 'Aguardando aprovação'}
                {evaluation.status === 'concluida' && 'Concluída'}
                {evaluation.status === 'devolvida' && 'Devolvida para ajustes'}
              </span>
              <div className="flex items-center text-abz-blue hover:text-abz-blue-dark transition-colors">
                <span className="text-sm font-medium">Ver detalhes</span>
                <FiArrowRight className="ml-1" size={16} />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
