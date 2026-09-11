'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { cn } from '@/lib/utils';

const LEGEND_ITEMS = [
  { color: 'bg-green-500', border: 'border-green-500', labelKey: 'gestaoTripulantes.legend.onboard' },
  { color: 'bg-orange-500', border: 'border-orange-500', labelKey: 'gestaoTripulantes.legend.standby' },
  { color: 'bg-blue-500', border: 'border-blue-500', labelKey: 'gestaoTripulantes.legend.off' },
  { color: 'bg-red-500', border: 'border-red-500', labelKey: 'gestaoTripulantes.legend.onLeave' },
];

export default function GTMatrixLegend({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <div className={cn('flex items-center gap-4 text-xs px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100 shrink-0', className)}>
      <span className="text-gray-500 font-medium mr-1">{t('gestaoTripulantes.status.embarcado')}:</span>
      {LEGEND_ITEMS.map(item => (
        <div key={item.labelKey} className="flex items-center gap-1.5">
          <span className={`inline-block w-3 h-3 rounded-full ${item.color}`} />
          <span className="text-gray-700">{t(item.labelKey)}</span>
        </div>
      ))}
    </div>
  );
}
