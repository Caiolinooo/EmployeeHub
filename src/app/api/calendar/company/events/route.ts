import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseIcs, IcsEvent } from '@/lib/ics';
import { dedupeSimilarCalendarEvents } from '@/lib/calendar-event-dedupe';

export const dynamic = 'force-dynamic';

// Simple in-memory cache (per lambda instance)
let CACHE: { key: string; ts: number; events: IcsEvent[]; duplicatesHidden: number } | null = null;

function deriveIcsFromGcalUrl(input?: string | null): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    const cid = url.searchParams.get('cid');
    if (cid) {
      return `https://calendar.google.com/calendar/ical/${encodeURIComponent(cid)}/public/basic.ics`;
    }
    if (/\.ics($|\?)/i.test(input) || input.includes('/ical/')) return input;
  } catch { }
  return null;
}

// Default Google Calendar page URL provided by admin; we derive ICS if settings are empty
const DEFAULT_GCAL_URL = "https://calendar.google.com/calendar/u/0?cid=YWJ6Lm1pZGlhQGdtYWlsLmNvbQ";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rangeDays = parseInt(searchParams.get('rangeDays') || '365', 10);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const force = searchParams.get('force') === '1';
    const directUrl = searchParams.get('url');
    const directGcal = searchParams.get('gcal');

    let icsUrl: string | null = directUrl || (directGcal ? deriveIcsFromGcalUrl(directGcal) : null);
    if (!icsUrl) {
      // Try settings key 'company_calendar'
      const { data } = await supabaseAdmin.from('settings').select('value').eq('key', 'company_calendar').maybeSingle();
      const v = (data as any)?.value || {};
      icsUrl = v.ics_url || deriveIcsFromGcalUrl(v.gcal_url) || process.env.COMPANY_CALENDAR_ICS_URL || deriveIcsFromGcalUrl(DEFAULT_GCAL_URL) || null;
      if (!v.ics_url && !process.env.COMPANY_CALENDAR_ICS_URL) {
        console.log('Utilizando fallback para URL do calendário (DEFAULT_GCAL_URL)');
      }
    }

    if (!icsUrl) {
      return NextResponse.json({ error: 'ICS URL não configurada. Defina em settings (key=company_calendar, value.ics_url) ou variável de ambiente COMPANY_CALENDAR_ICS_URL.' }, { status: 400 });
    }

    const cacheKey = `${icsUrl}|${fromParam || ''}|${toParam || ''}|${rangeDays}`;
    if (CACHE && CACHE.key === cacheKey && !force && Date.now() - CACHE.ts < 1000 * 60 * 5) {
      return NextResponse.json({ events: CACHE.events, duplicatesHidden: CACHE.duplicatesHidden });
    }

    const res = await fetch(icsUrl, { cache: 'no-store' });
    if (!res.ok) {
      const errorMsg = res.status === 404
        ? "Falha ao baixar ICS (404). Verifique se o calendário está público (Configurações → Acesso → Disponibilizar ao público)."
        : `Falha ao baixar ICS (${res.status})`;
      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }
    const icsText = await res.text();

    let events = await parseIcs(icsText);
    const now = new Date();
    const min = fromParam
      ? new Date(`${fromParam}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const max = toParam
      ? new Date(`${toParam}T23:59:59`)
      : (() => {
          const d = new Date(min);
          d.setDate(d.getDate() + rangeDays);
          return d;
        })();
    events = events.filter((e) => {
      const start = new Date(e.start);
      return start >= min && start <= max;
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const deduped = dedupeSimilarCalendarEvents(events);
    events = deduped.events;

    CACHE = { key: cacheKey, ts: Date.now(), events, duplicatesHidden: deduped.hidden };

    return NextResponse.json({
      events,
      duplicatesHidden: deduped.hidden,
    });
  } catch (e: any) {
    console.error('company/events GET error', e);
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

