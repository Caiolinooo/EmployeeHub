'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiClock, FiDownload, FiFileText } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import BottomSheet from './BottomSheet';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type ContrachequeItem = {
  sheet_id: string;
  mes: number;
  ano: number;
  competencia: string;
  empresa: { nome: string; cnpj: string };
  status: string;
  aceito_em: string | null;
};

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

export default function MobileContracheque() {
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [lista, setLista] = useState<ContrachequeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ item: ContrachequeItem; html: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [busyAceite, setBusyAceite] = useState(false);
  const [busyPdf, setBusyPdf] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contracheque', { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setLista(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar seus contracheques.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const abrir = async (item: ContrachequeItem) => {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracheque/${item.sheet_id}`, { headers: authHeaders() });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const html = await res.text();
      setViewing({ item, html });
      setConfirmando(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o contracheque.');
    } finally {
      setOpening(false);
    }
  };

  const baixarPdf = async (item: ContrachequeItem) => {
    setBusyPdf(item.sheet_id);
    setError(null);
    try {
      const res = await fetch(`/api/contracheque/${item.sheet_id}?pdf=1`, { headers: authHeaders() });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contracheque-${item.competencia.replace('/', '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setBusyPdf(null);
    }
  };

  const aceitar = async (item: ContrachequeItem) => {
    setBusyAceite(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracheque/${item.sheet_id}/aceite`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      const aceitoEm = json.data?.aceito_em as string;
      setLista((atual) => atual.map((c) => (c.sheet_id === item.sheet_id ? { ...c, aceito_em: aceitoEm } : c)));
      setViewing((atual) =>
        atual && atual.item.sheet_id === item.sheet_id
          ? { ...atual, item: { ...atual.item, aceito_em: aceitoEm } }
          : atual,
      );
      setSuccessMsg('Contracheque aceito e assinado com sucesso.');
      setConfirmando(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar o aceite.');
      setConfirmando(false);
    } finally {
      setBusyAceite(false);
    }
  };

  return (
    <MobileShell title="Contracheques">
      <div className="flex flex-col gap-3" data-abz-mobile-contracheque="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver seus contracheques.
          </p>
        ) : (
          <>
            {successMsg ? (
              <div className="abz-m-alert-ok rounded-xl p-3 text-sm" role="status">
                {successMsg}
              </div>
            ) : null}
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {lista.map((item) => (
              <DataCard
                key={item.sheet_id}
                title={`Competência ${item.competencia}`}
                subtitle={item.empresa.nome}
                onClick={() => abrir(item)}
              >
                <span
                  className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
                    item.aceito_em ? 'text-green-700' : 'text-amber-700'
                  }`}
                >
                  {item.aceito_em ? (
                    <>
                      <FiCheckCircle aria-hidden className="h-3.5 w-3.5" />
                      Aceito em {formatarData(item.aceito_em)}
                    </>
                  ) : (
                    <>
                      <FiClock aria-hidden className="h-3.5 w-3.5" />
                      Aceite pendente
                    </>
                  )}
                </span>
              </DataCard>
            ))}

            {loading || opening ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && lista.length === 0 && !error ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <FiFileText aria-hidden className="h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">Nenhum contracheque disponível no momento.</p>
                <p className="text-xs text-gray-400">
                  Contracheques aparecem aqui após a aprovação da folha de pagamento pelo DP.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      <BottomSheet
        open={!!viewing}
        onClose={() => {
          if (!busyAceite) {
            setViewing(null);
            setConfirmando(false);
          }
        }}
        title={viewing ? `Contracheque ${viewing.item.competencia}` : 'Contracheque'}
      >
        {viewing ? (
          <div className="flex flex-col gap-3" data-abz-mobile-contracheque-view="">
            {viewing.item.aceito_em ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                <FiCheckCircle aria-hidden className="h-4 w-4" />
                Assinado em {formatarData(viewing.item.aceito_em)}
              </span>
            ) : null}

            <div
              className="overflow-x-auto rounded-xl border border-gray-100 bg-white p-2 text-sm"
              // HTML vem da própria API /api/contracheque/[sheetId] (render server-side confiável)
              dangerouslySetInnerHTML={{ __html: viewing.html }}
            />

            {!viewing.item.aceito_em ? (
              confirmando ? (
                <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-800">
                    Confirmar aceite e assinatura eletrônica deste contracheque?
                  </p>
                  <div className="flex gap-2">
                    <TouchButton
                      className="flex-1 justify-center"
                      onClick={() => aceitar(viewing.item)}
                      disabled={busyAceite}
                      data-abz-mobile-contracheque-aceitar=""
                    >
                      {busyAceite ? 'Registrando…' : 'Confirmar aceite'}
                    </TouchButton>
                    <TouchButton
                      variant="ghost"
                      className="flex-1 justify-center"
                      onClick={() => setConfirmando(false)}
                      disabled={busyAceite}
                    >
                      Cancelar
                    </TouchButton>
                  </div>
                </div>
              ) : (
                <TouchButton
                  className="w-full justify-center"
                  onClick={() => setConfirmando(true)}
                  data-abz-mobile-contracheque-aceitar=""
                >
                  Aceitar e assinar
                </TouchButton>
              )
            ) : null}

            <TouchButton
              variant="ghost"
              className="w-full justify-center"
              onClick={() => baixarPdf(viewing.item)}
              disabled={busyPdf === viewing.item.sheet_id}
              data-abz-mobile-contracheque-pdf=""
            >
              <FiDownload aria-hidden className="mr-2 h-4 w-4" />
              {busyPdf === viewing.item.sheet_id ? 'Gerando PDF…' : 'Baixar PDF'}
            </TouchButton>
          </div>
        ) : null}
      </BottomSheet>
    </MobileShell>
  );
}
