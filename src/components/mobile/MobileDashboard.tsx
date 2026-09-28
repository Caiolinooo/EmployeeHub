'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import { isMobileImplemented } from '@/lib/mobile-ui/device-surface';
import MobileShell from './MobileShell';
import DataCard from './DataCard';
import TouchButton from './TouchButton';
import { visibleMobileShortcuts } from './mobile-shortcuts';

type Pendencies = {
  emails_nao_lidos: number;
  ferias_pendentes: number;
  reembolsos_pendentes: number;
  avaliacoes_pendentes: number;
  epis_vencidos: number;
  eventos_hoje_amanha: number;
  total: number;
};

type CompanyEvent = {
  start: string;
  summary: string;
  description?: string | null;
};

const PENDENCY_ITEMS = [
  { key: 'emails_nao_lidos', label: 'E-mails não lidos', href: '/ia' },
  { key: 'ferias_pendentes', label: 'Férias pendentes', href: '/ferias' },
  { key: 'reembolsos_pendentes', label: 'Reembolsos pendentes', href: '/reembolso' },
  { key: 'avaliacoes_pendentes', label: 'Avaliações pendentes', href: '/avaliacao' },
  { key: 'epis_vencidos', label: 'EPIs vencidos', href: '/epi' },
  { key: 'eventos_hoje_amanha', label: 'Eventos hoje/amanhã', href: '/calendario' },
] as const;

function mobileHref(publicHref: string): string {
  return isMobileImplemented(publicHref) ? `/m${publicHref}` : publicHref;
}

function moduleInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '•';
}

export default function MobileDashboard() {
  const { user, profile, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const [pendencies, setPendencies] = useState<Pendencies | null>(null);
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const firstName =
    profile?.first_name?.split(' ')[0] ||
    user?.email?.split('@')[0]?.split('.')[0] ||
    '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [pendRes, eventsRes] = await Promise.all([
        fetch('/api/dashboard/pendencies', { headers }),
        fetch('/api/calendar/company/events?rangeDays=30', { headers }),
      ]);
      if (pendRes.ok) {
        const data = await pendRes.json();
        if (!data.error) setPendencies(data as Pendencies);
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        const list: CompanyEvent[] = Array.isArray(data.events) ? data.events : [];
        setEvents(
          list
            .slice()
            .sort((a, b) => String(a.start).localeCompare(String(b.start)))
            .slice(0, 3),
        );
      }
      if (!pendRes.ok && !eventsRes.ok) {
        setError('Não foi possível carregar o resumo.');
      }
    } catch {
      setError('Não foi possível carregar o resumo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const shortcuts = visibleMobileShortcuts();
  const pendencyItems = pendencies
    ? PENDENCY_ITEMS.filter((item) => (pendencies[item.key] || 0) > 0)
    : [];

  return (
    <MobileShell title="Dashboard">
      <div className="flex flex-col gap-5" data-abz-mobile-dashboard="">
        {!isAuthenticated && !authLoading ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Entre para ver seu resumo e pendências.
            </p>
            <Link
              href="/login"
              className="touch-target inline-flex items-center justify-center rounded-xl bg-[#005B96] px-4 text-base font-semibold text-white"
            >
              Entrar
            </Link>
          </div>
        ) : (
          <>
            <section aria-label="Saudação" className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-gray-900">
                {firstName ? `Olá, ${firstName}` : 'Olá'}
              </h2>
              <p className="text-sm text-gray-500">
                Bem-vindo ao Portal ABZ. Aqui está o seu resumo.
              </p>
            </section>

            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            <section aria-label="Pendências" className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Pendências
              </h2>
              {loading ? (
                <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
              ) : pendencyItems.length > 0 ? (
                pendencyItems.map((item) => (
                  <DataCard
                    key={item.key}
                    title={item.label}
                    meta={String(pendencies?.[item.key] ?? 0)}
                    onClick={() => router.push(mobileHref(item.href))}
                  />
                ))
              ) : (
                <DataCard
                  title="Tudo em dia"
                  subtitle="Nenhuma pendência no momento."
                  meta="0"
                />
              )}
            </section>

            <section aria-label="Próximos eventos" className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Próximos eventos
              </h2>
              {!loading && events.length === 0 ? (
                <p className="py-2 text-sm text-gray-500">
                  Nenhum evento nos próximos 30 dias.
                </p>
              ) : (
                events.map((event, i) => {
                  const d = new Date(event.start);
                  const dateLabel = Number.isNaN(d.getTime())
                    ? ''
                    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                  return (
                    <DataCard
                      key={`${event.start}-${i}`}
                      title={event.summary || 'Evento'}
                      subtitle={event.description || undefined}
                      meta={dateLabel}
                    />
                  );
                })
              )}
            </section>
          </>
        )}

        <section aria-label="Módulos" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Módulos
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {shortcuts.map((mod) => (
              <Link
                key={mod.key}
                href={mod.href}
                className="touch-target flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#005B96] text-sm font-bold text-white"
                >
                  {moduleInitial(mod.name)}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-gray-800">
                  {mod.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </MobileShell>
  );
}
