import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { mapCodigoToDbTipo } from '@/lib/gestao-tripulantes/escala-tipos';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { invalidateManScheduleCache } from '@/lib/gestao-tripulantes/man-schedule-cache';
import { sincronizarDatasEscalaColaborador } from '@/lib/gestao-tripulantes/embarques-datas-sync';

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

    // Substituição: o save do operador é a verdade — todo evento do mesmo
    // colaborador que sobreponha o período informado é substituído (soft-delete;
    // o pull MIO preserva exclusões locais). Período exatamente igual atualiza a
    // linha existente (id estável para o grid), retentar nunca duplica.
    const dia = (v: unknown) => String(v ?? '').slice(0, 10);
    const embIni = dia(data_embarque);
    const embFim = dia(data_desembarque);

    // Sobreposição inclui linhas "abertas" (data_desembarque NULL — rotação MIO
    // em andamento): gte nunca casa NULL em SQL, então or(is.null, gte).
    const { data: sobrepostos, error: ovErr } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('id, tipo, data_embarque, data_desembarque, created_at')
      .eq('colaborador_id', colab.id)
      .is('deleted_at', null)
      .lte('data_embarque', embFim)
      .or(`data_desembarque.is.null,data_desembarque.gte.${embIni}`)
      .order('created_at', { ascending: false });

    if (ovErr) {
      console.error('Erro ao verificar sobrepostos de embarque:', ovErr);
    }

    const lista = sobrepostos || [];
    const keep = lista.find((r) => r.data_embarque === embIni && r.data_desembarque === embFim) || null;
    const substituir = lista.filter((r) => r.id !== keep?.id);

    let data: Record<string, unknown> | null;
    let error: { message: string } | null;
    let merged = false;

    if (keep) {
      merged = true;
      const upd = await supabaseAdmin
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
      data = upd.data as Record<string, unknown> | null;
      error = upd.error;
    } else {
      const ins = await supabaseAdmin
        .from('gt_historico_embarques')
        .insert(row)
        .select('*')
        .single();
      data = ins.data as Record<string, unknown> | null;
      error = ins.error;

      if (error && /exibir_dia_inicio|updated_at/i.test(error.message || '')) {
        const retry = { ...row };
        if (/exibir_dia_inicio/i.test(error.message || '')) delete retry.exibir_dia_inicio;
        if (/updated_at/i.test(error.message || '')) delete retry.updated_at;
        const second = await supabaseAdmin.from('gt_historico_embarques').insert(retry).select('*').single();
        data = second.data as Record<string, unknown> | null;
        error = second.error;
      }
    }

    if (error) {
      console.error('Erro ao salvar evento de embarque:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao salvar evento de escala' },
        { status: 500 }
      );
    }

    const substituidos = substituir.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      data_embarque: r.data_embarque,
      data_desembarque: r.data_desembarque,
    }));
    if (substituir.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('gt_historico_embarques')
        .update({ deleted_at: now, updated_at: now })
        .in('id', substituir.map((r) => r.id));
      if (delErr) console.error('Erro ao substituir embarques sobrepostos:', delErr);
    }

    invalidateManScheduleCache();
    // Datas de escala (último embarque/desembarque, próximo) voltam a acompanhar
    // os eventos — pull MIO desligado. Best-effort: nunca falha a requisição.
    await sincronizarDatasEscalaColaborador(colab.id);
    return NextResponse.json({ success: true, data, merged, substituidos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro na API de embarques:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
