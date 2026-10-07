import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTimesheetClient, TimesheetApiError } from '@/lib/timesheet-integration/client';
import type { PunchKind } from '@/lib/timesheet-integration/types';
import {
  createSupabaseVinculoStore,
  resolveVinculoByUser,
} from '@/lib/timesheet-integration/vinculo';

export const dynamic = 'force-dynamic';

function tokenUserId(request: NextRequest): string | null {
  const result = verifyRequestToken(request);
  if (!result.valid || !result.payload) return null;
  const p = result.payload;
  return p.userId || p.user_id || p.sub || p.id || null;
}

function parseKind(raw: unknown): PunchKind | null {
  return raw === 'in' || raw === 'out' ? raw : null;
}

async function exigirCadeia(userId: string) {
  const admin = await getSupabaseAdmin();
  const vinculo = await resolveVinculoByUser(createSupabaseVinculoStore(admin), userId);
  if (!vinculo.completo || !vinculo.colaborador?.empresa_id) {
    return { vinculo, client: null as null };
  }
  const client = await getTimesheetClient(String(vinculo.colaborador.empresa_id));
  return { vinculo, client };
}

export async function GET(request: NextRequest) {
  const userId = tokenUserId(request);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const { vinculo, client } = await exigirCadeia(userId);
    if (!client || !vinculo.colaborador) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cadeia de vínculo incompleta',
          data: { motivo: vinculo.motivo },
        },
        { status: 409 },
      );
    }
    const today = await client.todayPunch({ externalId: vinculo.colaborador.id });
    return NextResponse.json({ success: true, data: today });
  } catch (error) {
    console.error('[pontoflow/punch] GET erro:', error);
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
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const kind = body && typeof body === 'object' && 'kind' in body ? parseKind(body.kind) : null;
  if (!kind) {
    return NextResponse.json({ success: false, error: 'kind deve ser in ou out' }, { status: 400 });
  }
  const at = body && typeof body === 'object' && 'at' in body && typeof body.at === 'string'
    ? body.at
    : new Date().toISOString();

  try {
    const { vinculo, client } = await exigirCadeia(userId);
    if (!client || !vinculo.colaborador) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cadeia de vínculo incompleta',
          data: { motivo: vinculo.motivo },
        },
        { status: 409 },
      );
    }
    const punch = await client.recordPunch(
      { externalId: vinculo.colaborador.id, kind, at, source: 'portal' },
      { idempotencyKey: randomUUID() },
    );
    return NextResponse.json({ success: true, data: punch });
  } catch (error) {
    console.error('[pontoflow/punch] POST erro:', error);
    if (error instanceof TimesheetApiError) {
      const status = error.status === 404 || error.status === 409 ? error.status : 502;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
