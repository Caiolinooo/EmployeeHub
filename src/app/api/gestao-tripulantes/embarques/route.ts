import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { mapCodigoToDbTipo } from '@/lib/gestao-tripulantes/escala-tipos';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { invalidateManScheduleCache } from '@/lib/gestao-tripulantes/man-schedule-cache';
import { sincronizarDatasEscalaColaborador } from '@/lib/gestao-tripulantes/embarques-datas-sync';
import {
  aplicarRecorteEmSobreposto,
  buscarSobrepostos,
  carregarAtorEscala,
  registrarEdicaoEscala,
  snapshotEmbarque,
  type EmbarqueRow,
} from '@/lib/gestao-tripulantes/escala-audit-writer';
import { filtrarSubstitutiveis } from '@/lib/gestao-tripulantes/escala-overlap';
import { lerFlagRecorte } from '@/lib/gestao-tripulantes/escala-recorte';

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

    // GT v2 (R7): ator da trilha de auditoria (JWT verificado + IP).
    const ator = await carregarAtorEscala(payload, request);

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

    // Recorte de marcações (v5.80): flags opcionais do contrato —
    // apagar_anteriores descarta a ponta ANTES do período salvo;
    // apagar_posteriores descarta a ponta DEPOIS. Default false/false.
    const apagarAnteriores = lerFlagRecorte(body.apagar_anteriores);
    const apagarPosteriores = lerFlagRecorte(body.apagar_posteriores);

    // Substituição: o save do operador é a verdade — todo evento do mesmo
    // colaborador que sobreponha o período informado é substituído (soft-delete;
    // o pull MIO preserva exclusões locais). Período exatamente igual atualiza a
    // linha existente (id estável para o grid), retentar nunca duplica.
    const dia = (v: unknown) => String(v ?? '').slice(0, 10);
    const embIni = dia(data_embarque);
    const embFim = dia(data_desembarque);

    // Sobreposição inclui linhas "abertas" (data_desembarque NULL — rotação MIO
    // em andamento): gte nunca casa NULL em SQL, então or(is.null, gte).
    // GT v2: select completo (before-image da auditoria) + paginado.
    const lista = await buscarSobrepostos(colab.id, embIni, embFim);

    const keep = lista.find((r) => r.data_embarque === embIni && r.data_desembarque === embFim) || null;
    // Substituição TYPE-AWARE (fix Rômulo): rotação ('normal') substitui só
    // rotação; marcador (dba/fi/stb/offc/custom) substitui só o MESMO marcador.
    // O ON aberto do tripulante embarcado NUNCA sai por causa de um DBA/FI/STB/
    // OFF-C — marcadores coexistem com a rotação (a grade já resolve o mesmo dia
    // via pickOverlappingRotation). O match exato acima ("keep") roda ANTES do
    // filtro de propósito: re-marcar a mesma faixa exata atualiza a linha in
    // place, qualquer que seja o tipo.
    const substituir = filtrarSubstitutiveis(
      dbTipo,
      lista.filter((r) => r.id !== keep?.id)
    );

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

    const edicoes: string[] = [];
    const substituidos: Array<{ id: string; tipo: string; data_embarque: string; data_desembarque: string }> = [];

    // GT v2 (R7) + recorte (v5.80): trilha de auditoria — best-effort, nunca
    // falha o save. Ordem de gravação (refletida em `edicoes`): 1º o evento
    // salvo (create/update), depois um efeito por evento sobreposto do MESMO
    // tipo — que agora é RECORTADO em torno do período salvo em vez de ser
    // soft-deletado inteiro: ponta anterior/posterior preservada vira UPDATE na
    // própria linha; recorte no meio vira soft-delete + 2 fragmentos; sem
    // pontas preserváveis (ou com flags apagar_*) vira soft-delete total.
    try {
      if (keep) {
        const idAudit = await registrarEdicaoEscala({
          embarqueId: keep.id || null,
          colaboradorId: colab.id,
          operacao: 'update',
          status: 'aplicada',
          dadosAnteriores: snapshotEmbarque(keep),
          dadosNovos: snapshotEmbarque((data || {}) as EmbarqueRow),
          motivo: 'Evento de escala salvo (merged: período idêntico atualizado)',
          ator,
        });
        if (idAudit) edicoes.push(idAudit);
      } else {
        const idAudit = await registrarEdicaoEscala({
          embarqueId: (data as { id?: string } | null)?.id || null,
          colaboradorId: colab.id,
          operacao: 'create',
          status: 'aplicada',
          dadosAnteriores: null,
          dadosNovos: snapshotEmbarque((data || {}) as EmbarqueRow),
          motivo: 'Evento de escala criado',
          ator,
        });
        if (idAudit) edicoes.push(idAudit);
      }

      for (const r of substituir) {
        const efeito = await aplicarRecorteEmSobreposto({
          row: r,
          periodo: { inicio: embIni, fim: embFim },
          apagarAnteriores,
          apagarPosteriores,
          ator,
          colaboradorId: colab.id,
          now,
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
    await sincronizarDatasEscalaColaborador(colab.id);
    return NextResponse.json({ success: true, data, merged, substituidos, edicoes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro na API de embarques:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
