'use client';

import React from 'react';
import { FiAnchor, FiCalendar, FiMapPin, FiClock, FiArrowRight, FiMessageSquare } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';

interface Embarkation {
  id: string;
  embarcacao_nome?: string;
  // API returns embarcacao as nested object from JOIN
  embarcacao?: { nome?: string } | null;
  tipo: string;
  data_embarque: string;
  data_desembarque: string;
  data_prevista_desembarque: string;
  local_embarque: string;
  local_desembarque: string;
  voo_ida: string;
  voo_volta: string;
  observacoes: string;
  substituindo_id: string;
}

interface Props {
  embarques: Embarkation[];
}

const TIPO_CONFIG: Record<string, { color: string; label: string }> = {
  normal: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Normal' },
  dobra: { color: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Dobra' },
  dba: { color: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Dobra' },
  folga_indenizada: { color: 'bg-green-100 text-green-700 border-green-300', label: 'Folga Indenizada' },
  fi: { color: 'bg-green-100 text-green-700 border-green-300', label: 'Folga Indenizada' },
  standby: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'StandBy' },
  stb: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'StandBy' },
  offc: { color: 'bg-red-100 text-red-700 border-red-300', label: 'Troca de Turma (OFF-C)' },
  substituicao: { color: 'bg-purple-100 text-purple-700 border-purple-300', label: 'Substituição' },
  treinamento: { color: 'bg-gray-100 text-gray-700 border-gray-300', label: 'Treinamento' },
};

const DOT_COLORS: Record<string, string> = {
  normal: 'bg-blue-500',
  dobra: 'bg-orange-500',
  dba: 'bg-orange-500',
  folga_indenizada: 'bg-green-500',
  fi: 'bg-green-500',
  standby: 'bg-yellow-500',
  stb: 'bg-yellow-500',
  offc: 'bg-red-500',
  substituicao: 'bg-purple-500',
  treinamento: 'bg-gray-500',
};

function durationDays(start: string, end: string | null): string {
  if (!start || !end) return '';
  const d = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return `${d} dias`;
}

export default function HistoricoEmbarquesTab({ embarques }: Props) {
  const { t } = useI18n();

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  if (embarques.length === 0) {
    return (
      <div className="p-12 text-center">
        <FiAnchor className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{t('gestaoTripulantes.embarkations.noHistory')}</p>
      </div>
    );
  }

  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} p-6`}>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6 shrink-0">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{embarques.length}</p>
          <p className="text-xs text-blue-600 mt-1">Total de Escalas</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-700">
            {embarques.filter(e => e.tipo === 'dobra').length}
          </p>
          <p className="text-xs text-orange-600 mt-1">Dobras</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {embarques.filter(e => e.tipo === 'folga_indenizada').length}
          </p>
          <p className="text-xs text-green-600 mt-1">Folgas Indenizadas</p>
        </div>
      </div>

      {/* Timeline */}
      <div className={`${COLLABORATOR_MODAL_TABLE_SCROLL_CLASS} relative pl-6`}>
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-gray-200" />

        {embarques.map((emb, i) => {
          const tipoCfg = TIPO_CONFIG[emb.tipo] || TIPO_CONFIG.normal;
          const dotColor = DOT_COLORS[emb.tipo] || 'bg-gray-500';
          const duration = durationDays(emb.data_embarque, emb.data_desembarque);

          return (
            <div key={emb.id} className={`relative mb-5 ${i === embarques.length - 1 ? '' : ''}`}>
              {/* Dot */}
              <div className={`absolute -left-4 top-3 w-3 h-3 rounded-full ${dotColor} border-2 border-white shadow ring-2 ring-white`} />

              <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow ml-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="font-semibold text-gray-800 text-sm">{emb.embarcacao_nome || (emb.embarcacao as any)?.nome || '—'}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tipoCfg.color}`}>
                        {t(`gestaoTripulantes.embarkations.types.${emb.tipo}`, tipoCfg.label)}
                      </span>
                      {duration && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <FiClock className="w-3 h-3" /> {duration}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3 text-green-500" />
                        <span className="font-medium text-gray-700">{formatDate(emb.data_embarque)}</span>
                      </span>
                      <FiArrowRight className="w-3 h-3 text-gray-300" />
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3 text-red-400" />
                        <span className="font-medium text-gray-700">
                          {formatDate(emb.data_desembarque || emb.data_prevista_desembarque)}
                          {!emb.data_desembarque && emb.data_prevista_desembarque && ' (prev.)'}
                        </span>
                      </span>

                      {emb.local_embarque && (
                        <span className="flex items-center gap-1">
                          <FiMapPin className="w-3 h-3" /> {emb.local_embarque}
                        </span>
                      )}
                    </div>

                    {(emb.voo_ida || emb.voo_volta) && (
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        {emb.voo_ida && <span>✈️ Ida: <span className="font-medium">{emb.voo_ida}</span></span>}
                        {emb.voo_volta && <span>↩️ Volta: <span className="font-medium">{emb.voo_volta}</span></span>}
                      </div>
                    )}

                    {emb.observacoes && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-xs text-slate-700 shadow-2xs">
                        <FiMessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Observação</span>
                          <p className="text-xs text-slate-700 italic leading-relaxed">{emb.observacoes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
