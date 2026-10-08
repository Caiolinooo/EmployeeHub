'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication } from '@simplewebauthn/browser';
import MainLayout from '@/components/Layout/MainLayout';
import { useI18n } from '@/contexts/I18nContext';
import {
  acoesExpediente,
  faseExpediente,
  formatarMinutos,
  normalizarHoje,
  preferirRelogios,
  resumoHoje,
  type HojePonto,
} from '@/lib/timesheet-integration/jornada';
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
  vinculo?: {
    login: boolean;
    ponto: boolean;
    folha: boolean;
    empresa: boolean;
  };
  resumo: {
    period_start: string;
    period_end: string;
    status: string;
    worked_days: number | null;
    worked_minutes: number | null;
    folha_status?: string | null;
    folha_motivo?: string | null;
    updated_at: string;
  } | null;
}

function lerHoje(data: unknown): HojePonto | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (typeof row.date !== 'string') return null;
  return normalizarHoje({
    date: row.date,
    open: row.open === true,
    horaIni: typeof row.horaIni === 'string' ? row.horaIni : null,
    horaFim: typeof row.horaFim === 'string' ? row.horaFim : null,
  });
}

const MOTIVO_LABEL: Record<string, string> = {
  sem_colaborador: 'Colaborador não encontrado para este usuário. O DP precisa ligar seu login ao cadastro.',
  ambiguo: 'Mais de um cadastro corresponde a este usuário. O DP precisa unificar.',
  sem_user: 'Seu login ainda não está ligado ao cadastro do colaborador.',
  flag_inativa: 'Seu cadastro não está habilitado para Time Sheet. Procure o DP para ativar "Contabilizar no Time Sheet".',
  sem_empresa: 'A empresa do cadastro ainda não tem tenant do Time Sheet.',
  sem_people_map: 'Seu cadastro está sendo sincronizado com o Time Sheet. Tente de novo em instantes.',
  sem_folha: 'Seu cadastro ainda não está ligado à folha. O DP precisa concluir o vínculo.',
};

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
  const [today, setToday] = useState<HojePonto | null>(null);
  const [todayLoaded, setTodayLoaded] = useState(false);
  const [punching, setPunching] = useState<'in' | 'out' | null>(null);
  const [webauthnOk, setWebauthnOk] = useState(true);
  const [platformOk, setPlatformOk] = useState(true);

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
        const data = json.data as PontoStatus;
        setStatus(data);
        if (data.habilitado) {
          const todayRes = await fetch('/api/pontoflow/punch', { headers: authHeaders() });
          const todayJson = await todayRes.json();
          if (!cancelled && todayRes.ok && todayJson.success) {
            const hoje = lerHoje(todayJson.data);
            if (hoje) {
              setToday(hoje);
              setTodayLoaded(true);
            } else {
              setError(t('ponto.timesheet.loadError', 'Falha ao carregar status do Time Sheet'));
            }
          } else if (!cancelled) {
            setError(todayJson.error || t('ponto.timesheet.loadError', 'Falha ao carregar status do Time Sheet'));
          }
        }
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

  useEffect(() => {
    let cancelled = false;
    setWebauthnOk(browserSupportsWebAuthn());
    platformAuthenticatorIsAvailable()
      .then((available) => {
        if (!cancelled) setPlatformOk(available);
      })
      .catch(() => {
        if (!cancelled) setPlatformOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const punch = async (kind: 'in' | 'out') => {
    setPunching(kind);
    setError(null);
    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error(t('ponto.timesheet.biometricUnsupported', 'Este navegador não oferece biometria. O ponto não foi registrado.'));
      }
      const optionsRes = await fetch('/api/auth/webauthn/sign/options', {
        method: 'POST',
        headers: authHeaders(),
      });
      const optionsPayload = await optionsRes.json().catch(() => null);
      if (!optionsRes.ok) {
        throw new Error(optionsPayload?.error || t('ponto.timesheet.biometricFailed', 'Falha ao usar biometria. Cadastre Windows Hello ou digital em Perfil → Biometria (Passkeys).'));
      }
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: optionsPayload });
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          throw new Error(t('ponto.timesheet.biometricCancelled', 'Biometria cancelada. O ponto não foi registrado.'));
        }
        throw new Error(t('ponto.timesheet.biometricFailed', 'Falha ao usar biometria. Cadastre Windows Hello ou digital em Perfil → Biometria (Passkeys).'));
      }
      const res = await fetch('/api/pontoflow/punch', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ kind, assertion }),
      });
      const json = await res.json().catch(() => null);
      const recebido = lerHoje(json?.data);
      if (recebido) {
        setToday((anterior) => (anterior ? preferirRelogios(recebido, anterior) : recebido));
        setTodayLoaded(true);
      }
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || t('ponto.timesheet.punchError', 'Não foi possível registrar o ponto'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ponto.timesheet.punchError', 'Não foi possível registrar o ponto'));
    } finally {
      setPunching(null);
    }
  };

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
  const fase = today ? faseExpediente(today) : 'aguardando_inicio';
  const acoes = acoesExpediente(fase);
  const dia = today ? resumoHoje(today) : null;
  const hojeTexto = !today || (!today.horaIni && !today.horaFim)
    ? '—'
    : !today.horaFim
      ? `${today.horaIni || '—'} (${t('ponto.timesheet.openShift', 'em aberto')})`
      : `${today.horaIni || '—'} – ${today.horaFim}${
          dia?.jornada?.lunchApplied
            ? ` · ${t('ponto.timesheet.lunch', 'Almoço')} 12:00–13:00 · ${dia.jornada.lunchMinutes} min`
            : ''
        }${dia?.jornada ? ` · ${t('ponto.timesheet.net', 'líquido')} ${formatarMinutos(dia.jornada.netMinutes)}` : ''}`;

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
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="ponto-inicio"
                onClick={() => punch('in')}
                disabled={!acoes.inicio || !todayLoaded || punching !== null || !webauthnOk}
                className="inline-flex items-center px-6 py-3 bg-abz-blue text-white rounded-lg font-semibold hover:bg-abz-blue-dark transition duration-200 shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiClock className="mr-2" />
                {punching === 'in'
                  ? t('ponto.timesheet.punching', 'Aguardando biometria…')
                  : acoes.inicio
                    ? t('ponto.timesheet.start', 'Início de expediente')
                    : t('ponto.timesheet.startDone', 'Início registrado')}
              </button>
              <button
                type="button"
                data-testid="ponto-fim"
                onClick={() => punch('out')}
                disabled={!acoes.fim || !todayLoaded || punching !== null || !webauthnOk}
                className="inline-flex items-center px-6 py-3 bg-abz-blue text-white rounded-lg font-semibold hover:bg-abz-blue-dark transition duration-200 shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiClock className="mr-2" />
                {punching === 'out'
                  ? t('ponto.timesheet.punching', 'Aguardando biometria…')
                  : fase === 'encerrado'
                    ? t('ponto.timesheet.endDone', 'Fim registrado')
                    : t('ponto.timesheet.end', 'Fim de expediente')}
              </button>
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
              <p className="text-sm text-gray-600" data-testid="ponto-hoje">
                {t('ponto.timesheet.today', 'Hoje:')}{' '}
                <span className="font-medium text-gray-900">{hojeTexto}</span>
              </p>
            </div>
            <p className="text-xs text-gray-500">
              {t(
                'ponto.timesheet.biometricHint',
                'A biometria (Windows Hello ou digital) é obrigatória para marcar o início e o fim. O almoço de 12:00 às 13:00 é calculado automaticamente.',
              )}
            </p>
            {fase === 'encerrado' && (
              <p className="text-sm text-green-700 flex items-center gap-2">
                <FiCheckCircle /> {t('ponto.timesheet.closed', 'Expediente encerrado')}
              </p>
            )}
            {dia?.avisoMenosDeOitoHoras && dia.jornada && (
              <div
                role="status"
                data-testid="ponto-aviso-8h"
                className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <FiAlertCircle className="mt-0.5 shrink-0" />
                <span>
                  {dia.jornada.lunchApplied
                    ? t('ponto.timesheet.belowEightLunch', { hours: formatarMinutos(dia.jornada.netMinutes) }, 'Aviso: o expediente de hoje tem {hours} líquidas, menos de 8 horas. O almoço de 12:00 às 13:00 já foi descontado.')
                    : t('ponto.timesheet.belowEight', { hours: formatarMinutos(dia.jornada.netMinutes) }, 'Aviso: o expediente de hoje tem {hours} líquidas, menos de 8 horas.')}
                </span>
              </div>
            )}
            {!platformOk && webauthnOk && (
              <p className="text-xs text-amber-800">
                {t('ponto.timesheet.noPlatform', 'Este aparelho não confirmou biometria de dispositivo. O ponto só entra se a autenticação biométrica concluir.')}
              </p>
            )}
            {error && (
              <p className="flex items-center gap-2 text-sm text-red-700">
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
              {MOTIVO_LABEL[status?.motivo || ''] ||
                t(
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
