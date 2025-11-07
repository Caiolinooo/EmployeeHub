import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const SETTINGS_KEY = 'company_calendar';

const defaults = {
  ics_url: '',
  notify_minutes_before: 60,
  extra_recipients: [] as string[],
  marker_color: '#6339F5'
};

function deriveIcsFromGcalUrl(input?: string | null): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    // Try cid param
    const cid = url.searchParams.get('cid');
    if (cid) {
      // Public ICS pattern
      return `https://calendar.google.com/calendar/ical/${encodeURIComponent(cid)}/public/basic.ics`;
    }
    // If already looks like ICS
    if (/\.ics($|\?)/i.test(input) || input.includes('/ical/')) return input;
  } catch {}
  return null;
}

export const GET = withPermission('manager', async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      console.warn('company_calendar GET error, using defaults:', error);
      return NextResponse.json(defaults);
    }

    const value = (data?.value as any) || {};
    return NextResponse.json({ ...defaults, ...value });
  } catch (e) {
    console.error('company_calendar GET fatal', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
});

export const PUT = withPermission('manager', async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    let { ics_url, gcal_url, notify_minutes_before, extra_recipients, marker_color } = body || {};

    // If admin pasted a Google Calendar page URL, derive ICS
    if ((!ics_url || typeof ics_url !== 'string' || !ics_url.includes('.ics')) && typeof gcal_url === 'string') {
      const derived = deriveIcsFromGcalUrl(gcal_url);
      if (derived) ics_url = derived;
    }

    const value = {
      ics_url: typeof ics_url === 'string' ? ics_url : '',
      notify_minutes_before: typeof notify_minutes_before === 'number' ? notify_minutes_before : defaults.notify_minutes_before,
      extra_recipients: Array.isArray(extra_recipients) ? extra_recipients : defaults.extra_recipients,
      marker_color: typeof marker_color === 'string' && /^#?[0-9a-fA-F]{6}$/.test(marker_color)
        ? (marker_color.startsWith('#') ? marker_color : `#${marker_color}`)
        : defaults.marker_color
    };

    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({ key: SETTINGS_KEY, value, description: 'Configurações do calendário da empresa (ICS)' }, { onConflict: 'key' });

    if (error) {
      console.error('company_calendar PUT error', error);
      return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 });
    }

    return NextResponse.json(value);
  } catch (e) {
    console.error('company_calendar PUT fatal', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
});

