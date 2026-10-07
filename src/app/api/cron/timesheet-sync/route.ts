import { NextRequest, NextResponse } from 'next/server';
import { isAdminFromRequest } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { reconcileVinculos, type ReconcileVinculoResult } from '@/lib/timesheet-integration/vinculo';
import {
  drainOutbox,
  getQueueStatus,
  reconcileTimesheetSync,
  reprocessDeadJobs,
  type ReconcileResult,
} from '@/lib/timesheet-integration/worker';

export const dynamic = 'force-dynamic';

/**
 * Cron da integração Time-Sheet (design §9 — fluxos 1/6/7).
 * Registrado em vercel.json como `0 4 * * *` (reconciliação noturna + drena).
 *
 * Auth: `x-vercel-cron-secret === CRON_SECRET` ou Bearer admin
 * (verifyRequestToken via isAdminFromRequest).
 *
 * GET  (Vercel Cron)  → drain + reconciliação.
 * GET  (admin Bearer) → apenas status da fila.
 * POST { reprocessDead?: boolean, reconcile?: boolean, limit?: number }
 *                    → admin/cron; "Sincronizar agora" = POST sem corpo;
 *                      "Reprocessar" = POST { reprocessDead: true }.
 */
async function authorize(request: NextRequest): Promise<{ viaCron: boolean } | null> {
  const cronSecret = request.headers.get('x-vercel-cron-secret');
  if (process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return { viaCron: true };
  }
  const admin = await isAdminFromRequest(request);
  if (admin.isAdmin) return { viaCron: false };
  return null;
}

async function run(
  request: NextRequest,
  options: { reprocessDead: boolean; reconcile: boolean; limit: number },
): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    let reprocessed = 0;
    if (options.reprocessDead) {
      reprocessed = await reprocessDeadJobs();
      console.log(`🔄 [timesheet-sync] ${reprocessed} job(s) dead reprocessado(s)`);
    }
    let reconcile: ReconcileResult | null = null;
    let vinculo: ReconcileVinculoResult | null = null;
    if (options.reconcile) {
      vinculo = await reconcileVinculos(await getSupabaseAdmin());
      console.log(
        `🔗 [timesheet-sync] vínculo: checked=${vinculo.checked} user=${vinculo.userLinked} folha=${vinculo.folhaLinked} enqueued=${vinculo.enqueued}`,
      );
    }
    const drain = await drainOutbox(options.limit);
    console.log(
      `✅ [timesheet-sync] drain: ok=${drain.ok} failed=${drain.failed} dead=${drain.dead}`,
    );

    if (options.reconcile) {
      reconcile = await reconcileTimesheetSync();
      console.log(
        `🌙 [timesheet-sync] reconciliação: checked=${reconcile.checked} enqueued=${reconcile.enqueued} skipped=${reconcile.skipped} aborted=${reconcile.aborted}`,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        reprocessed,
        drain,
        vinculo,
        reconcile,
        tempo_execucao_ms: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('❌ [timesheet-sync] erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao sincronizar Time-Sheet',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  // Admin via Bearer: status da fila para a UI. Vercel Cron: run completo.
  if (!auth.viaCron) {
    try {
      const fila = await getQueueStatus();
      return NextResponse.json({ success: true, data: { fila } });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao ler status da fila',
        },
        { status: 500 },
      );
    }
  }

  return run(request, { reprocessDead: false, reconcile: true, limit: 25 });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  let body: { reprocessDead?: boolean; reconcile?: boolean; limit?: number } = {};
  const raw = await request.text();
  if (raw && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as typeof body;
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Corpo JSON inválido' }, { status: 400 });
    }
  }

  const limit =
    typeof body.limit === 'number' && Number.isFinite(body.limit)
      ? Math.max(1, Math.min(200, Math.floor(body.limit)))
      : 25;

  return run(request, {
    reprocessDead: body.reprocessDead === true,
    reconcile: body.reconcile === true || auth.viaCron,
    limit,
  });
}
