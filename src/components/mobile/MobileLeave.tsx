'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import BottomSheet from './BottomSheet';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type LeaveRequest = {
  id: string;
  start_date: string;
  end_date: string;
  days?: number | null;
  status?: string | null;
  justification?: string | null;
  created_at?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_LEADER: 'Aguardando líder',
  PENDING_MANAGER: 'Aguardando gerente',
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
};

function statusLabel(status?: string | null): string {
  if (!status) return 'Pendente';
  return STATUS_LABEL[status] || status;
}

function statusTone(status?: string | null): string {
  if (status === 'APPROVED') return 'text-green-700';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'text-red-700';
  return 'text-amber-700';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function diffDays(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000) + 1;
}

export default function MobileLeave() {
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`/api/leave/requests?userId=${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : data.requests || data.data || []);
    } catch {
      setError('Não foi possível carregar suas férias.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const submit = async () => {
    if (!user?.id) return;
    setFormError(null);
    if (!startDate || !endDate) {
      setFormError('Informe início e fim.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setFormError('O fim não pode ser antes do início.');
      return;
    }
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch('/api/leave/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: user.id,
          start_date: startDate,
          end_date: endDate,
          justification: justification || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setFormOpen(false);
      setStartDate('');
      setEndDate('');
      setJustification('');
      setSuccessMsg('Solicitação enviada para aprovação.');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao enviar solicitação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileShell title="Férias">
      <div className="flex flex-col gap-3" data-abz-mobile-leave="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver suas solicitações de férias.
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

            <TouchButton
              className="w-full justify-center"
              onClick={() => setFormOpen(true)}
              data-abz-mobile-leave-new=""
            >
              Nova solicitação
            </TouchButton>

            {requests.map((req) => {
              const days = req.days ?? diffDays(req.start_date, req.end_date);
              return (
                <DataCard
                  key={req.id}
                  title={`${formatDate(req.start_date)} → ${formatDate(req.end_date)}`}
                  subtitle={req.justification || undefined}
                  meta={days ? `${days}d` : undefined}
                >
                  <span className={`mt-2 block text-xs font-semibold ${statusTone(req.status)}`}>
                    {statusLabel(req.status)}
                  </span>
                </DataCard>
              );
            })}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && requests.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma solicitação de férias.
              </p>
            ) : null}
          </>
        )}
      </div>

      <BottomSheet open={formOpen} onClose={() => setFormOpen(false)} title="Nova solicitação">
        <div className="flex flex-col gap-3" data-abz-mobile-leave-form="">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Início
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Fim
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Observação (opcional)
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="rounded-xl border border-gray-200 px-3 py-2 text-base"
            />
          </label>
          {formError ? (
            <p className="abz-m-alert-error rounded-xl p-2 text-sm" role="alert">
              {formError}
            </p>
          ) : null}
          <TouchButton className="w-full justify-center" onClick={submit} disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar solicitação'}
          </TouchButton>
        </div>
      </BottomSheet>
    </MobileShell>
  );
}
