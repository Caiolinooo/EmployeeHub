'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import { cpfsMatch } from '@/lib/gestao-tripulantes/cpf';
import { scheduleDisplayCode } from '@/lib/gestao-tripulantes/embarque-status';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type ScheduleEntry = {
  id: string;
  cpf: string;
  full_name: string;
  position: string;
  vessel: string;
  company: string;
  rotation_start: string | null;
  rotation_end: string | null;
  embarque_status: string | null;
  local_embarque: string;
  rotation_type: string;
  observacoes?: string | null;
};

function parseYmd(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(`${value.trim().slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value?: string | null): string {
  const d = parseYmd(value);
  return d ? d.toLocaleDateString('pt-BR') : '';
}

function periodLabel(start?: string | null, end?: string | null): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s} → ${e}`;
  if (s) return `${s} → em aberto`;
  if (e) return `até ${e}`;
  return 'Sem data definida';
}


export default function MobileManSchedule() {
  const { profile, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch('/api/man-schedule/realtime?janela=90d', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Erro na API');
      setEntries(Array.isArray(result.data) ? result.data : []);
    } catch {
      setError('Não foi possível carregar sua escala.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const mine = useMemo(() => {
    const taxId = profile?.tax_id;
    if (!taxId) return [];
    const time = (s: ScheduleEntry) =>
      (parseYmd(s.rotation_start) || parseYmd(s.rotation_end))?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return entries
      .filter((s) => cpfsMatch(s.cpf, taxId))
      .sort((a, b) => time(a) - time(b));
  }, [entries, profile?.tax_id]);
  const identity = mine[0] || null;

  return (
    <MobileShell title="Escala">
      <div className="flex flex-col gap-3" data-abz-mobile-man-schedule="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver sua escala.
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

            {identity ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900">{identity.full_name}</h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {[identity.position, identity.vessel, identity.company]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ) : null}

            {mine.map((s) => (
              <DataCard
                key={s.id}
                title={periodLabel(s.rotation_start, s.rotation_end)}
                subtitle={[s.vessel, s.position].filter(Boolean).join(' · ') || undefined}
                meta={scheduleDisplayCode(s.rotation_type, s.observacoes) || undefined}
              >
                {s.local_embarque ? (
                  <p className="mt-2 text-xs text-gray-500">Embarque: {s.local_embarque}</p>
                ) : null}
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && mine.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma rotação encontrada para você no período.
              </p>
            ) : null}

            <p className="py-2 text-center text-xs text-gray-400">
              Para ver a grade completa da equipe, acesse a versão desktop.
            </p>
          </>
        )}
      </div>
    </MobileShell>
  );
}
