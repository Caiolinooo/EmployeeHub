import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { mapCodigoToDbTipo } from '@/lib/gestao-tripulantes/escala-tipos';
import { invalidateManScheduleCache } from '@/lib/gestao-tripulantes/man-schedule-cache';
import { sincronizarDatasEscalaColaborador } from '@/lib/gestao-tripulantes/embarques-datas-sync';

export const dynamic = 'force-dynamic';

function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || undefined;
  const token = extractTokenFromHeader(authHeader);
  if (!token) return { error: NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 }) };
  const payload = verifyToken(token);
  if (!payload) return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  return { payload };
}

/** PUT — update local scale event (dates, tipo, vessel, observações). */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    const body = await request.json();

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('id, colaborador_id, tipo, data_embarque, data_desembarque, local_embarque, local_desembarque, observacoes, exibir_dia_inicio, origem, mio_embarque_id, deleted_at')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !existing || existing.deleted_at) {
      return NextResponse.json({ error: 'Evento de escala não encontrado' }, { status: 404 });
    }

    if (
      body.data_embarque !== undefined &&
      body.data_desembarque !== undefined &&
      String(body.data_desembarque).slice(0, 10) < String(body.data_embarque).slice(0, 10)
    ) {
      return NextResponse.json(
        { error: 'Data de desembarque não pode ser anterior à data de embarque.' },
        { status: 400 }
      );
    }

    // Dirty check: salvar sem mudar nada NÃO vira origem='local' — a linha MIO
    // continua sincronizável. Só consideramos ajuste manual quando um campo
    // de fato diverge.
    const nextTipo = body.tipo !== undefined ? mapCodigoToDbTipo(String(body.tipo)) : existing.tipo;
    const nextVals = {
      tipo: nextTipo,
      data_embarque: body.data_embarque !== undefined ? body.data_embarque : existing.data_embarque,
      data_desembarque: body.data_desembarque !== undefined ? body.data_desembarque : existing.data_desembarque,
      local_embarque: body.local_embarque !== undefined ? body.local_embarque || '' : existing.local_embarque || '',
      local_desembarque: body.local_desembarque !== undefined ? body.local_desembarque || '' : existing.local_desembarque || '',
      observacoes: body.observacoes !== undefined ? body.observacoes || '' : existing.observacoes || '',
      exibir_dia_inicio: body.exibir_dia_inicio !== undefined ? Boolean(body.exibir_dia_inicio) : existing.exibir_dia_inicio !== false,
    };
    const existingExibir = existing.exibir_dia_inicio !== false; // null → default true
    const dirty =
      nextVals.tipo !== existing.tipo ||
      String(nextVals.data_embarque || '').slice(0, 10) !== String(existing.data_embarque || '').slice(0, 10) ||
      String(nextVals.data_desembarque || '').slice(0, 10) !== String(existing.data_desembarque || '').slice(0, 10) ||
      nextVals.local_embarque !== (existing.local_embarque || '') ||
      nextVals.local_desembarque !== (existing.local_desembarque || '') ||
      nextVals.observacoes !== (existing.observacoes || '') ||
      nextVals.exibir_dia_inicio !== existingExibir;

    if (!dirty) {
      return NextResponse.json({ success: true, data: existing, unchanged: true });
    }

    const updates: Record<string, unknown> = {
      origem: 'local',
      updated_at: new Date().toISOString(),
    };

    if (body.tipo !== undefined) {
      updates.tipo = mapCodigoToDbTipo(String(body.tipo));
    }

    if (body.tipo !== undefined) {
      updates.tipo = mapCodigoToDbTipo(String(body.tipo));
    }
    if (body.data_embarque !== undefined) {
      updates.data_embarque = body.data_embarque;
    }
    if (body.data_desembarque !== undefined) {
      updates.data_desembarque = body.data_desembarque;
    }
    if (body.local_embarque !== undefined) {
      updates.local_embarque = body.local_embarque || '';
    }
    if (body.local_desembarque !== undefined) {
      updates.local_desembarque = body.local_desembarque || '';
    }
    if (body.observacoes !== undefined) {
      updates.observacoes = body.observacoes || '';
    }
    if (body.exibir_dia_inicio !== undefined) {
      updates.exibir_dia_inicio = Boolean(body.exibir_dia_inicio);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('gt_historico_embarques')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao atualizar evento de embarque:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao atualizar evento de escala' },
        { status: 500 }
      );
    }

    // Substituição: o evento salvo vence — sobrepostos do mesmo colaborador
    // saem (soft-delete; o pull MIO preserva exclusões locais).
    const ini = String((data as { data_embarque?: string }).data_embarque || '').slice(0, 10);
    const fim = String((data as { data_desembarque?: string }).data_desembarque || '').slice(0, 10);
    // Mesma regra do POST: linhas abertas (data_desembarque NULL) também
    // sobrepõem — gte nunca casa NULL em SQL.
    const { data: sobrepostos, error: ovErr } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('id, tipo, data_embarque, data_desembarque')
      .eq('colaborador_id', (existing as { colaborador_id?: string }).colaborador_id ?? '')
      .is('deleted_at', null)
      .neq('id', id)
      .lte('data_embarque', fim)
      .or(`data_desembarque.is.null,data_desembarque.gte.${ini}`);
    if (ovErr) {
      console.error('Erro ao verificar sobrepostos de embarque (PUT):', ovErr);
    }

    let substituidos: Array<{ id: string; tipo: string; data_embarque: string; data_desembarque: string }> = [];
    const ids = (sobrepostos || []).map((r) => r.id);
    if (ids.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('gt_historico_embarques')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in('id', ids);
      if (delErr) console.error('Erro ao substituir embarques sobrepostos:', delErr);
      else substituidos = sobrepostos || [];
    }

    invalidateManScheduleCache();
    // Datas de escala (último embarque/desembarque, próximo) voltam a acompanhar
    // os eventos — pull MIO desligado. Best-effort: nunca falha a requisição.
    await sincronizarDatasEscalaColaborador(
      (existing as { colaborador_id?: string }).colaborador_id ?? null
    );
    return NextResponse.json({ success: true, data, substituidos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro na API de atualização de embarque:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const { id } = await context.params;

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('id, origem, deleted_at, colaborador_id')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !existing || existing.deleted_at) {
      return NextResponse.json({ error: 'Evento de escala não encontrado' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('gt_historico_embarques')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir evento de embarque:', error);
      return NextResponse.json({ error: 'Erro ao excluir evento de escala' }, { status: 500 });
    }

    invalidateManScheduleCache();
    // Soft-delete confirmado acima (update em deleted_at): recalcula as datas de
    // escala com as linhas vivas restantes. Best-effort: nunca falha a requisição.
    await sincronizarDatasEscalaColaborador(
      (existing as { colaborador_id?: string }).colaborador_id ?? null
    );
    return NextResponse.json({ success: true, message: 'Evento de escala removido com sucesso.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro na API de exclusão de embarque:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
