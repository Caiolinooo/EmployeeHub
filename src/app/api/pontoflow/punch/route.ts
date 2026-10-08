import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { BiometricGateError, verificarAssercaoPonto, type ProvaBiometrica } from '@/lib/webauthn';
import { getTimesheetClient, TimesheetApiError } from '@/lib/timesheet-integration/client';
import {
  dataTrabalho,
  faseExpediente,
  montarHojeAposBatida,
  normalizarHoje,
  rejeitarBatida,
  resumoHoje,
  type HojePonto,
} from '@/lib/timesheet-integration/jornada';
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

function payloadHoje(hoje: HojePonto) {
  return { ...hoje, ...resumoHoje(hoje) };
}

async function exigirCadeia(userId: string) {
  const admin = await getSupabaseAdmin();
  const vinculo = await resolveVinculoByUser(createSupabaseVinculoStore(admin), userId);
  if (!vinculo.completo || !vinculo.colaborador?.empresa_id) {
    return { vinculo, client: null as null, admin };
  }
  const client = await getTimesheetClient(String(vinculo.colaborador.empresa_id));
  return { vinculo, client, admin };
}

async function gravarProva(
  admin: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  input: {
    userId: string;
    colaboradorId: string;
    entryId: string;
    kind: PunchKind;
    workDate: string;
    prova: ProvaBiometrica;
  },
) {
  const { error } = await admin.from('ts_punch_biometric').insert({
    user_id: input.userId,
    colaborador_id: input.colaboradorId,
    entry_id: input.entryId,
    kind: input.kind,
    work_date: input.workDate,
    method: input.prova.method,
    credential_id: input.prova.credentialId,
    user_verified: input.prova.userVerified,
    device_type: input.prova.deviceType,
    origin: input.prova.origin,
  });
  if (error) {
    throw new Error(error.message);
  }
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
    const hoje = normalizarHoje(today);
    return NextResponse.json({ success: true, data: payloadHoje(hoje) });
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
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const kind = parseKind(record.kind);
  if (!kind) {
    return NextResponse.json({ success: false, error: 'kind deve ser in ou out' }, { status: 400 });
  }

  try {
    const { vinculo, client, admin } = await exigirCadeia(userId);
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

    const atual = normalizarHoje(await client.todayPunch({ externalId: vinculo.colaborador.id }));
    const bloqueio = rejeitarBatida(faseExpediente(atual), kind);
    if (bloqueio) {
      return NextResponse.json({ success: false, error: bloqueio, data: payloadHoje(atual) }, { status: 409 });
    }

    const prova = await verificarAssercaoPonto(userId, request.headers.get('host'), record.assertion);
    const deNovo = normalizarHoje(await client.todayPunch({ externalId: vinculo.colaborador.id }));
    const bloqueioDepois = rejeitarBatida(faseExpediente(deNovo), kind);
    if (bloqueioDepois) {
      return NextResponse.json({ success: false, error: bloqueioDepois, data: payloadHoje(deNovo) }, { status: 409 });
    }

    const at = new Date().toISOString();
    const punch = await client.recordPunch(
      { externalId: vinculo.colaborador.id, kind, at, source: 'portal' },
      { idempotencyKey: randomUUID() },
    );
    const hoje = montarHojeAposBatida({
      kind,
      at,
      previous: deNovo,
      returnedIni: punch.horaIni,
      returnedFim: punch.horaFim,
      date: dataTrabalho(punch.date || '', at) || deNovo.date,
    });

    try {
      await gravarProva(admin, {
        userId,
        colaboradorId: vinculo.colaborador.id,
        entryId: punch.entryId,
        kind,
        workDate: hoje.date,
        prova,
      });
    } catch (proofError) {
      console.error('[pontoflow/punch] prova biométrica não gravada:', proofError);
      return NextResponse.json(
        {
          success: false,
          error: 'Ponto registrado no Time Sheet, mas a prova biométrica não foi gravada.',
          data: { ...payloadHoje(hoje), biometric: { method: prova.method } },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...payloadHoje(hoje), biometric: { method: prova.method } },
    });
  } catch (error) {
    console.error('[pontoflow/punch] POST erro:', error);
    if (error instanceof BiometricGateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
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
