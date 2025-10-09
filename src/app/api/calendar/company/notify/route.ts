import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseIcs } from '@/lib/ics';
import { sendEmail } from '@/lib/email-service';

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

const DEFAULT_GCAL_URL = "https://calendar.google.com/calendar/u/0?cid=ZWZmMWE1NDE0ZDIzODc2ZWZkNjhkMzUzYTE4YTg1ZTgwZGQ0M2ZmM2FmZTBhM2MyMGU3ZmZmZjUxY2Q2NGUyZkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t";

async function getCalendarSettings() {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', 'company_calendar').maybeSingle();
  const v = (data as any)?.value || {};
  return {
    icsUrl: v.ics_url || deriveIcsFromGcalUrl(v.gcal_url) || process.env.COMPANY_CALENDAR_ICS_URL || deriveIcsFromGcalUrl(DEFAULT_GCAL_URL) || null,
    notifyMinutes: typeof v.notify_minutes_before === 'number' ? v.notify_minutes_before : 60,
    extraRecipients: Array.isArray(v.extra_recipients) ? v.extra_recipients as string[] : []
  };
}

export async function POST(req: NextRequest) {
  try {
    const { icsUrl, notifyMinutes, extraRecipients } = await getCalendarSettings();
    if (!icsUrl) return NextResponse.json({ error: 'ICS URL não configurada' }, { status: 400 });

    const now = new Date();
    const windowEnd = new Date(now.getTime() + notifyMinutes * 60 * 1000);

    const res = await fetch(icsUrl, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: `Falha ao baixar ICS (${res.status})` }, { status: 502 });
    const icsText = await res.text();
    const events = await parseIcs(icsText);

    const upcoming = events.filter(evt => {
      const start = new Date(evt.start);
      return start >= now && start <= windowEnd;
    });

    let sent = 0;
    for (const evt of upcoming) {
      const recipients = (evt.attendees?.map(a => a.email).filter(Boolean) || []).concat(extraRecipients);
      const uniqueRecipients = Array.from(new Set(recipients)).filter(Boolean);
      if (uniqueRecipients.length === 0) continue;

      const start = new Date(evt.start);
      const end = evt.end ? new Date(evt.end) : undefined;
      const when = `${start.toLocaleDateString('pt-BR')} ${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` + (end ? ` - ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '');

      const subject = `Lembrete: ${evt.summary} às ${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const html = `
        <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
          <h2 style="margin:0 0 8px 0">${evt.summary}</h2>
          <p style="margin:4px 0;color:#444"><strong>Quando:</strong> ${when}</p>
          ${evt.location ? `<p style="margin:4px 0;color:#444"><strong>Local:</strong> ${evt.location}</p>` : ''}
          ${evt.organizer?.name || evt.organizer?.email ? `<p style=\"margin:4px 0;color:#444\"><strong>Organizador:</strong> ${evt.organizer?.name || ''} ${evt.organizer?.email || ''}</p>` : ''}
          ${evt.description ? `<pre style=\"white-space:pre-wrap;background:#f7f7f7;padding:8px;border-radius:6px\">${evt.description}</pre>` : ''}
        </div>`;
      const text = `${evt.summary}\nQuando: ${when}\n${evt.location ? `Local: ${evt.location}\n` : ''}${evt.description || ''}`;

      const result = await sendEmail(uniqueRecipients, subject, text, html);
      if (result.success) sent++;
    }

    return NextResponse.json({ ok: true, upcoming: upcoming.length, emailsSent: sent });
  } catch (e: any) {
    console.error('company/notify error', e);
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

