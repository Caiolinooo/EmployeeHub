'use client';

import React from 'react';
import { FiRepeat, FiCalendar, FiArrowRight, FiUser } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';

interface Substitution {
  id: string;
  substituto_nome?: string;
  substituido_nome?: string;
  // API may return nested objects from FK joins
  substituto?: { nome_completo?: string } | null;
  substituido?: { nome_completo?: string } | null;
  periodo_inicio: string;
  periodo_fim: string;
  cargo_nome?: string;
  embarcacao_nome?: string;
}

interface Props {
  colaboradorId: string;
  substituicoes: Substitution[];
}

export default function SubstituicoesTab({ colaboradorId, substituicoes }: Props) {
  const { t } = useI18n();

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const resolveName = (sub: Substitution, role: 'substituto' | 'substituido') => {
    if (role === 'substituto') {
      return sub.substituto_nome || (sub.substituto as any)?.nome_completo || '—';
    }
    return sub.substituido_nome || (sub.substituido as any)?.nome_completo || '—';
  };

  if (substituicoes.length === 0) {
    return (
      <div className="p-12 text-center">
        <FiRepeat className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{t('gestaoTripulantes.substitutions.noSubstitutions')}</p>
      </div>
    );
  }

  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} p-6 space-y-6`}>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-700">{substituicoes.length}</p>
          <p className="text-xs text-purple-600 mt-1">Total de Substituições</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {new Set(substituicoes.map(s => s.substituto_nome || s.substituido_nome)).size}
          </p>
          <p className="text-xs text-blue-600 mt-1">Colaboradores Envolvidos</p>
        </div>
      </div>

      {/* List */}
      <div className={`${COLLABORATOR_MODAL_TABLE_SCROLL_CLASS} space-y-3`}>
        {substituicoes.map(sub => (
          <div key={sub.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow bg-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <FiRepeat className="w-4 h-4 text-purple-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <div className="flex items-center gap-1.5">
                    <FiUser className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-semibold text-gray-800">{resolveName(sub, 'substituto')}</span>
                  </div>
                  <FiArrowRight className="w-3.5 h-3.5 text-gray-300" />
                  <div className="flex items-center gap-1.5">
                    <FiUser className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-600">{resolveName(sub, 'substituido')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400 flex-wrap">
                  {sub.cargo_nome && <span className="font-medium text-gray-500">{sub.cargo_nome}</span>}
                  {sub.embarcacao_nome && <span>• {sub.embarcacao_nome}</span>}
                  <span className="flex items-center gap-1">
                    <FiCalendar className="w-3 h-3" />
                    {formatDate(sub.periodo_inicio)}
                    {sub.periodo_fim && <><FiArrowRight className="w-3 h-3 mx-1" />{formatDate(sub.periodo_fim)}</>}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
