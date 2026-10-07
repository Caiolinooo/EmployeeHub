import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTimesheetClient, TimesheetApiError } from '@/lib/timesheet-integration/client';
import {
  createSupabaseVinculoStore,
  resolveVinculoByUser,
  type VinculoResolvido,
} from '@/lib/timesheet-integration/vinculo';

export const dynamic = 'force-dynamic';

/**
 * SSO Portal → Time-Sheet.
 * GET devolve a cadeia (login, ponto, folha, empresa) mesmo incompleta.
 * POST só abre o Time Sheet com a cadeia completa.
 */

function tokenUserId(request: NextRequest): string | null {
  const result = verifyRequestToken(request);
  if (!result.valid || !result.payload) return null;
  const p = result.payload;
  return p.userId || p.user_id || p.sub || p.id || null;
}

function vinculoPayload(vinculo: VinculoResolvido) {
  return {
    habilitado: vinculo.completo,
    motivo: vinculo.motivo,
    syncStatus: vinculo.colaborador?.timesheet_sync_status || 'none',
    vinculo: {
      login: Boolean(vinculo.colaborador?.user_id),
      ponto: Boolean(vinculo.tsEmployeeId),
      folha: Boolean(vinculo.payrollEmployeeId),
      empresa: vinculo.empresaConfigurada,
    },
  };
}

const MOTIVO_MSG: Record<string, string> = {
  sem_colaborador: 'Colaborador não encontrado para este usuário',
  ambiguo: 'Mais de um cadastro corresponde a este usuário. O DP precisa unificar.',
  sem_user: 'Login ainda não vinculado ao cadastro do colaborador.',
  flag_inativa: 'Seu cadastro não está habilitado para Time Sheet',
  sem_empresa: 'Empresa sem tenant do Time Sheet.',
  sem_people_map: 'Cadastro ainda não sincronizado com o Time Sheet.',
  sem_folha: 'Colaborador ainda não vinculado à folha.',
};

export async function GET(request: NextRequest) {
  const userId = tokenUserId(request);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const admin = await getSupabaseAdmin();
    const vinculo = await resolveVinculoByUser(createSupabaseVinculoStore(admin), userId);
    let resumo: unknown = null;
    if (vinculo.colaborador?.contabilizar_timesheet === true) {
      const { data } = await admin
        .from('ts_timesheet_resumo')
        .select('period_start, period_end, status, worked_days, worked_minutes, folha_status, folha_motivo, updated_at')
        .eq('colaborador_id', vinculo.colaborador.id)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      resumo = data ?? null;
    }

    return NextResponse.json({
      success: true,
      data: { ...vinculoPayload(vinculo), resumo },
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
    const admin = await getSupabaseAdmin();
    const vinculo = await resolveVinculoByUser(createSupabaseVinculoStore(admin), userId);
    if (!vinculo.completo || !vinculo.colaborador?.empresa_id) {
      const motivo = vinculo.motivo || 'sem_colaborador';
      return NextResponse.json(
        {
          success: false,
          error: MOTIVO_MSG[motivo] || 'Cadeia de vínculo incompleta',
          data: vinculoPayload(vinculo),
        },
        { status: motivo === 'flag_inativa' ? 403 : 409 },
      );
    }

    const client = await getTimesheetClient(String(vinculo.colaborador.empresa_id));
    const link = await client.createSsoLink({ externalId: vinculo.colaborador.id });
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
