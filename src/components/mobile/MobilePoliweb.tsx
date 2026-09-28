'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import BottomSheet from './BottomSheet';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type TabType = 'novo' | 'antigo';

type TabState = {
  loading: boolean;
  error: string | null;
  proxyReady: boolean;
};

// Mesmas rotas de API e destinos do desktop (src/app/poliweb/page.tsx)
const TAB_CONFIG: Record<
  TabType,
  { label: string; loginApi: string; proxyUrl: string; externalUrl: string }
> = {
  novo: {
    label: 'Novo Poliweb',
    loginApi: '/api/poliweb/login',
    proxyUrl: '/api/poliweb-proxy/PainelEmpresa',
    externalUrl: 'https://poliweb.policlinicamacae.com.br/PainelEmpresa',
  },
  antigo: {
    label: 'Poliweb Antigo',
    loginApi: '/api/poliweb-antigo/login',
    proxyUrl: '/api/poliweb-antigo-proxy/Login.aspx',
    externalUrl: 'https://www.policlinicaweb.com.br/',
  },
};

const initialTabState: TabState = { loading: false, error: null, proxyReady: false };

export default function MobilePoliweb() {
  const { user, isAuthenticated, isLoading: authLoading, hasAccess } = useSupabaseAuth();
  const hasPoliwebAccess = hasAccess('poliweb');

  const [activeTab, setActiveTab] = useState<TabType>('novo');
  const [tabStates, setTabStates] = useState<Record<TabType, TabState>>({
    novo: initialTabState,
    antigo: initialTabState,
  });
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [missingType, setMissingType] = useState<TabType | null>(null);
  const [credentialForm, setCredentialForm] = useState({
    username_novo: '',
    password_novo: '',
    username_antigo: '',
    password_antigo: '',
  });
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);

  const setTabState = useCallback((tab: TabType, patch: Partial<TabState>) => {
    setTabStates((prev) => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  }, []);

  const doLogin = useCallback(
    async (tab: TabType) => {
      const config = TAB_CONFIG[tab];
      setTabState(tab, { loading: true, error: null, proxyReady: false });

      const token = getToken();
      if (!token) {
        setTabState(tab, {
          loading: false,
          error: 'Sessão expirada. Faça login novamente no portal.',
        });
        return;
      }

      try {
        const res = await fetch(config.loginApi, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json().catch(() => ({}));

        if (data.success) {
          setTabState(tab, { loading: false, proxyReady: true, error: null });
        } else if (data.needsCredentialUpdate) {
          setMissingType((data.missingType as TabType) || tab);
          setCredentialOpen(true);
          setTabState(tab, { loading: false, error: null });
        } else {
          setTabState(tab, {
            loading: false,
            error: data.error || `Falha ao realizar login no ${config.label}.`,
          });
        }
      } catch {
        setTabState(tab, { loading: false, error: 'Erro de conexão com o Poliweb.' });
      }
    },
    [setTabState],
  );

  useEffect(() => {
    if (!hasPoliwebAccess || !isAuthenticated || !user) return;
    doLogin(activeTab);
  }, [hasPoliwebAccess, isAuthenticated, user, activeTab, doLogin]);

  const handleSaveCredentials = async () => {
    const token = getToken();
    if (!token || !user?.id) {
      setCredentialError('Sessão expirada. Faça login novamente.');
      return;
    }
    setSavingCredentials(true);
    setCredentialError(null);
    try {
      const res = await fetch('/api/poliweb/credentials', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          username_novo: credentialForm.username_novo,
          password_novo: credentialForm.password_novo,
          username_antigo: credentialForm.username_antigo,
          password_antigo: credentialForm.password_antigo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        setCredentialError(data.error || 'Erro ao salvar credenciais.');
        return;
      }
      setCredentialOpen(false);
      doLogin(activeTab);
    } catch {
      setCredentialError('Erro ao salvar credenciais.');
    } finally {
      setSavingCredentials(false);
    }
  };

  const config = TAB_CONFIG[activeTab];
  const current = tabStates[activeTab];

  const credentialFormEmpty =
    !credentialForm.username_novo &&
    !credentialForm.password_novo &&
    !credentialForm.username_antigo &&
    !credentialForm.password_antigo;

  return (
    <MobileShell title="Poliweb">
      <div className="flex flex-col gap-3" data-abz-mobile-poliweb="">
        <p className="text-sm text-gray-600">
          Clínica ocupacional e gestão de ASO
        </p>

        {authLoading ? (
          <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
        ) : !isAuthenticated ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para acessar o Poliweb.
          </p>
        ) : !hasPoliwebAccess ? (
          <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
            <p className="font-semibold">Acesso não autorizado</p>
            <p className="mt-1">
              Seu setor não possui permissão para utilizar o módulo Poliweb no
              momento.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
                <TouchButton
                  key={tab}
                  variant={activeTab === tab ? 'primary' : 'ghost'}
                  className="w-full justify-center"
                  onClick={() => setActiveTab(tab)}
                >
                  {TAB_CONFIG[tab].label}
                </TouchButton>
              ))}
            </div>

            {current.loading ? (
              <p className="py-4 text-center text-sm text-gray-400">
                Realizando login no {config.label}…
              </p>
            ) : current.error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {current.error}
                <TouchButton
                  variant="ghost"
                  className="mt-1"
                  onClick={() => doLogin(activeTab)}
                >
                  Tentar novamente
                </TouchButton>
              </div>
            ) : current.proxyReady ? (
              <DataCard
                title={config.label}
                subtitle="Sessão conectada. Abra o painel para continuar."
              >
                <div className="mt-3 flex flex-col gap-2">
                  <TouchButton
                    className="w-full justify-center"
                    onClick={() => window.open(config.proxyUrl, '_blank')}
                    data-abz-mobile-poliweb-open=""
                  >
                    Abrir painel
                  </TouchButton>
                  <TouchButton
                    variant="ghost"
                    className="w-full justify-center"
                    onClick={() => window.open(config.externalUrl, '_blank')}
                  >
                    Abrir site oficial
                  </TouchButton>
                  <TouchButton
                    variant="ghost"
                    className="w-full justify-center"
                    onClick={() => doLogin(activeTab)}
                  >
                    Reconectar
                  </TouchButton>
                </div>
              </DataCard>
            ) : null}
          </>
        )}
      </div>

      <BottomSheet
        open={credentialOpen}
        onClose={() => setCredentialOpen(false)}
        title="Credenciais do Poliweb"
      >
        <div className="flex flex-col gap-3" data-abz-mobile-poliweb-credentials="">
          <p className="text-sm text-gray-600">
            Para acessar o{' '}
            <strong>
              {missingType === 'antigo' ? 'Poliweb Antigo' : 'Poliweb Novo'}
            </strong>
            , cadastre suas credenciais. Caso tenha acesso aos dois sistemas,
            preencha os dois campos.
          </p>

          <fieldset className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">
              Poliweb Novo
            </legend>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Email
              <input
                type="email"
                value={credentialForm.username_novo}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, username_novo: e.target.value })
                }
                placeholder="seu.email@empresa.com"
                className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Senha
              <input
                type="password"
                value={credentialForm.password_novo}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, password_novo: e.target.value })
                }
                placeholder="••••••••"
                className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
              />
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">
              Poliweb Antigo
            </legend>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Email
              <input
                type="email"
                value={credentialForm.username_antigo}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, username_antigo: e.target.value })
                }
                placeholder="seu.email@empresa.com"
                className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Senha
              <input
                type="password"
                value={credentialForm.password_antigo}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, password_antigo: e.target.value })
                }
                placeholder="••••••••"
                className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
              />
            </label>
          </fieldset>

          {credentialError ? (
            <p className="abz-m-alert-error rounded-xl p-2 text-sm" role="alert">
              {credentialError}
            </p>
          ) : null}

          <TouchButton
            className="w-full justify-center"
            onClick={handleSaveCredentials}
            disabled={savingCredentials || credentialFormEmpty}
          >
            {savingCredentials ? 'Salvando…' : 'Salvar e conectar'}
          </TouchButton>
        </div>
      </BottomSheet>
    </MobileShell>
  );
}
