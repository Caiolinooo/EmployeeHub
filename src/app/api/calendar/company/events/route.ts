import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseIcs, IcsEvent } from '@/lib/ics';

// Simple in-memory cache (per lambda instance)
let CACHE: { ts: number; events: IcsEvent[] } | null = null;

function deriveIcsFromGcalUrl(input?: string | null): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    const cid = url.searchParams.get('cid');
    if (cid) {
      return `https://calendar.google.com/calendar/ical/${encodeURIComponent(cid)}/public/basic.ics`;
    }
    if (/\.ics($|\?)/i.test(input) || input.includes('/ical/')) return input;
  } catch {}
  return null;
}

// Default Google Calendar page URL provided by admin; we derive ICS if settings are empty
const DEFAULT_GCAL_URL = "https://calendar.google.com/calendar/u/0?cid=ZWZmMWE1NDE0ZDIzODc2ZWZkNjhkMzUzYTE4YTg1ZTgwZGQ0M2ZmM2FmZTBhM2MyMGU3ZmZmZjUxY2Q2NGUyZkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rangeDays = parseInt(searchParams.get('rangeDays') || '60');
    const force = searchParams.get('force') === '1';
    const directUrl = searchParams.get('url');
    const directGcal = searchParams.get('gcal');

    let icsUrl: string | null = directUrl || (directGcal ? deriveIcsFromGcalUrl(directGcal) : null);
    if (!icsUrl) {
      // Try settings key 'company_calendar'
      const { data } = await supabaseAdmin.from('settings').select('value').eq('key', 'company_calendar').maybeSingle();
      const v = (data as any)?.value || {};
      icsUrl = v.ics_url || deriveIcsFromGcalUrl(v.gcal_url) || process.env.COMPANY_CALENDAR_ICS_URL || deriveIcsFromGcalUrl(DEFAULT_GCAL_URL) || null;
    }

    if (!icsUrl) {
      return NextResponse.json({ error: 'ICS URL não configurada. Defina em settings (key=company_calendar, value.ics_url) ou variável de ambiente COMPANY_CALENDAR_ICS_URL.' }, { status: 400 });
    }

    if (CACHE && !force && Date.now() - CACHE.ts < 1000 * 60 * 5) {
      // serve cached (5 min)
      const events = CACHE.events;
      return NextResponse.json({ events });
    }

    const res = await fetch(icsUrl, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: `Falha ao baixar ICS (${res.status})` }, { status: 502 });
    const icsText = await res.text();

    let events = parseIcs(icsText);
    // Filter by date range
    const now = new Date();
    const max = new Date();
    max.setDate(max.getDate() + rangeDays);
    events = events.filter(e => {
      const start = new Date(e.start);
      return start >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && start <= max;
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    CACHE = { ts: Date.now(), events };

    return NextResponse.json({ events });
  } catch (e: any) {
    console.error('company/events GET error', e);
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

