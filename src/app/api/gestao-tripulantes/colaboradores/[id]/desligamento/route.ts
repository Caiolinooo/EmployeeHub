import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { autoGenerateESocialEvents } from '@/services/eSocialAutoService';
import {
  requireAsoAgendamentoAuth,
  resolveAuthUserId,
} from '@/lib/gestao-tripulantes/aso-agendamento-auth';
import {
  MENSAGEM_DESLIGAMENTO_NEGADO,
  podeRegistrarDesligamento,
} from '@/lib/gestao-tripulantes/desligamento-auth';
import {
  avisoDefaultParaTipo,
  isAvisoPrevioTipo,
  isCivilDate,
  isTipoRescisao,
  mtvDesligParaTipo,
  prazoPagamentoRescisao,
  sugerirAvisoPrevioDias,
  verbasParaRescisao,
  type TipoRescisao,
  type VerbaRescisaoPrevista,
} from '@/lib/gestao-tripulantes/desligamento';
import { tentarIntegrarFolhaRescisao } from '@/lib/gestao-tripulantes/desligamento-payroll';
import { normalizeCpf } from '@/lib/utils/identity';
import type {
  GTAvisoPrevioTipo,
  GTDesligamento,
  GTDesligamentoEtapas,
  GTStatusDesligamento,
  GTTipoRescisao,
} from '@/types/gestao-tripulantes';

export const dynamic = 'force-dynamic';

interface ColaboradorDesligRow {
  id: string;
  nome_completo: string;
  cpf: string | null;
  matricula: string | null;
  salario: number | null;
  data_admissao: string | null;
  data_demissao: string | null;
  motivo_demissao: string | null;
  ativo: boolean | null;
  pis_pasep: string | null;
  cargo: { nome?: string | null } | { nome?: string | null }[] | null;
}

interface DesligamentoRow {
  id: string;
  colaborador_id: string;
  tipo_rescisao: string;
  data_desligamento: string;
  motivo: string | null;
  mtv_deslig: string;
  aviso_previo_tipo: string;
  aviso_previo_dias: number | null;
  data_ultimo_dia_trabalhado: string | null;
  prazo_pagamento: string | null;
  status: string;
  payroll_sheet_id: string | null;
  verbas_previstas: unknown;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

function cargoNomeDe(row: ColaboradorDesligRow): string | null {
  const cargo = row.cargo;
  if (Array.isArray(cargo)) return cargo[0]?.nome ?? null;
  return cargo?.nome ?? null;
}

function parseVerbas(value: unknown): VerbaRescisaoPrevista[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      code: String(item.code || ''),
      name: String(item.name || ''),
      observation: String(item.observation || ''),
    }))
    .filter((item) => item.code);
}

