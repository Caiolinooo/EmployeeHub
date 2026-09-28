'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

// Shape real de GET /api/admin/erp (src/lib/erp-integration.ts)
type ERPConnection = {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error';
  last_sync: string | null;
  modules: string[];
  active: boolean;
};

// Shape real de GET /api/admin/erp?action=logs (tabela erp_sync_logs)
type ERPSyncLog = {
  id: string;
  connection_id: string;
  module: string;
  status: 'running' | 'success' | 'error';
  started_at: string;
  completed_at?: string | null;
  records_synced?: number | null;
  errors?: number | null;
  duration_ms?: number | null;
  erp_connections?: { name: string } | null;
};

const CONNECTION_STATUS: Record<string, { label: string; tone: string }> = {
  connected: { label: 'Conectado', tone: 'text-green-700' },
  disconnected: { label: 'Desconectado', tone: 'text-gray-500' },
  error: { label: 'Erro', tone: 'text-red-700' },
};

const SYNC_STATUS: Record<string, { label: string; tone: string }> = {
  success: { label: 'Sucesso', tone: 'text-green-700' },
  running: { label: 'Executando', tone: 'text-amber-700' },
  error: { label: 'Erro', tone: 'text-red-700' },
};

function formatDateTime(value?: string | null): string {
  if (!value) return 'Nunca';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('pt-BR');
}

export default function MobileIntegracaoErp() {
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useSupabaseAuth();
  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [logs, setLogs] = useState<ERPSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [connRes, logsRes] = await Promise.all([
        fetch('/api/admin/erp', { headers }),
        fetch('/api/admin/erp?action=logs', { headers }),
      ]);
      if (!connRes.ok) throw new Error(`HTTP ${connRes.status}`);
      const connData = await connRes.json();
      setConnections(Array.isArray(connData.connections) ? connData.connections : []);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
      } else {
        setLogs([]);
      }
    } catch {
      setError('Não foi possível carregar as integrações ERP.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, isAdmin, authLoading, load]);

  return (
    <MobileShell title="Integração ERP">
      <div className="flex flex-col gap-4" data-abz-mobile-integracao-erp="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver as integrações ERP.
          </p>
        ) : !isAdmin && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Acesso restrito a administradores.
          </p>
        ) : (
          <>
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            <TouchButton
              variant="ghost"
              className="w-full justify-center"
              onClick={load}
              disabled={loading}
            >
              {loading ? 'Atualizando…' : 'Atualizar status'}
            </TouchButton>

            {/* Conexões ERP */}
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-gray-700">Conexões</h2>
              {connections.map((conn) => {
                const status = CONNECTION_STATUS[conn.status] || CONNECTION_STATUS.disconnected;
                return (
                  <DataCard
                    key={conn.id}
                    title={conn.name}
                    subtitle={`${conn.type} · ${conn.endpoint}`}
                    meta={status.label}
                  >
                    <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500">
                      <span>
                        Última sync: {formatDateTime(conn.last_sync)}
                      </span>
                      {conn.modules?.length ? (
                        <span>Módulos: {conn.modules.join(', ')}</span>
                      ) : null}
                      <span className={`font-semibold ${conn.active ? 'text-green-700' : 'text-gray-500'}`}>
                        {conn.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </DataCard>
                );
              })}
              {!loading && connections.length === 0 && !error ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  Nenhuma conexão ERP configurada.
                </p>
              ) : null}
            </section>

            {/* Sincronizações recentes */}
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-gray-700">Sincronizações recentes</h2>
              {logs.slice(0, 10).map((log) => {
                const status = SYNC_STATUS[log.status] || SYNC_STATUS.error;
                return (
                  <DataCard
                    key={log.id}
                    title={`${log.erp_connections?.name || 'Integração'} · ${log.module}`}
                    subtitle={formatDateTime(log.started_at)}
                    meta={status.label}
                  >
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Registros: {(log.records_synced ?? 0).toLocaleString('pt-BR')}</span>
                      <span className={log.errors ? 'text-red-700' : undefined}>
                        Erros: {log.errors ?? 0}
                      </span>
                      {log.duration_ms ? <span>{Math.round(log.duration_ms / 1000)}s</span> : null}
                    </div>
                  </DataCard>
                );
              })}
              {!loading && logs.length === 0 && !error ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  Nenhuma sincronização registrada.
                </p>
              ) : null}
            </section>

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}

            {/* Configuração completa fica no desktop */}
            <TouchButton
              variant="link"
              className="self-center"
              onClick={() => window.location.assign('/admin/integracao-erp')}
            >
              Abrir configuração completa no desktop
            </TouchButton>
          </>
        )}
      </div>
    </MobileShell>
  );
}
