'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSignature } from '@/contexts/SignatureContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type ListaPresenca = {
  id: string;
  titulo: string;
  data_evento: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  local?: string | null;
  pauta?: string | null;
  status: 'aberta' | 'fechada' | 'cancelada';
  total_participantes?: number | null;
  max_participantes?: number | null;
  criador_nome?: string | null;
  setor_nome?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  cancelada: 'Cancelada',
};

function statusLabel(status?: string | null): string {
  if (!status) return 'Aberta';
  return STATUS_LABEL[status] || status;
}

function statusTone(status?: string | null): string {
  if (status === 'aberta') return 'text-green-700';
  if (status === 'cancelada') return 'text-red-700';
  return 'text-gray-600';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}


function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MobileListaPresenca() {
  const { user, profile, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const { requestSignature } = useSignature();
  const [listas, setListas] = useState<ListaPresenca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lista-presenca?limit=50', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setListas(Array.isArray(data.listas) ? data.listas : []);
      } else {
        throw new Error(data.error || 'Erro ao carregar');
      }
    } catch {
      setError('Não foi possível carregar as listas de presença.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const signAttendance = async (lista: ListaPresenca) => {
    if (!user?.id || !profile) return;
    const result = await requestSignature({
      title: 'Registrar Presença',
      description: `Confirme sua identidade para registrar presença em "${lista.titulo}".`,
    });
    if (!result) return;
    setSigningId(lista.id);
    setError(null);
    setSuccessMsg(null);
    try {
      const fullName =
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Usuário';
      const res = await fetch('/api/lista-presenca/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          lista_id: lista.id,
          nome_completo: fullName,
          funcao: profile.role || '',
          empresa: 'ABZ Group',
          assinatura_url: result.signatureUrl,
          user_id: user.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSuccessMsg(`Presença registrada em "${lista.titulo}".`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar presença.');
    } finally {
      setSigningId(null);
    }
  };

  return (
    <MobileShell title="Lista de Presença">
      <div className="flex flex-col gap-3" data-abz-mobile-lista-presenca="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver as listas de presença.
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

            {listas.map((lista) => {
              const inicio = lista.hora_inicio ? lista.hora_inicio.slice(0, 5) : '';
              const fim = lista.hora_fim ? lista.hora_fim.slice(0, 5) : '';
              const horario = inicio ? (fim ? `${inicio}–${fim}` : inicio) : '';
              const vagas = lista.max_participantes
                ? `${lista.total_participantes ?? 0}/${lista.max_participantes} presentes`
                : `${lista.total_participantes ?? 0} presentes`;
              return (
                <DataCard
                  key={lista.id}
                  title={lista.titulo}
                  subtitle={[lista.local, lista.setor_nome].filter(Boolean).join(' · ') || undefined}
                  meta={formatDate(lista.data_evento)}
                >
                  <span className={`mt-2 block text-xs font-semibold ${statusTone(lista.status)}`}>
                    {statusLabel(lista.status)}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {[horario, vagas].filter(Boolean).join(' · ')}
                  </span>
                  {lista.status === 'aberta' ? (
                    <TouchButton
                      variant="ghost"
                      className="mt-2 w-full justify-center"
                      onClick={() => signAttendance(lista)}
                      disabled={signingId === lista.id}
                      data-abz-mobile-lista-presenca-sign=""
                    >
                      {signingId === lista.id ? 'Registrando…' : 'Marcar presença'}
                    </TouchButton>
                  ) : null}
                </DataCard>
              );
            })}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && listas.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma lista de presença disponível.
              </p>
            ) : null}
          </>
        )}
      </div>
    </MobileShell>
  );
}
