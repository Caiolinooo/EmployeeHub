'use client';

import React from 'react';
import { FiUsers, FiAnchor, FiUserCheck, FiAlertTriangle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import type { GtDashboardKpi } from '@/lib/gestao-tripulantes/embarque-status';

interface DashboardData {
  total_colaboradores: number;
  total_embarcados: number;
  total_disponiveis: number;
  total_docs_vencidos: number;
  total_docs_vencendo: number;
  total_docs_vencidos_historico?: number;
  asos_pendentes_revisao: number;
}

interface DashboardCardsProps {
  data: DashboardData | null;
  activeKpi?: GtDashboardKpi | '';
  onKpiClick?: (kpi: GtDashboardKpi) => void;
}

function Skeleton() {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-5 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-3 w-16 sm:w-24 bg-gray-200 rounded mb-2 sm:mb-3" />
      <div className="h-6 sm:h-7 w-12 sm:w-16 bg-gray-200 rounded" />
    </div>
  );
}

export default function DashboardCards({ data, activeKpi = '', onKpiClick }: DashboardCardsProps) {
  const { t } = useI18n();

  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} />)}
      </div>
    );
  }

  const docsHint = (data.total_docs_vencidos_historico || 0) > 0
    ? `${data.total_docs_vencidos_historico} histórico(s) não entram no KPI`
    : t('gestaoTripulantes.dashboard.kpiHintDocs', 'Clique para listar quem tem documentos vencidos');

  const cards: {
    kpi: GtDashboardKpi;
    label: string;
    hint: string;
    value: number;
    icon: typeof FiUsers;
    textColor: string;
    bgColor: string;
  }[] = [
    {
      kpi: 'colaboradores',
      label: t('gestaoTripulantes.dashboard.totalCollaborators'),
      hint: t('gestaoTripulantes.dashboard.kpiHintTotal', 'Clique para listar todos os tripulantes ativos'),
      value: data.total_colaboradores,
      icon: FiUsers,
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      kpi: 'embarcados',
      label: t('gestaoTripulantes.dashboard.onboardNow'),
      hint: t('gestaoTripulantes.dashboard.kpiHintEmbarcados', 'Clique para listar quem está ON hoje (sem ON* / *)'),
      value: data.total_embarcados,
      icon: FiAnchor,
      textColor: 'text-green-500',
      bgColor: 'bg-green-50'
    },
    {
      kpi: 'disponiveis',
      label: t('gestaoTripulantes.dashboard.availableBackup'),
      hint: t('gestaoTripulantes.dashboard.kpiHintDisponiveis', 'Clique para listar disponíveis para back'),
      value: data.total_disponiveis,
      icon: FiUserCheck,
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-50'
    },
    {
      kpi: 'docs_vencidos',
      label: t('gestaoTripulantes.dashboard.expiredDocs'),
      hint: docsHint,
      value: data.total_docs_vencidos,
      icon: FiAlertTriangle,
      textColor: 'text-red-500',
      bgColor: 'bg-red-50',
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {cards.map((card) => {
        const active = activeKpi === card.kpi;
        return (
          <button
            key={card.kpi}
            type="button"
            onClick={() => onKpiClick?.(card.kpi)}
            title={card.hint}
            aria-pressed={active}
            className={`bg-white rounded-xl p-3 sm:p-5 shadow-sm border flex items-center justify-between text-left cursor-pointer transition-all hover:shadow-md hover:border-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'
            }`}
          >
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-gray-500 text-xs sm:text-sm font-medium truncate">{card.label}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-0.5 sm:mt-1">{card.value}</p>
              <p className="hidden sm:block text-[11px] text-blue-600 mt-1 font-medium truncate">
                {active
                  ? t('gestaoTripulantes.dashboard.kpiActive', 'Filtro ativo — clique para limpar')
                  : card.hint}
              </p>
            </div>
            <div className={`p-2 sm:p-3 rounded-xl sm:rounded-full shrink-0 ${card.bgColor} ${card.textColor}`}>
              <card.icon className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
