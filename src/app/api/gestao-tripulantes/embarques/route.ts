import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { mapCodigoToDbTipo } from '@/lib/gestao-tripulantes/escala-tipos';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { invalidateManScheduleCache } from '@/lib/gestao-tripulantes/man-schedule-cache';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const {
      colaborador_cpf,
      tipo,
      data_embarque,
      data_desembarque,
      local_embarque,
      local_desembarque,
      observacoes,
      exibir_dia_inicio,
    } = body;

    if (!colaborador_cpf || !tipo || !data_embarque || !data_desembarque) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    // Intervalo invertido some da grade e conta 1 dia no fechamento — rejeitar.
    if (String(data_desembarque).slice(0, 10) < String(data_embarque).slice(0, 10)) {
      return NextResponse.json(
        { error: 'Data de desembarque não pode ser anterior à data de embarque.' },
        { status: 400 }
      );
    }

    const colab = await findColaboradorByCpf(String(colaborador_cpf));
    if (!colab) {
      return NextResponse.json(
        { error: `Colaborador com CPF ${colaborador_cpf} não encontrado na base local.` },
        { status: 404 }
      );
    }

    // offc → 'offc' (não colapsa para folga_indenizada/fi)
    const dbTipo = mapCodigoToDbTipo(String(tipo));
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      colaborador_id: colab.id,
      tipo: dbTipo,
      data_embarque,
      data_desembarque,
      local_embarque: local_embarque || '',
      local_desembarque: local_desembarque || '',
      observacoes: observacoes || '',
      exibir_dia_inicio: exibir_dia_inicio !== undefined ? Boolean(exibir_dia_inicio) : true,
      origem: 'local',
      created_at: now,
      updated_at: now,
    };

    // Idempotência: um evento por colaborador + período exato. Retentar o mesmo
    // save atualiza o registro existente (e colapsa duplicatas antigas) em vez
    // de empilhar linhas idênticas que inflam o fechamento NxN.
    const dia = (v: unknown) => String(v ?? '').slice(0, 10);
    const { data: duplicates, error: dupErr } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('id, origem, created_at')
      .eq('colaborador_id', colab.id)
      .eq('data_embarque', dia(data_embarque))
      .eq('data_desembarque', dia(data_desembarque))
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (dupErr) {
      console.error('Erro ao verificar duplicados de embarque:', dupErr);
    } else if (duplicates && duplicates.length > 0) {
      const keep = duplicates[0];
      let collapsed = 0;
      if (duplicates.length > 1) {
        // Colapsa só linhas locais — linhas MIO são da sincronização e podem voltar.
        const staleIds = duplicates.slice(1).filter((d) => d.origem === 'local').map((d) => d.id);
        if (staleIds.length > 0) {
          const { error: delErr } = await supabaseAdmin
            .from('gt_historico_embarques')
            .update({ deleted_at: now, updated_at: now })
            .in('id', staleIds);
          if (delErr) console.error('Erro ao colapsar duplicados de embarque:', delErr);
          else collapsed = staleIds.length;
        }
      }
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('gt_historico_embarques')
        .update({
          tipo: dbTipo,
          local_embarque: local_embarque || '',
          local_desembarque: local_desembarque || '',
          observacoes: observacoes || '',
          exibir_dia_inicio: row.exibir_dia_inicio,
          origem: 'local',
          updated_at: now,
        })
        .eq('id', keep.id)
        .select('*')
        .single();
      if (updErr) {
        console.error('Erro ao atualizar embarque duplicado:', updErr);
        return NextResponse.json(
          { error: updErr.message || 'Erro ao atualizar evento de escala' },
          { status: 500 }
        );
      }
      if (collapsed > 0) invalidateManScheduleCache();
      return NextResponse.json({ success: true, data: updated, merged: true });
    }

    let { data, error } = await supabaseAdmin
      .from('gt_historico_embarques')
      .insert(row)
      .select('*')
      .single();

    if (error && /exibir_dia_inicio|updated_at/i.test(error.message || '')) {
      const retry = { ...row };
      if (/exibir_dia_inicio/i.test(error.message || '')) delete retry.exibir_dia_inicio;
      if (/updated_at/i.test(error.message || '')) delete retry.updated_at;
      const second = await supabaseAdmin.from('gt_historico_embarques').insert(retry).select('*').single();
      data = second.data;
      error = second.error;
    }

    if (error) {
      console.error('Erro ao inserir evento de embarque:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao criar evento de escala' },
        { status: 500 }
      );
    }

    invalidateManScheduleCache();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro na API de embarques:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