function toDesligamento(row: DesligamentoRow): GTDesligamento {
  return {
    id: row.id,
    colaborador_id: row.colaborador_id,
    tipo_rescisao: row.tipo_rescisao as GTTipoRescisao,
    data_desligamento: row.data_desligamento,
    motivo: row.motivo,
    mtv_deslig: row.mtv_deslig,
    aviso_previo_tipo: row.aviso_previo_tipo as GTAvisoPrevioTipo,
    aviso_previo_dias: row.aviso_previo_dias,
    data_ultimo_dia_trabalhado: row.data_ultimo_dia_trabalhado,
    prazo_pagamento: row.prazo_pagamento,
    status: row.status as GTStatusDesligamento,
    payroll_sheet_id: row.payroll_sheet_id,
    verbas_previstas: parseVerbas(row.verbas_previstas),
    observacoes: row.observacoes,
    criado_por: row.criado_por,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function buscarDesligamentoAberto(colaboradorId: string): Promise<GTDesligamento | null> {
  const { data, error } = await supabaseAdmin
    .from('gt_desligamentos')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .neq('status', 'cancelado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01' || /gt_desligamentos/i.test(error.message || '')) {
      console.warn('[desligamento GET] tabela ausente:', error.message);
      return null;
    }
    throw error;
  }
  return data ? toDesligamento(data as DesligamentoRow) : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;
    const userId = resolveAuthUserId(auth.payload!);
    const { id } = await context.params;

    const { data: colaborador, error: colabErr } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('id, ativo, data_admissao, data_demissao, motivo_demissao')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (colabErr) {
      return NextResponse.json({ error: colabErr.message }, { status: 500 });
    }
    if (!colaborador) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    const podeRegistrar = await podeRegistrarDesligamento(userId, auth.payload?.role);
    let desligamento: GTDesligamento | null = null;
    try {
      desligamento = await buscarDesligamentoAberto(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao consultar desligamento';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const dataAdmissao = colaborador.data_admissao as string | null;
    return NextResponse.json({
      success: true,
      data: desligamento,
      pode_registrar: podeRegistrar,
      aviso_sugerido_dias: sugerirAvisoPrevioDias(
        dataAdmissao,
        new Date().toISOString().slice(0, 10),
      ),
      colaborador: {
        ativo: colaborador.ativo !== false,
        data_admissao: dataAdmissao,
        data_demissao: colaborador.data_demissao,
        motivo_demissao: colaborador.motivo_demissao,
      },
    });
  } catch (error) {
    console.error('[desligamento GET]', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAsoAgendamentoAuth(request);
    if (auth.error) return auth.error;
    const userId = resolveAuthUserId(auth.payload!);
    if (!userId) {
      return NextResponse.json({ error: 'Usuário do token não identificado' }, { status: 401 });
    }
    if (!(await podeRegistrarDesligamento(userId, auth.payload?.role))) {
      return NextResponse.json({ error: MENSAGEM_DESLIGAMENTO_NEGADO }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    if (!isTipoRescisao(body.tipo_rescisao)) {
      return NextResponse.json(
        { error: 'tipo_rescisao inválido. Use sem_justa_causa, pedido_demissao, justa_causa, acordo_mutuo, termino_contrato ou rescisao_indireta.' },
        { status: 400 },
      );
    }
    const tipoRescisao: TipoRescisao = body.tipo_rescisao;
    const dataDesligamento = String(body.data_desligamento || '');
    if (!isCivilDate(dataDesligamento)) {
      return NextResponse.json({ error: 'data_desligamento deve ser YYYY-MM-DD' }, { status: 400 });
    }

    const avisoTipo = isAvisoPrevioTipo(body.aviso_previo_tipo)
      ? body.aviso_previo_tipo
      : avisoDefaultParaTipo(tipoRescisao);

    const ultimoDiaRaw = body.data_ultimo_dia_trabalhado
      ? String(body.data_ultimo_dia_trabalhado)
      : '';
    if (ultimoDiaRaw && !isCivilDate(ultimoDiaRaw)) {
      return NextResponse.json(
        { error: 'data_ultimo_dia_trabalhado deve ser YYYY-MM-DD' },
        { status: 400 },
      );
    }

    const { data: colaborador, error: colabErr } = await supabaseAdmin
      .from('gt_colaboradores')
      .select(
        'id, nome_completo, cpf, matricula, salario, data_admissao, data_demissao, motivo_demissao, ativo, pis_pasep, cargo:gt_cargos(nome)',
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (colabErr) {
      return NextResponse.json({ error: colabErr.message }, { status: 500 });
    }
    if (!colaborador) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    const colab = colaborador as ColaboradorDesligRow;
    let existente: GTDesligamento | null = null;
    try {
      existente = await buscarDesligamentoAberto(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao consultar desligamento';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (existente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este colaborador já possui um desligamento em andamento ou concluído.',
          data: existente,
          pode_registrar: false,
        },
        { status: 409 },
      );
    }

    const mtvDeslig = mtvDesligParaTipo(
      tipoRescisao,
      typeof body.mtv_deslig === 'string' ? body.mtv_deslig : null,
    );
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';
    const observacoes = typeof body.observacoes === 'string' ? body.observacoes.trim() : '';
    const avisoDiasRaw = body.aviso_previo_dias;
    const avisoDias =
      typeof avisoDiasRaw === 'number' && Number.isFinite(avisoDiasRaw)
        ? Math.max(0, Math.round(avisoDiasRaw))
        : sugerirAvisoPrevioDias(colab.data_admissao, dataDesligamento);
    const verbas = verbasParaRescisao(tipoRescisao, avisoTipo);
    const prazo = prazoPagamentoRescisao(dataDesligamento);
    const ultimoDia = ultimoDiaRaw || dataDesligamento;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('gt_colaboradores')
      .update({
        ativo: false,
        data_demissao: dataDesligamento,
        motivo_demissao: mtvDeslig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, ativo, data_demissao, motivo_demissao')
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message || 'Erro ao atualizar o colaborador' },
        { status: 500 },
      );
    }

    const etapas: GTDesligamentoEtapas = {
      gt: { ok: true },
      payroll: { ok: false, skipped: true },
      esocial: { ok: false },
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('gt_desligamentos')
      .insert({
        colaborador_id: id,
        tipo_rescisao: tipoRescisao,
        data_desligamento: dataDesligamento,
        motivo: motivo || null,
        mtv_deslig: mtvDeslig,
        aviso_previo_tipo: avisoTipo,
        aviso_previo_dias: avisoDias,
        data_ultimo_dia_trabalhado: ultimoDia,
        prazo_pagamento: prazo,
        status: 'iniciado',
        verbas_previstas: verbas,
        observacoes: observacoes || null,
        criado_por: userId,
      })
      .select('*')
      .single();

    if (insertErr || !inserted) {
      etapas.gt = {
        ok: true,
        warning: insertErr?.message
          || 'Colaborador inativado, mas o registro em gt_desligamentos não foi criado (aplique a migration).',
      };
      console.warn('[desligamento POST] insert gt_desligamentos:', insertErr?.message);
    }

    let desligamento = inserted ? toDesligamento(inserted as DesligamentoRow) : null;

    const payroll = await tentarIntegrarFolhaRescisao({
      colaboradorId: id,
      nomeCompleto: colab.nome_completo,
      cpf: colab.cpf,
      matricula: colab.matricula,
      salario: colab.salario,
      dataAdmissao: colab.data_admissao,
      dataDesligamento,
      cargoNome: cargoNomeDe(colab),
      tipoRescisao,
      avisoPrevioDias: avisoDias,
      verbas,
      criadoPor: userId,
    });
    etapas.payroll = {
      ok: payroll.ok,
      skipped: payroll.skipped,
      sheet_id: payroll.sheet_id,
      warning: payroll.warning,
    };

    if (desligamento && payroll.sheet_id) {
      const nextStatus = payroll.ok ? 'calculado' : desligamento.status;
      const { data: patched } = await supabaseAdmin
        .from('gt_desligamentos')
        .update({
          payroll_sheet_id: payroll.sheet_id,
          status: nextStatus,
        })
        .eq('id', desligamento.id)
        .select('*')
        .maybeSingle();
      if (patched) {
        desligamento = toDesligamento(patched as DesligamentoRow);
      }
    }

    try {
      await autoGenerateESocialEvents(id);
      const cleanCpf = normalizeCpf(colab.cpf || '');
      if (cleanCpf.length === 11) {
        const { data: ev } = await supabaseAdmin
          .from('esocial_eventos')
          .select('id, status')
          .eq('evento_codigo', 'S-2299')
          .eq('cpf_trabalhador', cleanCpf)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ev?.id) {
          etapas.esocial = { ok: true, evento_id: ev.id };
        } else {
          etapas.esocial = {
            ok: false,
            warning: 'Geração S-2299 disparada, mas o evento ainda não foi encontrado',
          };
        }
      } else {
        etapas.esocial = {
          ok: false,
          warning: 'CPF inválido — e-Social S-2299 não pôde ser localizado após o disparo',
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao disparar e-Social';
      console.warn('[desligamento POST] e-Social:', message);
      etapas.esocial = { ok: false, warning: message };
    }

    return NextResponse.json({
      success: true,
      data: desligamento,
      etapas,
      colaborador: updated,
    }, { status: 201 });
  } catch (error) {
    console.error('[desligamento POST]', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
