'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type CompanyEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  start: string;
  end?: string;
  allDay?: boolean;
};

type Holiday = {
  date: string;
  name: string;
  type: string;
};

type CalendarItem = {
  key: string;
  date: string; // YYYY-MM-DD
  name: string;
  description?: string;
  location?: string;
  allDay?: boolean;
  start: string;
  source: 'holiday' | 'company';
  holidayType?: string;
};

// Feriados municipais de Macaé (datas fixas) — mesmo recorte do desktop
const MACAE_HOLIDAYS: Array<{ name: string; date: string }> = [
  { name: 'São Jorge', date: '04-23' },
  { name: 'São João Batista', date: '06-24' },
  { name: 'Aniversário de Macaé', date: '07-29' },
  { name: 'Consciência Negra', date: '11-20' },
];

const WINDOW_DAYS = 90;

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function eventStartYmd(start: string): string {
  return String(start || '').slice(0, 10);
}

function formatEventClock(start: string, allDay?: boolean): string {
  if (allDay) return 'Dia inteiro';
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatGroupHeader(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dayMonth = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  return `${weekday}, ${dayMonth}`;
}

async function fetchNationalHolidays(year: number): Promise<Holiday[]> {
  const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((h: { date: string; name: string; type: string }) => ({
    date: h.date,
    name: h.name,
    type: String(h.type || '').toUpperCase(),
  }));
}

export default function MobileCalendario() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [companyEvents, setCompanyEvents] = useState<CompanyEvent[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyBlocked, setCompanyBlocked] = useState(false);

  const range = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + WINDOW_DAYS);
    return { from: toLocalYmd(from), to: toLocalYmd(to) };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCompanyBlocked(false);
    try {
      // Feriados nacionais (BrasilAPI, público) + municipais de Macaé
      const years = Array.from(
        new Set([Number(range.from.slice(0, 4)), Number(range.to.slice(0, 4))]),
      );
      let national: Holiday[] = [];
      try {
        const perYear = await Promise.all(years.map((y) => fetchNationalHolidays(y)));
        national = perYear.flat();
      } catch {
        national = [];
      }
      const macae: Holiday[] = years.flatMap((y) =>
        MACAE_HOLIDAYS.map((h) => ({ date: `${y}-${h.date}`, name: h.name, type: 'MUNICIPAL' })),
      );
      setHolidays([...national, ...macae]);

      // Eventos da empresa (requer autenticação) — mesma API do desktop
      if (isAuthenticated) {
        try {
          const token = getToken();
          const res = await fetch(
            `/api/calendar/company/events?from=${range.from}&to=${range.to}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} },
          );
          if (res.status === 401) {
            setCompanyBlocked(true);
            setCompanyEvents([]);
          } else if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          } else {
            const data = await res.json();
            setCompanyEvents(Array.isArray(data.events) ? data.events : []);
          }
        } catch {
          setCompanyEvents([]);
          setError('Não foi possível carregar os eventos da empresa.');
        }
      } else {
        setCompanyEvents([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, range]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const items = useMemo<CalendarItem[]>(() => {
    const hList: CalendarItem[] = holidays
      .filter((h) => h.date >= range.from && h.date <= range.to)
      .map((h) => ({
        key: `h-${h.date}-${h.name}`,
        date: h.date,
        name: h.name,
        allDay: true,
        start: h.date,
        source: 'holiday' as const,
        holidayType: h.type,
      }));
    const cList: CalendarItem[] = companyEvents.map((e) => ({
      key: `c-${e.id}`,
      date: eventStartYmd(e.start),
      name: e.summary,
      description: e.description,
      location: e.location,
      allDay: e.allDay,
      start: e.start,
      source: 'company' as const,
    }));
    return [...hList, ...cList]
      .filter((i) => i.date >= range.from && i.date <= range.to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  }, [holidays, companyEvents, range]);

  const groups = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    items.forEach((item) => {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <MobileShell title="Calendário">
      <div className="flex flex-col gap-3" data-abz-mobile-calendario="">
        {error ? (
          <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
            {error}
            <TouchButton variant="ghost" className="mt-1" onClick={load}>
              Tentar de novo
            </TouchButton>
          </div>
        ) : null}
        {companyBlocked || (!isAuthenticated && !authLoading) ? (
          <p className="abz-m-alert-ok rounded-xl p-3 text-sm" role="status">
            Entre para ver também os eventos da empresa.
          </p>
        ) : null}

        {loading ? (
          <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
        ) : null}

        {!loading && groups.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Nenhum evento nos próximos {WINDOW_DAYS} dias.
          </p>
        ) : null}

        {groups.map(([date, dayItems]) => (
          <section key={date} className="flex flex-col gap-2">
            <h2 className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {formatGroupHeader(date)}
            </h2>
            {dayItems.map((item) => (
              <DataCard
                key={item.key}
                title={item.name}
                subtitle={
                  [item.location, item.description].filter(Boolean).join(' · ') || undefined
                }
                meta={formatEventClock(item.start, item.allDay)}
              >
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.source === 'holiday'
                      ? item.holidayType === 'MUNICIPAL'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {item.source === 'holiday'
                    ? item.holidayType === 'MUNICIPAL'
                      ? 'Feriado municipal'
                      : 'Feriado'
                    : 'Empresa'}
                </span>
              </DataCard>
            ))}
          </section>
        ))}
      </div>
    </MobileShell>
  );
}
