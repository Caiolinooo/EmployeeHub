'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { cn } from '@/lib/utils';
import { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';

interface Collaborator {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  matricula: string;
  foto_url: string;
  cargo_nome: string;
  empresa_nome: string;
  embarcacao_nome: string;
  centro_custo_nome: string;
  status_embarque: string;
  standby: boolean;
  data_proximo_embarque: string;
  qtd_docs_vencidos: number;
  qtd_docs_vencendo: number;
  qtd_docs_validos: number;
  docs_vencidos_resumo?: { titulo: string; tipo_documento: string; data_validade: string; aba: string }[];
}

interface GTMatrixProps {
  colaboradores: Collaborator[];
  loading: boolean;
  onRowClick: (colaborador: Collaborator) => void;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  embarcado: 'bg-green-100 text-green-700 border-green-300',
  standby: 'bg-orange-100 text-orange-700 border-orange-300',
  folga: 'bg-blue-100 text-blue-700 border-blue-300',
  desembarcado: 'bg-gray-100 text-gray-600 border-gray-300',
  afastado: 'bg-red-100 text-red-700 border-red-300',
  ferias: 'bg-purple-100 text-purple-700 border-purple-300',
  treinamento: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  embarcado: 'gestaoTripulantes.status.embarcado',
  standby: 'gestaoTripulantes.status.standby',
  folga: 'gestaoTripulantes.status.folga',
  desembarcado: 'gestaoTripulantes.status.desembarcado',
  afastado: 'gestaoTripulantes.status.afastado',
  ferias: 'gestaoTripulantes.status.ferias',
  treinamento: 'gestaoTripulantes.status.treinamento',
};

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3"><div className="w-9 h-9 bg-gray-200 rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-36" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
        </tr>
      ))}
    </>
  );
}

export default function GTMatrix({ colaboradores, loading, onRowClick, className }: GTMatrixProps) {
  const { t } = useI18n();

  const getStatusBadge = (status: string, standby: boolean) => {
    const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600 border-gray-300';
    const label = t(STATUS_LABEL_KEYS[status] || status);
    const showStandby = standby && status !== 'standby' && status !== 'embarcado';
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>
        {showStandby ? `${label} (SB)` : label}
      </span>
    );
  };

  const formatCivil = (iso?: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  const getDocIndicator = (col: Collaborator) => {
    if (col.qtd_docs_vencidos > 0) {
      const first = col.docs_vencidos_resumo?.[0];
      return (
        <div className="text-red-600 text-xs">
          <span className="font-semibold">
            {col.qtd_docs_vencidos} {t('gestaoTripulantes.documentStatus.expired', { days: col.qtd_docs_vencidos })}
          </span>
          {first && (
            <p className="text-[11px] font-medium text-red-700/80 mt-0.5 max-w-[14rem] truncate" title={`${first.titulo} · ${first.tipo_documento}`}>
              {first.titulo} · {first.tipo_documento}
              {first.data_validade ? ` · ${formatCivil(first.data_validade)}` : ''}
            </p>
          )}
        </div>
      );
    }
    if (col.qtd_docs_vencendo > 0) {
      return <span className="text-orange-500 font-semibold text-xs">{col.qtd_docs_vencendo} {t('gestaoTripulantes.documentStatus.expiring', { days: col.qtd_docs_vencendo })}</span>;
    }
    return <span className="text-green-600 text-xs">{t('gestaoTripulantes.documentStatus.valid')}</span>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    // DATE columns chegam como YYYY-MM-DD; new Date() interpreta como UTC e
    // retrocede um dia no fuso BRT. Parse civil mantém o dia exato.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr).trim());
    if (!m) return dateStr;
    return `${m[3].slice(0, 2).padStart(2, '0')}/${m[2]}/${m[1]}`;
  };

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0 min-w-0 overflow-hidden', className)}>
      <div className={GT_PAGE_SCROLLPORT_CLASS}>
        <table className="w-full min-w-[760px] text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-12">{t('gestaoTripulantes.table.photo')}</th>
              <th className="px-4 py-3">{t('gestaoTripulantes.table.name')}</th>
              <th className="px-4 py-3">{t('gestaoTripulantes.table.rank')}</th>
              <th className="px-4 py-3">{t('gestaoTripulantes.table.company')}</th>
              <th className="px-4 py-3">{t('gestaoTripulantes.table.vessel')}</th>
              <th className="px-4 py-3">{t('gestaoTripulantes.table.status')}</th>
              <th className="px-4 py-3">{t('gestaoTripulantes.table.documents')}</th>
              <th className="px-4 py-3">{t('gestaoTripulantes.table.nextEmbark')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <SkeletonRows />
            ) : colaboradores.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {t('gestaoTripulantes.common.noResults')}
                </td>
              </tr>
            ) : (
              colaboradores.map(col => (
                <tr
                  key={col.id}
                  className="hover:bg-blue-50 transition-colors cursor-pointer"
                  onClick={() => onRowClick(col)}
                >
                  <td className="px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {col.foto_url ? (
                        <img src={col.foto_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                          {col.nome_completo?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    <div>{col.nome_completo}</div>
                    <div className="text-xs text-gray-400">{col.matricula || col.cpf || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{col.cargo_nome || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{col.empresa_nome || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{col.embarcacao_nome || '-'}</td>
                  <td className="px-4 py-3">{getStatusBadge(col.status_embarque, col.standby)}</td>
                  <td className="px-4 py-3">{getDocIndicator(col)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(col.data_proximo_embarque)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
