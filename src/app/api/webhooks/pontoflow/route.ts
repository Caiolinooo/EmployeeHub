import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCredential } from '@/lib/secure-credentials';
import { empresaCredentialKeys } from '@/lib/timesheet-integration/settings';
import { verifyWebhook } from '@/lib/timesheet-integration/webhooks';
import { aplicarHorasAprovadas } from '@/lib/timesheet-integration/folha-aplicar';
import { parseRubricaLines } from '@/lib/timesheet-integration/folha-lancamento';

export const dynamic = 'force-dynamic';

/**
 * Ingress de webhooks PontoFlow → Portal (design §4/§8 — D5: só resumo derivado).
 * Assinatura `X-PontoFlow-Signature: t=<unix>,v1=<hmac_sha256(t.body)>` com o
 * segredo da empresa resolvida por externalId → ts_people_map → empresa_id →
 * app_secrets `timesheet.<empresa_id>.webhook_secret`. Skew > 5 min ou HMAC
 * inválido ⇒ 401. Entrega at-least-once: dedup por event.id em
 * ts_webhook_events_seen (replay = no-op 200).
 */

interface WebhookEvent {
  id: string;
  type: string;
  externalId: string;
  at?: string;
  timesheetId?: string;
  periodStart?: string;
  periodEnd?: string;
  workedDays?: number;
  workedMinutes?: number;
  lines?: unknown;
}

function parseEvent(raw: string): WebhookEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const id = 'id' in parsed && typeof parsed.id === 'string' ? parsed.id : '';
    const type = 'type' in parsed && typeof parsed.type === 'string' ? parsed.type : '';
    const externalId =
      'externalId' in parsed && typeof parsed.externalId === 'string' ? parsed.externalId : '';
    if (!id || !type || !externalId) return null;
    return parsed as WebhookEvent;
  } catch {
    return null;
  }
}

async function upsertResumo(
  event: WebhookEvent,
  status: string,
  worked: { days: number | null; minutes: number | null },
): Promise<void> {
  if (!event.timesheetId || !event.periodStart || !event.periodEnd) return;
  const admin = await getSupabaseAdmin();
  const { error } = await admin.from('ts_timesheet_resumo').upsert(
    {
      colaborador_id: event.externalId,
      period_start: event.periodStart,
      period_end: event.periodEnd,
      ts_timesheet_id: event.timesheetId,
      status,
      worked_days: worked.days,
      worked_minutes: worked.minutes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'colaborador_id,period_start,period_end' },
  );
  if (error) throw new Error(`ts_timesheet_resumo upsert: ${error.message}`);
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  const admin = await getSupabaseAdmin();
  switch (event.type) {
    case 'timesheet.approved':
      await upsertResumo(event, 'aprovado', {
        days: typeof event.workedDays === 'number' ? event.workedDays : null,
        minutes: typeof event.workedMinutes === 'number' ? event.workedMinutes : null,
      });
      if (event.periodStart && event.periodEnd) {
        await aplicarHorasAprovadas(admin, {
          externalId: event.externalId,
          periodStart: event.periodStart,
          periodEnd: event.periodEnd,
          lines: parseRubricaLines(event.lines),
        });
      }
      break;
    case 'timesheet.submitted':
      await upsertResumo(event, 'enviado', { days: null, minutes: null });
      break;
    case 'timesheet.rejected':
      await upsertResumo(event, 'recusado', { days: null, minutes: null });
      break;
    case 'period.locked':
      if (event.periodStart && event.periodEnd) {
        const { error } = await admin
          .from('ts_timesheet_resumo')
          .update({ status: 'bloqueado', updated_at: new Date().toISOString() })
          .eq('colaborador_id', event.externalId)
          .eq('period_start', event.periodStart)
          .eq('period_end', event.periodEnd);
        if (error) throw new Error(`ts_timesheet_resumo lock: ${error.message}`);
      }
      break;
    case 'person.provisioned':
      await admin
        .from('gt_colaboradores')
        .update({
          timesheet_sync_status: 'active',
          timesheet_sync_error: null,
          timesheet_synced_at: new Date().toISOString(),
        })
        .eq('id', event.externalId);
      break;
    case 'person.deactivated':
      await admin
        .from('gt_colaboradores')
        .update({
          timesheet_sync_status: 'inactive',
          timesheet_sync_error: null,
          timesheet_synced_at: new Date().toISOString(),
        })
        .eq('id', event.externalId);
      break;
    default:
      console.warn(`[webhooks/pontoflow] tipo de evento ignorado: ${event.type}`);
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-pontoflow-signature') || '';

  const event = parseEvent(rawBody);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Payload inválido' }, { status: 400 });
  }

  // Resolve a empresa pelo externalId (= gt_colaboradores.id) via people_map.
  const admin = await getSupabaseAdmin();
  const { data: mapRow, error: mapError } = await admin
    .from('ts_people_map')
    .select('empresa_id')
    .eq('colaborador_id', event.externalId)
    .maybeSingle();
  if (mapError) {
    console.error('[webhooks/pontoflow] erro ao resolver empresa:', mapError.message);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
  if (!mapRow) {
    return NextResponse.json(
      { success: false, error: 'externalId desconhecido' },
      { status: 404 },
    );
  }

  const secret = await getCredential(
    empresaCredentialKeys(String(mapRow.empresa_id)).webhookSecret,
  );
  if (!secret) {
    console.error(
      `[webhooks/pontoflow] webhook_secret não configurado para empresa ${mapRow.empresa_id}`,
    );
    return NextResponse.json(
      { success: false, error: 'Webhook não configurado' },
      { status: 500 },
    );
  }

  if (!verifyWebhook(rawBody, signature, secret, 300)) {
    return NextResponse.json({ success: false, error: 'Assinatura inválida' }, { status: 401 });
  }

  // Dedup at-least-once: replay do mesmo event.id = no-op.
  const { error: seenError } = await admin
    .from('ts_webhook_events_seen')
    .insert({ event_id: event.id });
  if (seenError) {
    if (seenError.code === '23505') {
      return NextResponse.json({ success: true, data: { deduplicado: true } });
    }
    console.error('[webhooks/pontoflow] erro no dedup:', seenError.message);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    await admin.from('ts_webhook_events_seen').delete().eq('event_id', event.id);
    console.error(`[webhooks/pontoflow] erro ao processar ${event.type}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao processar evento',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { processado: event.type } });
}
