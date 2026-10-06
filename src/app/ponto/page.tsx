'use client';

import React, { useCallback, useEffect, useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { useI18n } from '@/contexts/I18nContext';
import { getToken } from '@/lib/tokenStorage';
import {
  FiClock,
  FiExternalLink,
  FiAlertCircle,
  FiCheckCircle,
} from 'react-icons/fi';

interface PontoStatus {
  habilitado: boolean;
  motivo: string | null;
  syncStatus: string;
  resumo: {
    period_start: string;
    period_end: string;
    status: string;
    worked_days: number | null;
    worked_minutes: number | null;
    updated_at: string;
  } | null;
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale);
}

export default function PontoPage() {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PontoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const authHeaders = useCallback((): HeadersInit => {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/pontoflow/sso', { headers: authHeaders() });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error || t('ponto.timesheet.loadError', 'Falha ao carregar status do Time Sheet'));
        }
        setStatus(json.data as PontoStatus);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('ponto.timesheet.loadError', 'Falha ao carregar status do Time Sheet'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, t]);

  const openTimeSheet = async () => {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch('/api/pontoflow/sso', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || t('ponto.timesheet.openError', 'Não foi possível abrir o Time Sheet'));
      }
      window.open(json.data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ponto.timesheet.openError', 'Não foi possível abrir o Time Sheet'));
    } finally {
      setOpening(false);
    }
  };

  const resumo = status?.resumo || null;
  const workedHours =
    resumo && typeof resumo.worked_minutes === 'number'
      ? (resumo.worked_minutes / 60).toFixed(1)
      : null;

  return (
    <MainLayout>
      <h1 className="text-3xl font-extrabold text-abz-blue-dark mb-6">{t('ponto.pageTitle')}</h1>

      <div className="bg-white p-8 rounded-lg shadow-md space-y-6">
        <div className="prose prose-sm max-w-none text-abz-text-dark">
          <h2 className="text-xl font-semibold text-abz-text-black mb-3 flex items-center">
            <FiClock className="mr-2 text-abz-blue" />
            {t('ponto.timesheet.title', 'Time Sheet')}
          </h2>
          <p>
            {t(
              'ponto.timesheet.description',
              'Registre seu ponto no Time Sheet. O acesso é feito diretamente pelo portal, sem senha adicional.',
            )}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">{t('ponto.timesheet.loading', 'Carregando…')}</p>
        ) : error && !status ? (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-4 text-sm text-red-800">
            <FiAlertCircle className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : status?.habilitado ? (
          <>
            <div>
              <button
                type="button"
                onClick={openTimeSheet}
                disabled={opening}
                className="inline-flex items-center px-6 py-3 bg-abz-blue text-white rounded-lg font-semibold hover:bg-abz-blue-dark transition duration-200 shadow-md text-sm disabled:opacity-50"
              >
                <FiExternalLink className="mr-2" />
                {opening
                  ? t('ponto.timesheet.opening', 'Abrindo…')
                  : t('ponto.timesheet.open', 'Abrir Time Sheet')}
              </button>
              {error && (
                <p className="mt-3 flex items-center gap-2 text-sm text-red-700">
                  <FiAlertCircle /> {error}
                </p>
              )}
              {(status.syncStatus === 'pending' || status.syncStatus === 'error') && (
                <p className="mt-3 text-xs text-gray-500">
                  {status.syncStatus === 'pending'
                    ? t('ponto.timesheet.syncPending', 'Seu cadastro está sendo sincronizado; se o acesso falhar, tente novamente em instantes.')
                    : t('ponto.timesheet.syncError', 'Há uma pendência na sincronização do seu cadastro. Avise o DP se o acesso falhar.')}
                </p>
              )}
            </div>

            {resumo && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-abz-text-black mb-3">
                  {t('ponto.timesheet.summaryTitle', 'Resumo do período')}
                </h3>
                <div className="rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">
                      {t('ponto.timesheet.period', 'Período')}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDate(resumo.period_start, locale)} – {formatDate(resumo.period_end, locale)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      {t('ponto.timesheet.status', 'Status')}
                    </div>
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                      {resumo.status === 'aprovado' && <FiCheckCircle className="text-green-600" />}
                      {resumo.status}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      {t('ponto.timesheet.workedDays', 'Dias trabalhados')}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {resumo.worked_days ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      {t('ponto.timesheet.workedHours', 'Horas trabalhadas')}
                    </div>
                    <div className="text-sm font-medium text-gray-900">{workedHours ?? '—'}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-md bg-yellow-50 p-4 text-sm text-yellow-900">
            <FiAlertCircle className="mt-0.5 shrink-0" />
            <span>
              {t(
                'ponto.timesheet.notEnabled',
                'Seu cadastro não está habilitado para Time Sheet. Procure o DP para ativar a opção "Contabilizar no Time Sheet".',
              )}
            </span>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
