import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken, type TokenPayload } from '@/lib/auth';
import { mapCodigoToDbTipo } from '@/lib/gestao-tripulantes/escala-tipos';
import { invalidateManScheduleCache } from '@/lib/gestao-tripulantes/man-schedule-cache';
import { sincronizarDatasEscalaColaborador } from '@/lib/gestao-tripulantes/embarques-datas-sync';
import {
  aplicarRecorteEmSobreposto,
  buscarSobrepostos,
  carregarAtorEscala,
  registrarEdicaoEscala,
  snapshotEmbarque,
  type EmbarqueRow,
  type EscalaEdicaoAtor,
} from '@/lib/gestao-tripulantes/escala-audit-writer';
import { filtrarSubstitutiveis } from '@/lib/gestao-tripulantes/escala-overlap';
import { diaISO, lerFlagRecorte } from '@/lib/gestao-tripulantes/escala-recorte';

export const dynamic = 'force-dynamic';

function requireAuth(request: NextRequest): {
  error?: NextResponse;
  payload?: TokenPayload;
} {
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

    // GT v2 (R7): ator da trilha de auditoria (JWT verificado + IP).
    const ator: EscalaEdicaoAtor = await carregarAtorEscala(auth.payload!, request);

    const { data: existingData, error: findErr } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('id, colaborador_id, tipo, data_embarque, data_desembarque, data_prevista_desembarque, local_embarque, local_desembarque, observacoes, exibir_dia_inicio, origem, mio_embarque_id, deleted_at, updated_at')
      .eq('id', id)
      .maybeSingle();
    const existing = existingData as EmbarqueRow | null;

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
      return NextResponse.json({ success: true, data: existing, unchanged: true, edicoes: [] });
    }

    // Recorte de marcações (v5.80): flags opcionais do contrato —
    // apagar_anteriores descarta a ponta ANTES do período salvo;
    // apagar_posteriores descarta a ponta DEPOIS. Default false/false.
    const apagarAnteriores = lerFlagRecorte(body.apagar_anteriores);
    const apagarPosteriores = lerFlagRecorte(body.apagar_posteriores);

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
    // sobrepõem — gte nunca casa NULL em SQL. GT v2: before-image completa
    // (auditoria) e leitura paginada.
    const sobrepostos = await buscarSobrepostos(
      (existing as { colaborador_id?: string }).colaborador_id ?? '',
      ini,
      fim,
      id,
    );

    const edicoes: string[] = [];
    const substituidos: Array<{ id: string; tipo: string; data_embarque: string; data_desembarque: string }> = [];

    // GT v2 (R7) + recorte (v5.80): trilha de auditoria — best-effort, nunca
    // falha o save. Ordem de gravação (refletida em `edicoes`): 1º a edição do
    // evento (update), depois um efeito por evento sobreposto do MESMO tipo —
    // RECORTADO em torno do período salvo (não mais soft-delete inteiro):
    // ponta anterior/posterior preservada vira UPDATE na própria linha; recorte
    // no meio vira soft-delete + 2 fragmentos; sem pontas preserváveis (ou com
    // flags apagar_*) vira soft-delete total.
    try {
      const agoraAudit = new Date().toISOString();
      const colaboradorId = (existing as { colaborador_id?: string }).colaborador_id || null;
      const idAudit = await registrarEdicaoEscala({
        embarqueId: id,
        colaboradorId,
        operacao: 'update',
        status: 'aplicada',
        dadosAnteriores: snapshotEmbarque(existing),
        dadosNovos: snapshotEmbarque((data || {}) as EmbarqueRow),
        motivo: 'Evento de escala editado',
        ator,
      });
      if (idAudit) edicoes.push(idAudit);

      // Substituição TYPE-AWARE (fix Rômulo), mesma regra do POST: rotação
      // ('normal') substitui só rotação; marcador (dba/fi/stb/offc/custom) só o
      // MESMO marcador. O ON aberto do tripulante embarcado nunca sai por causa
      // de um marcador — marcadores coexistem com a rotação (a grade resolve o
      // mesmo dia via pickOverlappingRotation).
      const tipoSalvo = (data as { tipo?: string } | null)?.tipo ?? existing.tipo;
      const substituir = filtrarSubstitutiveis(String(tipoSalvo || ''), sobrepostos || []);
      // Evento salvo ABERTO (data_desembarque NULL): recorte usa o sentinel do
      // audit-writer ('2999-12-31') — preserva a ponta ANTERIOR dos sobrepostos
      // e corta tudo a partir do início salvo (equivalente ao antigo apagar
      // tudo, sem jogar fora o que veio antes).
      const fimPeriodo = fim || '2999-12-31';
      for (const r of substituir) {
        const efeito = await aplicarRecorteEmSobreposto({
          row: r,
          periodo: { inicio: ini, fim: fimPeriodo },
          apagarAnteriores,
          apagarPosteriores,
          ator,
          colaboradorId,
          now: agoraAudit,
          motivos: { delete: 'Substituído pela edição do evento (overlap-replace)' },
        });
        if (efeito.acao === 'nada' || !efeito.afetado) continue;
        edicoes.push(...efeito.edicoes);
        substituidos.push({
          id: String(r.id || ''),
          tipo: String(r.tipo ?? ''),
          data_embarque: String(r.data_embarque ?? ''),
          data_desembarque: String(r.data_desembarque ?? ''),
        });
      }
    } catch (auditErr) {
      console.error('Falha ao gravar auditoria de escala (best-effort):', auditErr);
    }

    invalidateManScheduleCache();
    // Datas de escala (último embarque/desembarque, próximo) voltam a acompanhar
    // os eventos — pull MIO desligado. Best-effort: nunca falha a requisição.
    await sincronizarDatasEscalaColaborador(
      (existing as { colaborador_id?: string }).colaborador_id ?? null
    );
    return NextResponse.json({ success: true, data, substituidos, edicoes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro na API de atualização de embarque:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE — exclusão de evento de escala.
 * - modo 'completo' (default; body ausente = fetch DELETE sem body): soft-delete
 *   da linha inteira (comportamento inalterado).
 * - modo 'periodo' {data_inicio, data_fim 'YYYY-MM-DD'}: exclusão PARCIAL — o
 *   período é clipado ao intervalo do evento; cobrindo o evento inteiro vira
 *   soft-delete total; senão RECORTA (escala-recorte.ts, flags {false,false}):
 *   ponta anterior/posterior preservada encurta a linha in place, recorte no
 *   meio soft-deleta a original e cria 2 fragmentos.
 * Resposta inclui `modo` e `edicoes` (ids da trilha gt_escala_edicoes gravados
 * pela ação, em ordem; vazio/ausente se a auditoria best-effort falhou).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const { id } = await context.params;

    const ator: EscalaEdicaoAtor = await carregarAtorEscala(auth.payload!, request);

    const { data: existingData, error: findErr } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('id, colaborador_id, tipo, data_embarque, data_desembarque, data_prevista_desembarque, local_embarque, local_desembarque, observacoes, exibir_dia_inicio, origem, deleted_at, updated_at')
      .eq('id', id)
      .maybeSingle();
    const existing = existingData as EmbarqueRow | null;

    if (findErr || !existing || existing.deleted_at) {
      return NextResponse.json({ error: 'Evento de escala não encontrado' }, { status: 404 });
    }

    // Body OPCIONAL e tolerante: fetch DELETE sem body / content-type vazio /
    // JSON inválido ⇒ {} (modo completo — comportamento atual preservado).
    let body: Record<string, unknown> = {};
    try {
      const raw = await request.text();
      if (raw && raw.trim()) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>;
        }
      }
    } catch {
      body = {};
    }

    const modo = body.modo === 'periodo' ? 'periodo' : 'completo';
    const colaboradorId = (existing as { colaborador_id?: string }).colaborador_id || null;
    const edicoes: string[] = [];

    if (modo === 'periodo') {
      const dataInicio = diaISO(body.data_inicio);
      const dataFim = diaISO(body.data_fim);
      if (!dataInicio || !dataFim) {
        return NextResponse.json(
          { error: 'modo "periodo" exige data_inicio e data_fim no formato YYYY-MM-DD.' },
          { status: 400 }
        );
      }
      if (dataFim < dataInicio) {
        return NextResponse.json(
          { error: 'data_fim não pode ser anterior a data_inicio.' },
          { status: 400 }
        );
      }

      // Exclusão parcial = recorte com flags {false,false} (preserva head/tail
      // fora do recorte). Efeitos + trilha por efeito (best-effort) no
      // audit-writer; a linha some só se o clipe cobrir o evento inteiro.
      const agora = new Date().toISOString();
      const efeito = await aplicarRecorteEmSobreposto({
        row: existing,
        periodo: { inicio: dataInicio, fim: dataFim },
        apagarAnteriores: false,
        apagarPosteriores: false,
        ator,
        colaboradorId,
        now: agora,
        motivos: { delete: 'Exclusão parcial de período (modo período)' },
      });
      if (efeito.acao === 'nada') {
        return NextResponse.json(
          { error: 'O período informado não sobrepõe o evento de escala — nada a excluir.' },
          { status: 400 }
        );
      }
      edicoes.push(...efeito.edicoes);

      invalidateManScheduleCache();
      await sincronizarDatasEscalaColaborador(colaboradorId);
      return NextResponse.json({
        success: true,
        message:
          efeito.acao === 'apagar'
            ? 'Evento de escala removido com sucesso.'
            : 'Período removido do evento de escala (pontas preservadas).',
        modo,
        edicoes,
        recorte: { acao: efeito.acao, fragmentosCriados: efeito.fragmentos.length },
      });
    }

    // modo 'completo' — soft-delete da linha inteira (comportamento atual).
    const agoraDel = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('gt_historico_embarques')
      .update({
        deleted_at: agoraDel,
        updated_at: agoraDel,
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir evento de embarque:', error);
      return NextResponse.json({ error: 'Erro ao excluir evento de escala' }, { status: 500 });
    }

    // GT v2 (R7): trilha de auditoria — best-effort, nunca falha o delete.
    try {
      const idAudit = await registrarEdicaoEscala({
        embarqueId: id,
        colaboradorId,
        operacao: 'delete',
        status: 'aplicada',
        dadosAnteriores: snapshotEmbarque(existing),
        dadosNovos: { ...snapshotEmbarque(existing), deleted_at: agoraDel },
        motivo: 'Evento de escala excluído',
        ator,
      });
      if (idAudit) edicoes.push(idAudit);
    } catch (auditErr) {
      console.error('Falha ao gravar auditoria de escala (best-effort):', auditErr);
    }

    invalidateManScheduleCache();
    // Soft-delete confirmado acima (update em deleted_at): recalcula as datas de
    // escala com as linhas vivas restantes. Best-effort: nunca falha a requisição.
    await sincronizarDatasEscalaColaborador(colaboradorId);
    return NextResponse.json({
      success: true,
      message: 'Evento de escala removido com sucesso.',
      modo,
      edicoes,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro na API de exclusão de embarque:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
