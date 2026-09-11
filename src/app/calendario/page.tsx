'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { FiCalendar, FiClock, FiInfo, FiMapPin, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { dedupeSimilarCalendarEvents } from '@/lib/calendar-event-dedupe';

interface CompanyEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  start: string;
  end?: string;
  allDay?: boolean;
  attendees?: Array<{ email?: string; name?: string }>;
}

interface Holiday {
  date: string;
  name: string;
  type: string;
  description?: string;
}

interface CalendarListItem {
  key: string;
  date: string;
  start: string;
  allDay?: boolean;
  name: string;
  type: string;
  description?: string;
  location?: string;
  url?: string;
  source: 'holiday' | 'company';
  color: string;
  attendees?: Array<{ email?: string; name?: string }>;
}

const MACAE_HOLIDAYS: Omit<Holiday, 'date'>[] = [
  { name: 'São Jorge', type: 'MUNICIPAL', description: 'Feriado Municipal de Macaé' },
  { name: 'São João Batista', type: 'MUNICIPAL', description: 'Feriado Municipal de Macaé' },
  { name: 'Aniversário de Macaé', type: 'MUNICIPAL', description: 'Feriado Municipal de Macaé' },
  { name: 'Consciência Negra', type: 'MUNICIPAL', description: 'Feriado Municipal/Estadual (RJ)' },
];

const UK_HOLIDAYS: Omit<Holiday, 'date'>[] = [
  { name: "New Year's Day", type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Good Friday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Easter Monday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Early May Bank Holiday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Spring Bank Holiday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Summer Bank Holiday', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Christmas Day', type: 'UK', description: 'UK Bank Holiday' },
  { name: 'Boxing Day', type: 'UK', description: 'UK Bank Holiday' },
];

const BRAZILIAN_HOLIDAYS: Record<number, Holiday[]> = {
  2024: [
    { date: '2024-01-01', name: 'Confraternização Universal', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-02-13', name: 'Carnaval', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-03-29', name: 'Sexta-feira Santa', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-04-21', name: 'Tiradentes', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-05-01', name: 'Dia do Trabalho', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-05-30', name: 'Corpus Christi', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-09-07', name: 'Independência do Brasil', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-10-12', name: 'Nossa Senhora Aparecida', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-11-02', name: 'Finados', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-11-15', name: 'Proclamação da República', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2024-12-25', name: 'Natal', type: 'NATIONAL', description: 'Feriado Nacional' },
  ],
  2025: [
    { date: '2025-01-01', name: 'Confraternização Universal', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-03-04', name: 'Carnaval', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-04-18', name: 'Sexta-feira Santa', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-04-21', name: 'Tiradentes', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-05-01', name: 'Dia do Trabalho', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-06-19', name: 'Corpus Christi', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-09-07', name: 'Independência do Brasil', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-10-12', name: 'Nossa Senhora Aparecida', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-11-02', name: 'Finados', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-11-15', name: 'Proclamação da República', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2025-12-25', name: 'Natal', type: 'NATIONAL', description: 'Feriado Nacional' },
  ],
  2026: [
    { date: '2026-01-01', name: 'Confraternização Universal', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-02-17', name: 'Carnaval', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-04-03', name: 'Sexta-feira Santa', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-04-21', name: 'Tiradentes', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-05-01', name: 'Dia do Trabalho', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-06-04', name: 'Corpus Christi', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-09-07', name: 'Independência do Brasil', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-10-12', name: 'Nossa Senhora Aparecida', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-11-02', name: 'Finados', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-11-15', name: 'Proclamação da República', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-11-20', name: 'Consciência Negra', type: 'NATIONAL', description: 'Feriado Nacional' },
    { date: '2026-12-25', name: 'Natal', type: 'NATIONAL', description: 'Feriado Nacional' },
  ],
};

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function eventStartYmd(start: string): string {
  return String(start || '').slice(0, 10);
}

