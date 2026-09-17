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
  /** R5: coluna de seleção para o fechamento (desktop). Visível só para quem pode marcar. */
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string) => void;
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

/**
 * R9: tabela em `border-separate` (obrigatório para sticky em células no Chrome —
 * mesmo modelo do Man Schedule). Colunas de bordas em cada th/td porque `divide-y`
 * em `tr` não pinta com border-separate.
 */
const TH_CLASS = 'px-4 py-3 bg-gray-50 border-b border-gray-200';
const TD_CLASS = 'px-4 py-3 border-b border-gray-100';
/** Coluna NOME: sticky left-0 no mobile (<lg), sombra na borda direita como o Man Schedule. */
const STICKY_NAME_TD_CLASS = `${TD_CLASS} sticky left-0 top-auto z-20 bg-white group-hover:bg-blue-50 shadow-[4px_0_8px_-2px_rgba(15,23,42,0.16)] lg:static lg:z-auto lg:shadow-none`;
const STICKY_NAME_TH_CLASS = `${TH_CLASS} sticky left-0 top-0 z-40 shadow-[4px_0_8px_-2px_rgba(15,23,42,0.16)] lg:static lg:z-auto lg:shadow-none`;
const CHECK_CELL_CLASS = 'hidden lg:table-cell px-3 border-b border-gray-100';
const CHECK_TH_CLASS = 'hidden lg:table-cell px-3 py-3 w-10 bg-gray-50 border-b border-gray-200';
const PHOTO_CELL_CLASS = 'hidden lg:table-cell px-4 py-3 border-b border-gray-100';

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className={TD_CLASS}>
              <div className={j === 0 ? 'w-9 h-9 bg-gray-200 rounded-full' : 'h-4 w-24 bg-gray-200 rounded'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function GTMatrix({
  colaboradores,
  loading,
  onRowClick,
  className,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: GTMatrixProps) {
  const { t } = useI18n();

  const totalCols = 8 + (selectable ? 1 : 0);

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
        <table className="w-full min-w-[760px] text-sm text-left border-separate border-spacing-0">
          <thead className="text-xs text-gray-500 uppercase sticky top-0 z-30">
            <tr>
              {selectable && (
                <th className={CHECK_TH_CLASS}>
                  <span className="sr-only">{t('gtMatrizV2.marcados.coluna')}</span>
                </th>
              )}
              <th className={cn(TH_CLASS, 'w-12 hidden lg:table-cell')}>{t('gestaoTripulantes.table.photo')}</th>
              <th className={STICKY_NAME_TH_CLASS}>{t('gestaoTripulantes.table.name')}</th>
              <th className={TH_CLASS}>{t('gestaoTripulantes.table.rank')}</th>
              <th className={TH_CLASS}>{t('gestaoTripulantes.table.company')}</th>
              <th className={TH_CLASS}>{t('gestaoTripulantes.table.vessel')}</th>
              <th className={TH_CLASS}>{t('gestaoTripulantes.table.status')}</th>
              <th className={TH_CLASS}>{t('gestaoTripulantes.table.documents')}</th>
              <th className={TH_CLASS}>{t('gestaoTripulantes.table.nextEmbark')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={totalCols} />
            ) : colaboradores.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-8 text-center text-gray-400">
                  {t('gestaoTripulantes.common.noResults')}
                </td>
              </tr>
            ) : (
              colaboradores.map(col => {
                const selecionado = selectedIds?.has(col.id) ?? false;
                return (
                  <tr
                    key={col.id}
                    className="group hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => onRowClick(col)}
                  >
                    {selectable && (
                      <td
                        className={CHECK_CELL_CLASS}
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={selecionado}
                          onChange={() => onToggleSelect?.(col.id)}
                          onClick={e => e.stopPropagation()}
                          aria-label={col.nome_completo}
                        />
                      </td>
                    )}
                    <td className={cn(PHOTO_CELL_CLASS, 'w-12')}>
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
                    <td className={cn(STICKY_NAME_TD_CLASS, 'font-medium text-gray-900 whitespace-nowrap w-[220px] min-w-[220px] max-w-[220px]')}>
                      <div className="truncate" title={col.nome_completo}>{col.nome_completo}</div>
                      <div className="text-xs text-gray-400 truncate">{col.matricula || col.cpf || ''}</div>
                    </td>
                    <td className={cn(TD_CLASS, 'text-gray-600 whitespace-nowrap')}>{col.cargo_nome || '-'}</td>
                    <td className={cn(TD_CLASS, 'text-gray-600 whitespace-nowrap')}>{col.empresa_nome || '-'}</td>
                    <td className={cn(TD_CLASS, 'text-gray-600 whitespace-nowrap')}>{col.embarcacao_nome || '-'}</td>
                    <td className={TD_CLASS}>{getStatusBadge(col.status_embarque, col.standby)}</td>
                    <td className={TD_CLASS}>{getDocIndicator(col)}</td>
                    <td className={cn(TD_CLASS, 'text-gray-600 whitespace-nowrap')}>{formatDate(col.data_proximo_embarque)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
