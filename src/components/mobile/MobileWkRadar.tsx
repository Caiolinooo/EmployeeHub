'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FiMonitor } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type CredentialsState = {
  username: string;
  password: string;
  isCustom: boolean;
};

const GUACAMOLE_PROXY_URL = '/api/guac-proxy';

export default function MobileWkRadar() {
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [credentials, setCredentials] = useState<CredentialsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Mesma API do desktop: GET /api/wkradar/credentials?userId=...
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`/api/wkradar/credentials?userId=${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.credentials?.username && data.credentials?.password) {
        setCredentials({
          username: data.credentials.username,
          password: data.credentials.password,
          isCustom: Boolean(data.isCustom),
        });
      } else {
        setCredentials(null);
        setError(data.message || data.error || 'Credenciais WKRadar indisponíveis. Contate o administrador.');
      }
    } catch {
      setCredentials(null);
      setError('Não foi possível carregar credenciais WKRadar.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  // Mesmo login do desktop: POST /api/guac-proxy/api/tokens (form-urlencoded)
  const checkConnection = async () => {
    if (!credentials) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const params = new URLSearchParams();
      params.append('username', credentials.username);
      params.append('password', credentials.password);
      const res = await fetch(`${GUACAMOLE_PROXY_URL}/api/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (res.ok) {
        const authData = await res.json().catch(() => null);
        if (authData?.authToken) {
          setCheckResult({ ok: true, message: 'Conexão disponível. A sessão completa abre na versão desktop.' });
        } else {
          setCheckResult({ ok: false, message: 'Credenciais inválidas. Entre em contato com o administrador.' });
        }
      } else if (res.status >= 500) {
        setCheckResult({ ok: false, message: 'O servidor WKRadar está em manutenção. Tente novamente mais tarde.' });
      } else if (res.status === 403) {
        setCheckResult({ ok: false, message: 'Credenciais inválidas ou acesso negado ao WKRadar.' });
      } else {
        setCheckResult({ ok: false, message: 'Sistema temporariamente indisponível. Tente novamente mais tarde.' });
      }
    } catch {
      setCheckResult({ ok: false, message: 'Erro de conexão com o servidor WKRadar.' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <MobileShell title="WKRadar">
      <div className="flex flex-col gap-3" data-abz-mobile-wkradar="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para acessar o WKRadar.
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

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}

            {!loading && credentials ? (
              <DataCard
                title="Acesso WKRadar"
                subtitle={`Usuário: ${credentials.username}`}
                meta={credentials.isCustom ? 'Personalizado' : 'Padrão'}
              >
                <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <FiMonitor aria-hidden className="h-4 w-4 shrink-0 text-[#005B96]" />
                  Área de trabalho remota (Guacamole)
                </p>
              </DataCard>
            ) : null}

            {checkResult ? (
              <div
                className={`${checkResult.ok ? 'abz-m-alert-ok' : 'abz-m-alert-error'} rounded-xl p-3 text-sm`}
                role="status"
              >
                {checkResult.message}
              </div>
            ) : null}

            {!loading && credentials ? (
              <>
                <TouchButton
                  className="w-full justify-center"
                  onClick={checkConnection}
                  disabled={checking}
                >
                  {checking ? 'Verificando…' : 'Verificar conexão'}
                </TouchButton>
                <TouchButton asChild variant="ghost" className="w-full justify-center">
                  <a href="/wkradar">Abrir sessão completa (versão desktop)</a>
                </TouchButton>
                <p className="text-center text-xs text-gray-400">
                  A área de trabalho remota exige tela maior e é aberta na versão desktop.
                </p>
              </>
            ) : null}
          </>
        )}
      </div>
    </MobileShell>
  );
}