function formatEventClock(start: string, allDay: boolean | undefined, locale: string): string | null {
  if (allDay) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function listItemSourceLabel(
  ev: CalendarListItem,
  t: (key: string) => string,
): string {
  switch (ev.source) {
    case 'company':
      return t('calendario.companyEvents');
    case 'holiday':
      return ev.type === 'MUNICIPAL'
        ? t('calendario.municipalHoliday')
        : t('calendario.nationalHoliday');
    default: {
      const _exhaustive: never = ev.source;
      return _exhaustive;
    }
  }
}

function getMacaeHolidayDate(holidayName: string, year: number): string | null {
  switch (holidayName) {
    case 'São Jorge': return `${year}-04-23`;
    case 'São João Batista': return `${year}-06-24`;
    case 'Aniversário de Macaé': return `${year}-07-29`;
    case 'Consciência Negra': return `${year}-11-20`;
    default: return null;
  }
}

function getUKHolidayDate(holidayName: string, year: number): string | null {
  switch (holidayName) {
    case "New Year's Day": return `${year}-01-01`;
    case 'Good Friday': return year === 2024 ? '2024-03-29' : year === 2025 ? '2025-04-18' : year === 2026 ? '2026-04-03' : `${year}-04-10`;
    case 'Easter Monday': return year === 2024 ? '2024-04-01' : year === 2025 ? '2025-04-21' : year === 2026 ? '2026-04-06' : `${year}-04-13`;
    case 'Early May Bank Holiday': return `${year}-05-04`;
    case 'Spring Bank Holiday': return `${year}-05-25`;
    case 'Summer Bank Holiday': return `${year}-08-31`;
    case 'Christmas Day': return `${year}-12-25`;
    case 'Boxing Day': return `${year}-12-26`;
    default: return null;
  }
}

const BRASIL_API_URL = 'https://brasilapi.com.br/api/feriados/v1/';
const SCRAPE_API_URL = '/api/scrape-holidays';

async function fetchBrasilApiHolidays(year: number): Promise<Holiday[]> {
  const response = await fetch(`${BRASIL_API_URL}${year}`);
  if (!response.ok) throw new Error(`Status ${response.status}`);
  const data = await response.json();
  return data.map((h: { date: string; name: string; type: string }) => ({
    date: h.date,
    name: h.name,
    type: h.type.toUpperCase(),
  }));
}

async function fetchScrapedHolidays(year: number): Promise<Holiday[]> {
  const response = await fetch(`${SCRAPE_API_URL}?year=${year}`);
  if (!response.ok) throw new Error(`Status ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error('Unsuccessful');
  return result.data;
}

export default function CalendarioPage() {
  const { t, locale } = useI18n();
  const [allHolidays, setAllHolidays] = useState<Holiday[]>([]);
  const [companyEvents, setCompanyEvents] = useState<CompanyEvent[]>([]);
  const [companyDuplicatesHidden, setCompanyDuplicatesHidden] = useState(0);
  const [companyConfig, setCompanyConfig] = useState({ marker_color: '#2563eb' });
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = viewDate.getFullYear();
  const selectedYmd = toLocalYmd(selectedDate);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetchWithToken('/api/admin/calendar/company/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.marker_color) setCompanyConfig({ marker_color: data.marker_color });
        }
      } catch {
        // settings opcional
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    const loadCompanyEvents = async () => {
      try {
        const from = `${currentYear}-01-01`;
        const to = `${currentYear}-12-31`;
        const res = await fetchWithToken(`/api/calendar/company/events?from=${from}&to=${to}`);
        const data = await res.json();
        if (Array.isArray(data.events)) {
          setCompanyEvents(data.events);
          setCompanyDuplicatesHidden(
            typeof data.duplicatesHidden === 'number' ? data.duplicatesHidden : 0,
          );
        }
      } catch {
        setCompanyEvents([]);
        setCompanyDuplicatesHidden(0);
      }
    };
    loadCompanyEvents();
  }, [currentYear]);

  useEffect(() => {
    const loadHolidays = async () => {
      setLoading(true);
      setError(null);
      let national: Holiday[] = [];
      try {
        if (locale === 'en-US') {
          const uk: Holiday[] = [];
          UK_HOLIDAYS.forEach((h) => {
            const d = getUKHolidayDate(h.name, currentYear);
            if (d) uk.push({ ...h, date: d });
          });
          national = uk;
        } else {
          try {
            national = await fetchBrasilApiHolidays(currentYear);
          } catch {
            try {
              national = await fetchScrapedHolidays(currentYear);
            } catch {
              national = BRAZILIAN_HOLIDAYS[currentYear] || BRAZILIAN_HOLIDAYS[2026] || [];
            }
          }
        }

        const holidaysMap = new Map<string, Holiday>();
        national.forEach((h) => holidaysMap.set(`${h.date}${h.name}`, h));

        if (locale === 'pt-BR') {
          MACAE_HOLIDAYS.forEach((h) => {
            const d = getMacaeHolidayDate(h.name, currentYear);
            if (d) holidaysMap.set(`${d}${h.name}`, { ...h, date: d });
          });
        }

        setAllHolidays(Array.from(holidaysMap.values()).sort((a, b) => a.date.localeCompare(b.date)));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t('calendario.couldNotLoadHolidays'));
        setAllHolidays([]);
      } finally {
        setLoading(false);
      }
    };
    loadHolidays();
  }, [currentYear, locale, t]);

  const companyDedupe = useMemo(
    () => dedupeSimilarCalendarEvents(companyEvents),
    [companyEvents],
  );
  const uniqueCompanyEvents = companyDedupe.events;

  const getEventsForDate = useCallback((date: Date) => {
    const dStr = toLocalYmd(date);
    const holidays = allHolidays.filter((h) => h.date === dStr);
    const company = uniqueCompanyEvents.filter((e) => eventStartYmd(e.start) === dStr);
    return { holidays, company };
  }, [allHolidays, uniqueCompanyEvents]);

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;
    const { holidays, company } = getEventsForDate(date);
    if (!holidays.length && !company.length) return null;

    return (
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex justify-center gap-1 flex-wrap max-w-full px-1">
        {holidays.length > 0 && (
          <span
            className={`h-1.5 w-1.5 rounded-full ${holidays.some((h) => h.type === 'MUNICIPAL') ? 'bg-amber-500' : 'bg-sky-500'}`}
            title={holidays.map((h) => h.name).join(', ')}
          />
        )}
        {company.map((e) => (
          <span
            key={e.id}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: companyConfig.marker_color }}
            title={e.summary}
          />
        ))}
      </div>
    );
  };

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;
    const classes = ['relative'];
    const { holidays, company } = getEventsForDate(date);
    if (holidays.length || company.length) classes.push('font-semibold');
    if (toLocalYmd(date) === selectedYmd) classes.push('calendar-day-selected');
    return classes.join(' ');
  };

  const eventsThisMonth = useMemo<CalendarListItem[]>(() => {
    const m = viewDate.getMonth();
    const y = viewDate.getFullYear();

    const hList: CalendarListItem[] = allHolidays
      .filter((h) => {
        const [hy, hm] = h.date.split('-').map(Number);
        return hy === y && hm === m + 1;
      })
      .map((h) => ({
        key: `h-${h.date}-${h.name}`,
        date: h.date,
        start: h.date,
        allDay: true,
        name: h.name,
        type: h.type,
        description: h.description,
        source: 'holiday' as const,
        color: h.type === 'MUNICIPAL' ? '#f59e0b' : '#0ea5e9',
      }));

    const cList: CalendarListItem[] = uniqueCompanyEvents
      .filter((e) => {
        const ymd = eventStartYmd(e.start);
        const [ey, em] = ymd.split('-').map(Number);
        return ey === y && em === m + 1;
      })
      .map((e) => ({
        key: `c-${e.id}`,
        date: eventStartYmd(e.start),
        start: e.start,
        allDay: e.allDay,
        name: e.summary,
        type: 'EMPRESA',
        description: e.description,
        location: e.location,
        url: e.url,
        source: 'company' as const,
        color: companyConfig.marker_color,
        attendees: e.attendees,
      }));

    const merged = dedupeSimilarCalendarEvents([...hList, ...cList]);
    return Array.from(merged.events).sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.start.localeCompare(b.start);
    });
  }, [allHolidays, uniqueCompanyEvents, viewDate, companyConfig.marker_color]);

  const displayDuplicatesHidden = useMemo(() => {
    const m = viewDate.getMonth();
    const y = viewDate.getFullYear();
    const holidayCount = allHolidays.filter((h) => {
      const [hy, hm] = h.date.split('-').map(Number);
      return hy === y && hm === m + 1;
    }).length;
    const companyCount = uniqueCompanyEvents.filter((e) => {
      const ymd = eventStartYmd(e.start);
      const [ey, em] = ymd.split('-').map(Number);
      return ey === y && em === m + 1;
    }).length;
    return Math.max(0, holidayCount + companyCount - eventsThisMonth.length);
  }, [allHolidays, uniqueCompanyEvents, eventsThisMonth, viewDate]);

  const duplicatesHidden =
    Math.max(companyDuplicatesHidden, companyDedupe.hidden) + displayDuplicatesHidden;

  const selectedDayEvents = useMemo(
    () => eventsThisMonth.filter((ev) => ev.date === selectedYmd),
    [eventsThisMonth, selectedYmd],
  );

  const monthLabel = viewDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <MainLayout>
      <div className="flex flex-col min-h-0 flex-1 h-full gap-6">
        <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-50 text-abz-blue rounded-xl">
              <FiCalendar className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-gray-900">{t('calendario.title')}</h1>
              <p className="text-sm text-gray-500">{t('calendario.description')}</p>
            </div>
          </div>
        </div>

        {error && !loading && (
          <div className="shrink-0 p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl flex items-center gap-2">
            <FiInfo className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-auto lg:overflow-hidden">
          <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs overflow-auto min-h-0">
            {loading && (
              <p className="text-center text-gray-500 text-sm mb-4 flex items-center justify-center gap-2">
                <FiRefreshCw className="animate-spin" />
                {t('calendario.loading')}
              </p>
            )}
            <Calendar
              onChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                if (next instanceof Date) {
                  setSelectedDate(next);
                  setViewDate(next);
                }
              }}
              value={selectedDate}
              onActiveStartDateChange={({ activeStartDate }) => {
                if (
                  activeStartDate &&
                  (activeStartDate.getFullYear() !== viewDate.getFullYear() ||
                    activeStartDate.getMonth() !== viewDate.getMonth())
                ) {
                  setViewDate(activeStartDate);
                }
              }}
              activeStartDate={viewDate}
              tileContent={tileContent}
              tileClassName={tileClassName}
              locale={locale}
              className="w-full border-none portal-calendar"
              showNeighboringMonth={false}
            />

            <div className="flex flex-wrap justify-center gap-4 mt-6 pt-4 border-t border-gray-100 text-xs font-medium text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                {t('calendario.nationalHoliday')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {t('calendario.municipalHoliday')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: companyConfig.marker_color }} />
                {t('calendario.companyEvents')}
              </span>
            </div>
          </div>

          <div className="lg:col-span-1 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col min-h-[28rem] lg:min-h-0">
            <h2 className="text-lg font-bold text-gray-900 mb-1 capitalize">
              {t('calendario.holidaysInMonth')} {monthLabel}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {t('calendario.sharedOnlyHint')}
              {duplicatesHidden > 0 && (
                <span className="block mt-1 text-gray-400">
                  {t('calendario.duplicatesHiddenHint', { count: duplicatesHidden })}
                </span>
              )}
            </p>

            {selectedDayEvents.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50/80 border border-blue-100">
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700 mb-2">
                  {selectedDate.toLocaleDateString(locale, { day: '2-digit', month: 'long' })}
                </p>
                <ul className="space-y-1.5">
                  {selectedDayEvents.map((ev) => (
                    <li key={`sel-${ev.key}`} className="text-sm font-semibold text-gray-900">
                      {ev.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!loading && eventsThisMonth.length === 0 && (
              <p className="text-gray-500 text-sm italic">{t('calendario.noEventsThisMonth')}</p>
            )}

            <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
              {eventsThisMonth.map((ev) => {
                const isSelected = ev.date === selectedYmd;
                const day = ev.date.slice(8, 10);
                const clock = formatEventClock(ev.start, ev.allDay, locale);
                return (
                  <li
                    key={ev.key}
                    className={`text-sm border-l-4 pl-3 py-2.5 pr-2 rounded-r-xl transition ${
                      isSelected ? 'bg-blue-50 ring-1 ring-blue-100' : 'bg-gray-50'
                    }`}
                    style={{ borderLeftColor: ev.color }}
                  >
                    <span className="font-bold block text-gray-900">
                      {day} — {ev.name}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {listItemSourceLabel(ev, t)}
                    </span>
                    {clock && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <FiClock className="w-3 h-3" /> {clock}
                      </p>
                    )}
                    {ev.location && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <FiMapPin className="w-3 h-3" /> {ev.location}
                      </p>
                    )}
                    {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .portal-calendar.react-calendar { width: 100%; border: none; font-family: inherit; background: transparent; }
        .portal-calendar .react-calendar__navigation { margin-bottom: 0.75rem; }
        .portal-calendar .react-calendar__navigation button {
          color: #111827; min-width: 44px; background: none; font-size: 1rem; font-weight: 800; padding: 10px 0; border-radius: 0.75rem;
        }
        .portal-calendar .react-calendar__navigation button:disabled { background-color: #f9fafb; color: #9ca3af; }
        .portal-calendar .react-calendar__navigation button:enabled:hover,
        .portal-calendar .react-calendar__navigation button:enabled:focus { background-color: #eff6ff; }
        .portal-calendar .react-calendar__month-view__weekdays {
          text-align: center; text-transform: uppercase; font-weight: 700; font-size: 0.7rem; letter-spacing: 0.04em; color: #2563eb; padding-bottom: 0.5em;
        }
        .portal-calendar .react-calendar__month-view__weekdays__weekday { padding: 0.5em; }
        .portal-calendar .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; }
        .portal-calendar .react-calendar__month-view__days__day--weekend { color: #dc2626; }
        .portal-calendar .react-calendar__tile {
          max-width: 100%; padding: 12px 6px; background: none; text-align: center; line-height: 1.4;
          font-size: 0.875rem; height: 64px; display: flex; flex-direction: column; justify-content: flex-start; align-items: center;
          border-radius: 0.75rem;
        }
        .portal-calendar .react-calendar__tile:enabled:hover,
        .portal-calendar .react-calendar__tile:enabled:focus { background-color: #eff6ff; }
        .portal-calendar .react-calendar__tile--now { background: #fff7ed; font-weight: 700; }
        .portal-calendar .react-calendar__tile--now:enabled:hover { background: #ffedd5; }
        .portal-calendar .react-calendar__tile--active,
        .portal-calendar .calendar-day-selected {
          background: #2563eb !important; color: white !important;
        }
        .portal-calendar .react-calendar__tile--active:enabled:hover,
        .portal-calendar .calendar-day-selected:enabled:hover { background: #1d4ed8 !important; }
        .portal-calendar .react-calendar__tile.relative abbr { position: relative; z-index: 1; }
      `}</style>
    </MainLayout>
  );
}
