'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type Aba = {
  id: string;
  nome: string;
  totalLinhas: number;
};

type Planilha = {
  id: string;
  nome: string;
  arquivoNome?: string | null;
  criadoEm?: string | null;
  abas: Aba[];
};

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('pt-BR');
}

export default function MobileIndicadores() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [planilhas, setPlanilhas] = useState<Planilha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch('/api/indicadores/planilhas', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setPlanilhas(Array.isArray(json.data?.planilhas) ? json.data.planilhas : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os indicadores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  return (
    <MobileShell title="Indicadores R&S">
      <div className="flex flex-col gap-3" data-abz-mobile-indicadores="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver os indicadores.
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

            {planilhas.map((p) => {
              const totalLinhas = p.abas.reduce((acc, a) => acc + (a.totalLinhas || 0), 0);
              return (
                <DataCard
                  key={p.id}
                  title={p.nome}
                  subtitle={p.arquivoNome || undefined}
                  meta={formatDateTime(p.criadoEm)}
                >
                  <p className="mt-2 text-xs text-gray-500">
                    {p.abas.length} {p.abas.length === 1 ? 'aba' : 'abas'} · {totalLinhas}{' '}
                    {totalLinhas === 1 ? 'linha' : 'linhas'}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {p.abas.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="truncate font-medium text-gray-700">{a.nome}</span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {a.totalLinhas} {a.totalLinhas === 1 ? 'linha' : 'linhas'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </DataCard>
              );
            })}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && planilhas.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma planilha importada. A importação fica disponível na versão desktop.
              </p>
            ) : null}
          </>
        )}
      </div>
    </MobileShell>
  );
}
