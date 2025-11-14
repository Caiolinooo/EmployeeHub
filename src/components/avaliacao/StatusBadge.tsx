'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig = {
  // Status atuais
  pendente: {
    label: 'Pendente',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '⏳'
  },
  em_andamento: {
    label: 'Em Andamento',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '✏️'
  },
  aguardando_aprovacao: {
    label: 'Aguardando Aprovação',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '👀'
  },
  concluida: {
    label: 'Concluída',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: '✅'
  },
  devolvida: {
    label: 'Devolvida',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '🔄'
  },
  cancelada: {
    label: 'Cancelada',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '❌'
  },
  // Status legados para compatibilidade
  pendente_autoavaliacao: {
    label: 'Pendente de Resposta',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '⏳'
  },
  pendente_aprovacao_gerente: {
    label: 'Aguardando Gerente',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '👀'
  },
  pending_response: {
    label: 'Pendente de Resposta',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '⏳'
  },
  awaiting_manager: {
    label: 'Aguardando Gerente',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '👀'
  },
  approved: {
    label: 'Aprovado',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: '✅'
  }
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pendente_autoavaliacao;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
        config.color,
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
