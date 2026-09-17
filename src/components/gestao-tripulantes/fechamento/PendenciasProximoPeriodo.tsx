'use client';

import React from 'react';
import { FiAlertOctagon, FiArrowRightCircle, FiClock, FiRefreshCw, FiTrendingUp } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { formatarDataBR, type PendenciasPayload } from './fechamentoV2';

interface PendenciasProximoPeriodoProps {
  pendencias?: PendenciasPayload | null;
  isLoading?: boolean;
}

/**
 * R4: pendências do próximo período (recorte do FI por data_fim).
 * FI pendente = déficit da parte da folga que cai fora do período;
 * DBA pendente = dias de DBA além do corte (vão reduzir a folga do próximo período);
 * folga aberta = informativo (não gera FI — regra do dono).
 */
export default function PendenciasProximoPeriodo({
  pendencias,
  isLoading,
}: PendenciasProximoPeriodoProps) {
  const { t } = useI18n();

  const porColaborador = pendencias?.porColaborador || [];
  const comPendencia = porColaborador.filter(
    (p) => p.fiDeficitPendente > 0 || (p.dbaDiasPendentes?.length || 0) > 0,
  );
  const totaisFi = Number(pendencias?.totais?.fi ?? 0);
  const totaisDba = Number(pendencias?.totais?.dba ?? 0);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        <FiRefreshCw className="mr-1.5 inline w-3.5 h-3.5 animate-spin text-abz-blue" />
        {t('gtFechV2.pendencias.carregando', 'Calculando pendências do próximo período…')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-900">
          <FiTrendingUp className="text-orange-500" />
          {t('gtFechV2.pendencias.titulo', 'Pendências do Próximo Período')}
        </h4>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {t(
            'gtFechV2.pendencias.descricao',
            'Folga que atravessa o fim do período: o déficit de FI e os dias de DBA além do corte aparecem como pendência do próximo fechamento (soma aditiva entre períodos).',
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <span className="block text-[10px] font-bold uppercase text-blue-700">
            {t('gtFechV2.pendencias.fiPendente', 'FI pendente')}
          </span>
          <span className="text-xl font-black text-blue-900">
            {totaisFi}{' '}
            <span className="text-xs font-normal">{t('gtFechV2.pendencias.dias', 'dias')}</span>
          </span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <span className="block text-[10px] font-bold uppercase text-amber-700">
            {t('gtFechV2.pendencias.dbaPendente', 'DBA pendente')}
          </span>
          <span className="text-xl font-black text-amber-900">
            {totaisDba}{' '}
            <span className="text-xs font-normal">{t('gtFechV2.pendencias.dias', 'dias')}</span>
          </span>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <span className="block text-[10px] font-bold uppercase text-orange-700">
            {t('gtFechV2.pendencias.comPendencia', 'Tripulantes com pendência')}
          </span>
          <span className="text-xl font-black text-orange-900">{comPendencia.length}</span>
        </div>
      </div>

      {porColaborador.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3 text-center text-xs text-gray-500">
          {t(
            'gtFechV2.pendencias.semPendencias',
            'Nenhuma pendência apurada para este período.',
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-xs">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2 font-bold">{t('gtFechV2.fila.colaborador', 'Tripulante')}</th>
                <th className="px-3 py-2 text-center font-bold">
                  {t('gtFechV2.pendencias.fiPendente', 'FI pendente')}
                </th>
                <th className="px-3 py-2 font-bold">
                  {t('gtFechV2.pendencias.dbaDias', 'DBA além do corte')}
                </th>
                <th className="px-3 py-2 font-bold">
                  {t('gtFechV2.pendencias.proximoEmbarque', 'Próximo embarque')}
                </th>
                <th className="px-3 py-2 font-bold">
                  {t('gtFechV2.pendencias.folgaAberta', 'Folga aberta')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {porColaborador.map((p, idx) => {
                const temPendencia =
                  p.fiDeficitPendente > 0 || (p.dbaDiasPendentes?.length || 0) > 0;
                return (
                  <tr key={p.colaboradorId || idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-900">{p.nome}</td>
                    <td
                      className={`px-3 py-2 text-center font-bold ${
                        p.fiDeficitPendente > 0 ? 'text-blue-700' : 'text-gray-400'
                      }`}
                    >
                      {p.fiDeficitPendente || 0}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {(p.dbaDiasPendentes?.length || 0) > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(p.dbaDiasPendentes || []).map((d) => (
                            <span
                              key={d}
                              className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-900"
                            >
                              {formatarDataBR(d, { anoCurto: true })}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {p.proximoEmbarque ? (
                        <span className="inline-flex items-center gap-1">
                          <FiArrowRightCircle className="h-3 w-3 text-gray-400" />
                          {formatarDataBR(p.proximoEmbarque)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.folgaAberta ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800"
                          title={t(
                            'gtFechV2.pendencias.folgaAbertaHint',
                            'Folga sem próximo embarque: informativo — não gera FI (regra do dono).',
                          )}
                        >
                          <FiClock className="h-3 w-3" />
                          {t('gtFechV2.pendencias.folgaAberta', 'Folga aberta')}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {comPendencia.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-[11px] text-orange-900">
          <FiAlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {t(
              'gtFechV2.pendencias.notaAditiva',
              'Pendências são aditivas entre períodos: entram no fechamento do próximo ciclo sem debitar o mês atual.',
            )}
          </span>
        </div>
      )}
    </div>
  );
}
