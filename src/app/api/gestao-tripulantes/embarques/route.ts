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
import { paginarSelect } from '@/lib/gestao-tripulantes/supabase-paginacao';

export const dynamic = 'force-dynamic';

/** Linha do GET /embarques (colunas mínimas para o editor do fechamento). */
type EmbarqueListRow = {
  id: string;
  colaborador_id: string | null;
  tipo: string | null;
  data_embarque: string | null;
  data_desembarque: string | null;
  data_prevista_desembarque: string | null;
  local_embarque: string | null;
  local_desembarque: string | null;
  observacoes: string | null;
  origem: string | null;
  updated_at: string | null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET — lista os eventos de escala (embarques) de um colaborador.
 * Query: `colaboradorId` (obrigatório), `de`/`ate` (YYYY-MM-DD, opcionais).
 * Janela: data_embarque <= ate AND coalesce(data_desembarque,
 * data_prevista_desembarque, data_embarque) >= de — linhas "abertas" (rotação
 * em andamento) caem no previsto/embarque. Só linhas vivas (deleted_at null).
 */
export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);
    const colaboradorId = (url.searchParams.get('colaboradorId') || '').trim();
    if (!colaboradorId) {
      return NextResponse.json({ error: 'Parâmetro "colaboradorId" é obrigatório.' }, { status: 400 });
    }

    const de = url.searchParams.get('de');
    const ate = url.searchParams.get('ate');
    if ((de && !ISO_DATE_RE.test(de)) || (ate && !ISO_DATE_RE.test(ate))) {
      return NextResponse.json(
        { error: 'Parâmetros "de"/"ate" devem estar no formato YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const res = await paginarSelect<EmbarqueListRow>(async (from, to) => {
      // Builder reconstruído por página (idioma do repositório — buscarSobrepostos)
      // com ordem determinística: data_embarque desc, id desempata.
      let query = supabaseAdmin
        .from('gt_historico_embarques')
        .select(
          'id, colaborador_id, tipo, data_embarque, data_desembarque, data_prevista_desembarque, ' +
            'local_embarque, local_desembarque, observacoes, origem, updated_at'
        )
        .eq('colaborador_id', colaboradorId)
        .is('deleted_at', null)
        .order('data_embarque', { ascending: false })
        .order('id', { ascending: false });

      if (ate) query = query.lte('data_embarque', ate);
      if (de) {
        // coalesce(desembarque, prevista, embarque) >= de, expresso em or/and
        // do PostgREST (nested and() já é usado no repo — ia/permissions).
        query = query.or(
          `and(data_desembarque.gte.${de}),` +
            `and(data_desembarque.is.null,data_prevista_desembarque.gte.${de}),` +
            `and(data_desembarque.is.null,data_prevista_desembarque.is.null,data_embarque.gte.${de})`
        );
      }

      const r = await query.range(from, to);
      return { data: (r.data ?? null) as unknown as EmbarqueListRow[] | null, error: r.error };
    });

    if (res.error) {
      console.error('Erro ao listar embarques:', res.error);
      return NextResponse.json({ error: res.error || 'Erro ao listar embarques' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { embarques: res.rows } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Erro na API de listagem de embarques:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
