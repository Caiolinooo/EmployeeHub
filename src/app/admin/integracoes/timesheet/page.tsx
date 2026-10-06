'use client';

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiClock,
  FiPlay,
  FiRefreshCw,
  FiSave,
  FiAlertTriangle,
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { getToken } from '@/lib/tokenStorage';

interface EmpresaSettings {
  empresaId: string;
  empresaNome: string;
  tenantSlug: string;
  enabled: boolean;
  configurado: boolean;
  baseUrl: string | null;
  apiKeyMascarada: string | null;
  webhookSecretMascarado: string | null;
}

interface FilaStatus {
  pendentes: number;
  aguardandoRetry: number;
  dead: number;
}

interface EmpresaForm {
  tenantSlug: string;
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
}

const EMPTY_FORM: EmpresaForm = {
  tenantSlug: '',
  enabled: true,
  baseUrl: '',
  apiKey: '',
  webhookSecret: '',
};

export default function TimesheetIntegracaoAdminPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<EmpresaSettings[]>([]);
  const [fila, setFila] = useState<FilaStatus | null>(null);
  const [forms, setForms] = useState<Record<string, EmpresaForm>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const authHeaders = useCallback((): HeadersInit => {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pontoflow/settings', { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || t('admin.timesheet.loadError', 'Falha ao carregar configurações'));
      }
      const lista: EmpresaSettings[] = json.data.empresas || [];
      setEmpresas(lista);
      setFila(json.data.fila || null);
      const nextForms: Record<string, EmpresaForm> = {};
      for (const emp of lista) {
        nextForms[emp.empresaId] = {
          tenantSlug: emp.tenantSlug || '',
          enabled: emp.enabled,
          baseUrl: emp.baseUrl || '',
          apiKey: '',
          webhookSecret: '',
        };
      }
      setForms(nextForms);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.timesheet.loadError', 'Falha ao carregar configurações'));
    } finally {
      setLoading(false);
    }
  }, [authHeaders, t]);

  useEffect(() => {
    load();
  }, [load]);

  const updateForm = (empresaId: string, patch: Partial<EmpresaForm>) => {
    setForms((prev) => ({
      ...prev,
      [empresaId]: { ...(prev[empresaId] || EMPTY_FORM), ...patch },
    }));
  };

  const saveEmpresa = async (empresaId: string) => {
    const form = forms[empresaId];
    if (!form) return;
    setSaving(empresaId);
    try {
      const res = await fetch('/api/pontoflow/settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          empresaId,
          tenantSlug: form.tenantSlug,
          enabled: form.enabled,
          ...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
          ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
          ...(form.webhookSecret.trim() ? { webhookSecret: form.webhookSecret.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || t('admin.timesheet.saveError', 'Falha ao salvar'));
      }
      toast.success(t('admin.timesheet.saveOk', 'Configuração salva'));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.timesheet.saveError', 'Falha ao salvar'));
    } finally {
      setSaving(null);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/cron/timesheet-sync', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || t('admin.timesheet.syncError', 'Falha ao sincronizar'));
      }
      const d = json.data?.drain;
      toast.success(
        t(
          'admin.timesheet.syncOk',
          `Sincronização concluída: ${d?.ok ?? 0} ok, ${d?.failed ?? 0} falhas, ${d?.dead ?? 0} dead`,
        ),
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.timesheet.syncError', 'Falha ao sincronizar'));
    } finally {
      setSyncing(false);
    }
  };

  const reprocessDead = async () => {
    setReprocessing(true);
    try {
      const res = await fetch('/api/cron/timesheet-sync', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reprocessDead: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || t('admin.timesheet.reprocessError', 'Falha ao reprocessar'));
      }
      toast.success(
        t(
          'admin.timesheet.reprocessOk',
          `${json.data?.reprocessed ?? 0} job(s) devolvido(s) à fila`,
        ),
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.timesheet.reprocessError', 'Falha ao reprocessar'));
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
        <FiClock className="mr-2 text-abz-blue" />
        {t('admin.timesheet.title', 'Integração Time-Sheet (PontoFlow)')}
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        {t(
          'admin.timesheet.subtitle',
          'Configuração por empresa (1 tenant por empresa), credenciais e fila de sincronização.',
        )}
      </p>

      {/* Status da fila */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('admin.timesheet.queueTitle', 'Fila de sincronização')}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={syncNow}
              disabled={syncing || loading}
              className="inline-flex items-center px-4 py-2 bg-abz-blue text-white rounded-md text-sm font-medium hover:bg-abz-blue-dark disabled:opacity-50"
            >
              <FiPlay className="mr-1.5" />
              {syncing
                ? t('admin.timesheet.syncing', 'Sincronizando…')
                : t('admin.timesheet.syncNow', 'Sincronizar agora')}
            </button>
            <button
              type="button"
              onClick={reprocessDead}
              disabled={reprocessing || loading || !fila || fila.dead === 0}
              className="inline-flex items-center px-4 py-2 bg-gray-700 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              <FiRefreshCw className="mr-1.5" />
              {reprocessing
                ? t('admin.timesheet.reprocessing', 'Reprocessando…')
                : t('admin.timesheet.reprocess', 'Reprocessar falhos')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-md bg-blue-50 p-4 text-center">
            <div className="text-2xl font-bold text-abz-blue">{fila?.pendentes ?? '—'}</div>
            <div className="text-xs text-gray-600 mt-1">
              {t('admin.timesheet.queuePending', 'Pendentes')}
            </div>
          </div>
          <div className="rounded-md bg-yellow-50 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-700">{fila?.aguardandoRetry ?? '—'}</div>
            <div className="text-xs text-gray-600 mt-1">
              {t('admin.timesheet.queueRetry', 'Aguardando retry')}
            </div>
          </div>
          <div className="rounded-md bg-red-50 p-4 text-center">
            <div className="text-2xl font-bold text-red-700 flex items-center justify-center gap-1">
              {fila && fila.dead > 0 && <FiAlertTriangle />}
              {fila?.dead ?? '—'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {t('admin.timesheet.queueDead', 'Falhos (dead)')}
            </div>
          </div>
        </div>
      </div>

      {/* Empresas */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-sm text-gray-500">
          {t('admin.timesheet.loading', 'Carregando…')}
        </div>
      ) : empresas.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-sm text-gray-500">
          {t('admin.timesheet.noCompanies', 'Nenhuma empresa cadastrada.')}
        </div>
      ) : (
        empresas.map((emp) => {
          const form = forms[emp.empresaId] || EMPTY_FORM;
          return (
            <div key={emp.empresaId} className="bg-white rounded-lg shadow-md p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">{emp.empresaNome}</h3>
                <label className="inline-flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2 h-4 w-4"
                    checked={form.enabled}
                    onChange={(e) => updateForm(emp.empresaId, { enabled: e.target.checked })}
                  />
                  {t('admin.timesheet.enabled', 'Integração habilitada')}
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('admin.timesheet.tenantSlug', 'Slug do tenant no Time-Sheet')}
                  </label>
                  <input
                    type="text"
                    value={form.tenantSlug}
                    onChange={(e) => updateForm(emp.empresaId, { tenantSlug: e.target.value })}
                    placeholder="ex.: abz-group"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('admin.timesheet.baseUrl', 'URL base da API (https)')}
                  </label>
                  <input
                    type="url"
                    value={form.baseUrl}
                    onChange={(e) => updateForm(emp.empresaId, { baseUrl: e.target.value })}
                    placeholder="https://pontoflow.exemplo.com"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('admin.timesheet.apiKey', 'API key (X-API-Key)')}
                    {emp.apiKeyMascarada && (
                      <span className="ml-2 text-gray-400">{emp.apiKeyMascarada}</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => updateForm(emp.empresaId, { apiKey: e.target.value })}
                    placeholder={t('admin.timesheet.keepSecret', 'Vazio mantém a atual')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('admin.timesheet.webhookSecret', 'Segredo dos webhooks (HMAC)')}
                    {emp.webhookSecretMascarado && (
                      <span className="ml-2 text-gray-400">{emp.webhookSecretMascarado}</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={form.webhookSecret}
                    onChange={(e) => updateForm(emp.empresaId, { webhookSecret: e.target.value })}
                    placeholder={t('admin.timesheet.keepSecret', 'Vazio mantém a atual')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => saveEmpresa(emp.empresaId)}
                  disabled={saving === emp.empresaId}
                  className="inline-flex items-center px-4 py-2 bg-abz-blue text-white rounded-md text-sm font-medium hover:bg-abz-blue-dark disabled:opacity-50"
                >
                  <FiSave className="mr-1.5" />
                  {saving === emp.empresaId
                    ? t('admin.timesheet.saving', 'Salvando…')
                    : t('admin.timesheet.save', 'Salvar')}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
