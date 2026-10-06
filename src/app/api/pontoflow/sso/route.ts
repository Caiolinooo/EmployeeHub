import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTimesheetClient, TimesheetApiError } from '@/lib/timesheet-integration/client';
import { getEmpresaConfig } from '@/lib/timesheet-integration/settings';

export const dynamic = 'force-dynamic';

/**
 * SSO Portal → Time-Sheet (design §4/§9 — fluxo 4).
 * A mesma rota serve web e app mobile (auth via Bearer — verifyRequestToken).
 *
 * POST → cria link SSO de uso único (60 s) no TS e devolve { success, data: { url, expiresAt } }.
 *        Flag inativa ⇒ 403 com aviso "cadastro não habilitado para Time Sheet".
 * GET  → estado para a tela /ponto: { habilitado, syncStatus, resumo } (resumo =
 *        último período de ts_timesheet_resumo; nunca batida bruta — D5).
 */

interface ColaboradorSsoRow {
  id: string;
  empresa_id: string | null;
  contabilizar_timesheet: boolean | null;
  timesheet_sync_status: string | null;
}

function tokenUserId(request: NextRequest): string | null {
  const result = verifyRequestToken(request);
  if (!result.valid || !result.payload) return null;
  const p = result.payload;
  return p.userId || p.user_id || p.sub || p.id || null;
}

async function loadColaborador(userId: string): Promise<ColaboradorSsoRow | null> {
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from('gt_colaboradores')
    .select('id, empresa_id, contabilizar_timesheet, timesheet_sync_status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`gt_colaboradores: ${error.message}`);
  return (data as ColaboradorSsoRow | null) ?? null;
}

async function resolveHabilitacao(colab: ColaboradorSsoRow): Promise<{
  habilitado: boolean;
  motivo: string | null;
}> {
  if (colab.contabilizar_timesheet !== true) {
    return { habilitado: false, motivo: 'flag_inativa' };
  }
  if (!colab.empresa_id) {
    return { habilitado: false, motivo: 'sem_empresa' };
  }
  const cfg = await getEmpresaConfig(colab.empresa_id);
  if (!cfg || !cfg.enabled) {
    return { habilitado: false, motivo: 'empresa_sem_tenant' };
  }
  return { habilitado: true, motivo: null };
}

export async function GET(request: NextRequest) {
  const userId = tokenUserId(request);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const colab = await loadColaborador(userId);
    if (!colab) {
      return NextResponse.json(
        { success: false, error: 'Colaborador não encontrado para este usuário' },
        { status: 404 },
      );
    }

    const { habilitado, motivo } = await resolveHabilitacao(colab);

    let resumo: unknown = null;
    if (colab.contabilizar_timesheet === true) {
      const admin = await getSupabaseAdmin();
      const { data } = await admin
        .from('ts_timesheet_resumo')
        .select('period_start, period_end, status, worked_days, worked_minutes, updated_at')
        .eq('colaborador_id', colab.id)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      resumo = data ?? null;
    }

    return NextResponse.json({
      success: true,
      data: {
        habilitado,
        motivo,
        syncStatus: colab.timesheet_sync_status || 'none',
        resumo,
      },
    });
  } catch (error) {
    console.error('[pontoflow/sso] GET erro:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = tokenUserId(request);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const colab = await loadColaborador(userId);
    if (!colab) {
      return NextResponse.json(
        { success: false, error: 'Colaborador não encontrado para este usuário' },
        { status: 404 },
      );
    }

    const { habilitado, motivo } = await resolveHabilitacao(colab);
    if (!habilitado) {
      return NextResponse.json(
        {
          success: false,
          error: 'Seu cadastro não está habilitado para Time Sheet',
          data: { motivo },
        },
        { status: 403 },
      );
    }

    const client = await getTimesheetClient(String(colab.empresa_id));
    const link = await client.createSsoLink({ externalId: colab.id });

    return NextResponse.json({ success: true, data: link });
  } catch (error) {
    console.error('[pontoflow/sso] POST erro:', error);
    if (error instanceof TimesheetApiError && error.status === 404) {
      return NextResponse.json(
        { success: false, error: 'Cadastro inativo no Time-Sheet. Aguarde a sincronização.' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
