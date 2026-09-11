import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email-service';
import { buscarAsosComAlerta } from '@/lib/gestao-tripulantes/aso-vencimentos';
import { getAsoAgendamentoConfig } from '@/lib/gestao-tripulantes/aso-agendamento-config';
import {
  classificarCodigoEscalaParaAso,
  sugerirDatasAso,
} from '@/lib/gestao-tripulantes/aso-agendamento-sugestoes';
import { dayCodeForCivilDay, type EscalaEventoDia } from '@/lib/gestao-tripulantes/embarque-status';
import type {
  AsoAgendamentoAssinatura,
  AsoAgendamentoStatus,
  AsoSugestaoData,
} from '@/lib/gestao-tripulantes/aso-agendamento-status';
import { ASO_AGENDAMENTO_STATUS_ABERTOS } from '@/lib/gestao-tripulantes/aso-agendamento-status';
import { displayNameFromUser } from '@/lib/gestao-tripulantes/fechamento-assinatura';

const COLAB_SELECT = `
  id, user_id, nome_completo, cpf, email, matricula,
  cargo:gt_cargos(nome),
  empresa:gt_empresas(nome),
  embarcacao_atual:gt_embarcacoes!embarcacao_atual_id(nome)
`.replace(/\s+/g, ' ').trim();

const AGENDAMENTO_SELECT = `
  *,
  colaborador:gt_colaboradores(${COLAB_SELECT})
`.replace(/\s+/g, ' ').trim();

export interface AsoAgendamentoAtor {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  cargo: string;
  signatureUrl?: string;
}

export interface AsoCarimboInput {
  ator: AsoAgendamentoAtor;
  ip: string;
  acao: AsoAgendamentoAssinatura['acao'];
  papel: AsoAgendamentoAssinatura['papel'];
  dataRef: string;
  agendamentoId: string;
}

interface ColaboradorJoinRaw {
  id?: unknown;
  user_id?: unknown;
  nome_completo?: unknown;
  cpf?: unknown;
  email?: unknown;
  matricula?: unknown;
  cargo?: { nome?: string } | { nome?: string }[] | null;
  empresa?: { nome?: string } | { nome?: string }[] | null;
  embarcacao_atual?: { nome?: string } | { nome?: string }[] | null;
}

function asRel<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function flattenColaborador(raw: unknown) {
  const colab = asRel<ColaboradorJoinRaw>(raw);
  if (!colab || typeof colab.id !== 'string') return null;
  const cargo = asRel<{ nome?: string }>(colab.cargo);
  const empresa = asRel<{ nome?: string }>(colab.empresa);
  const embarcacao = asRel<{ nome?: string }>(colab.embarcacao_atual);
  return {
    id: colab.id,
    user_id: (colab.user_id as string | null) ?? null,
    nome_completo: String(colab.nome_completo || ''),
    cpf: String(colab.cpf || ''),
    email: (colab.email as string | null) ?? null,
    matricula: (colab.matricula as string | null) ?? null,
    cargo_nome: cargo?.nome ?? null,
    empresa_nome: empresa?.nome ?? null,
    embarcacao_nome: embarcacao?.nome ?? null,
  };
}

export type AsoAgendamentoFlat = Record<string, unknown> & {
  colaborador: ReturnType<typeof flattenColaborador>;
  status?: unknown;
  data_solicitada?: unknown;
  data_sugerida?: unknown;
  assinaturas?: unknown;
  solicitado_por_id?: unknown;
  observacoes?: unknown;
};

export function flattenAsoAgendamento(row: Record<string, unknown>): AsoAgendamentoFlat {
  return {
    ...row,
    colaborador: flattenColaborador(row.colaborador),
  };
}

export async function carregarEventosEscala(colaboradorId: string): Promise<EscalaEventoDia[]> {
  const { data, error } = await supabaseAdmin
    .from('gt_historico_embarques')
    .select('id, tipo, data_embarque, data_desembarque, data_prevista_desembarque, observacoes')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null)
    .order('data_embarque', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as EscalaEventoDia[];
}

export async function sugerirDatasParaColaborador(opts: {
  colaboradorId: string;
  dataValidade?: string | null;
}) {
  const cfg = await getAsoAgendamentoConfig();
  const eventos = await carregarEventosEscala(opts.colaboradorId);
  return {
    config: cfg,
    ...sugerirDatasAso({
      dataValidade: opts.dataValidade,
      eventos,
      antecedenciaDias: cfg.antecedencia_dias,
      minLeadDias: cfg.min_lead_dias,
      maxSugestoes: cfg.max_sugestoes,
    }),
  };
}

export function classificarDataSolicitada(eventos: EscalaEventoDia[], data: string) {
  const codigo = dayCodeForCivilDay(eventos, data);
  const cls = classificarCodigoEscalaParaAso(codigo);
  return { codigo_escala: codigo || '—', ...cls };
}

export function montarCarimboAso(input: AsoCarimboInput): AsoAgendamentoAssinatura {
  const nowIso = new Date().toISOString();
  const hashContent = `GT_ASO_AGENDAMENTO:${input.agendamentoId}:${input.dataRef}:${input.ator.nome}:${input.ator.cpf}:${nowIso}:${input.ip}:${input.acao}`;
  const assinaturaHash = crypto.createHash('sha256').update(hashContent).digest('hex');
  return {
    papel: input.papel,
    acao: input.acao,
    userId: input.ator.id,
    email: input.ator.email,
    nome: input.ator.nome,
    cpf: input.ator.cpf,
    cargo: input.ator.cargo,
    assinado_em: nowIso,
    dataHora: new Date().toLocaleString('pt-BR'),
    ip: input.ip,
    assinaturaUrl: input.ator.signatureUrl || '',
    assinaturaHash,
  };
}

async function appendLog(opts: {
  agendamentoId: string;
  acao: string;
  statusAnterior: string | null;
  statusNovo: string;
  ator: AsoAgendamentoAtor | null;
  ip: string;
  payload?: Record<string, unknown>;
}) {
  await supabaseAdmin.from('gt_aso_agendamentos_log').insert({
    agendamento_id: opts.agendamentoId,
    acao: opts.acao,
    status_anterior: opts.statusAnterior,
    status_novo: opts.statusNovo,
    ator_id: opts.ator?.id || null,
    ator_nome: opts.ator?.nome || null,
    ator_cpf: opts.ator?.cpf || null,
    ip: opts.ip,
    payload: opts.payload || {},
  });
}

export async function buscarAgendamentos(filtros: {
  status?: string[];
  colaboradorId?: string;
  includeCancelados?: boolean;
}) {
  let q = supabaseAdmin
    .from('gt_aso_agendamentos')
    .select(AGENDAMENTO_SELECT)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (filtros.colaboradorId) q = q.eq('colaborador_id', filtros.colaboradorId);
  if (filtros.status && filtros.status.length > 0) q = q.in('status', filtros.status);
  else if (!filtros.includeCancelados) q = q.neq('status', 'cancelado');

  const { data, error } = await q.limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => flattenAsoAgendamento(asRecord(row)));
}

export async function buscarAgendamentoPorId(id: string): Promise<(AsoAgendamentoFlat & { log: unknown[] }) | null> {
  const { data, error } = await supabaseAdmin
    .from('gt_aso_agendamentos')
    .select(AGENDAMENTO_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: log } = await supabaseAdmin
    .from('gt_aso_agendamentos_log')
    .select('*')
    .eq('agendamento_id', id)
    .order('created_at', { ascending: true });

  return {
    ...flattenAsoAgendamento(asRecord(data)),
    log: log || [],
  };
}

async function abertoDoColaborador(colaboradorId: string) {
  const { data, error } = await supabaseAdmin
    .from('gt_aso_agendamentos')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null)
    .in('status', [...ASO_AGENDAMENTO_STATUS_ABERTOS])
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertSugestao(opts: {
  colaboradorId: string;
  documentoAsoId?: string | null;
  dataValidade?: string | null;
  sugestoes: AsoSugestaoData[];
}) {
  const existente = await abertoDoColaborador(opts.colaboradorId);
  const dataSugerida = opts.sugestoes.find((s) => !s.bloqueado)?.data || opts.sugestoes[0]?.data || null;
  const payload = {
    colaborador_id: opts.colaboradorId,
    documento_aso_id: opts.documentoAsoId || null,
    data_validade: opts.dataValidade || null,
    data_sugerida: dataSugerida,
    datas_sugeridas: opts.sugestoes,
    updated_at: new Date().toISOString(),
  };

  if (existente) {
    if (existente.status === 'solicitado') {
      const { data } = await supabaseAdmin
        .from('gt_aso_agendamentos')
        .update({
          datas_sugeridas: opts.sugestoes,
          data_sugerida: existente.data_sugerida || dataSugerida,
          data_validade: opts.dataValidade || existente.data_validade,
          documento_aso_id: opts.documentoAsoId || existente.documento_aso_id,
        })
        .eq('id', existente.id)
        .select('*')
        .single();
      return data;
    }
    const { data, error } = await supabaseAdmin
      .from('gt_aso_agendamentos')
      .update(payload)
      .eq('id', existente.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    await appendLog({
      agendamentoId: existente.id,
      acao: 'sugestoes_atualizadas',
      statusAnterior: existente.status,
      statusNovo: existente.status,
      ator: null,
      ip: 'system',
      payload: { data_sugerida: dataSugerida, total: opts.sugestoes.length },
    });
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('gt_aso_agendamentos')
    .insert({ ...payload, status: 'sugerido' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  await appendLog({
    agendamentoId: data.id,
    acao: 'gerado',
    statusAnterior: null,
    statusNovo: 'sugerido',
    ator: null,
    ip: 'system',
    payload: { data_sugerida: dataSugerida, total: opts.sugestoes.length },
  });
  return data;
}

export async function gerarSugestoesEmLote(): Promise<{ gerados: number; atualizados: number; ignorados: number }> {
  const cfg = await getAsoAgendamentoConfig();
  const { vencidos, vencendo } = await buscarAsosComAlerta(cfg.antecedencia_dias);
  const lista = [...vencidos, ...vencendo];
  let gerados = 0;
  let atualizados = 0;
  let ignorados = 0;

  for (const item of lista) {
    const colaboradorId = item.colaborador?.id;
    if (!colaboradorId) {
      ignorados += 1;
      continue;
    }
    const { data: marcado } = await supabaseAdmin
      .from('gt_aso_agendamentos')
      .select('id')
      .eq('colaborador_id', colaboradorId)
      .eq('status', 'marcado')
      .is('deleted_at', null)
      .gte('data_marcada', new Date().toISOString().slice(0, 10))
      .maybeSingle();
    if (marcado) {
      ignorados += 1;
      continue;
    }

    const eventos = await carregarEventosEscala(colaboradorId);
    const result = sugerirDatasAso({
      dataValidade: item.data_validade,
      eventos,
      antecedenciaDias: cfg.antecedencia_dias,
      minLeadDias: cfg.min_lead_dias,
      maxSugestoes: cfg.max_sugestoes,
    });
    const before = await abertoDoColaborador(colaboradorId);
    await upsertSugestao({
      colaboradorId,
      documentoAsoId: item.id,
      dataValidade: item.data_validade,
      sugestoes: result.sugestoes,
    });
    if (before) atualizados += 1;
    else gerados += 1;
  }

  return { gerados, atualizados, ignorados };
}

async function destinatariosLogistica(): Promise<{ emails: string[]; userIds: string[] }> {
  const cfg = await getAsoAgendamentoConfig();
  const emails = new Set<string>([...cfg.emails_logistica, ...cfg.emails_cc]);
  const userIds = new Set<string>();

  const { data: managers } = await supabaseAdmin
    .from('users_unified')
    .select('id, email, role')
    .in('role', ['admin', 'ADMIN', 'administrador', 'ADMINISTRADOR', 'superadmin', 'SUPERADMIN', 'manager', 'MANAGER'])
    .limit(40);

  for (const m of managers || []) {
    if (m.id) userIds.add(m.id);
    if (m.email) emails.add(String(m.email).toLowerCase().trim());
  }

  if (emails.size === 0) emails.add('logistica@groupabz.com');
  return { emails: [...emails].filter(Boolean), userIds: [...userIds] };
}

async function notificarPortal(opts: {
  userIds: string[];
  title: string;
  message: string;
  actionUrl: string;
  priority?: string;
}) {
  if (opts.userIds.length === 0) return;
  const now = new Date().toISOString();
  await supabaseAdmin.from('notifications').insert(
    opts.userIds.map((user_id) => ({
      user_id,
      type: 'aso_agendamento',
      title: opts.title,
      message: opts.message,
      priority: opts.priority || 'high',
      action_url: opts.actionUrl,
      created_at: now,
    })),
  );
}

function htmlSolicitacao(opts: {
  colaboradorNome: string;
  data: string;
  codigo: string;
  validade: string | null;
  solicitante: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 640px;">
      <div style="background:#002060;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">ABZ Group — Solicitação de ASO</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:.9;">Aprovação de logística necessária</p>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
        <p>O Departamento Pessoal solicitou agendamento de ASO que precisa da aprovação da logística para não conflitar com a escala.</p>
        <ul>
          <li><strong>Colaborador:</strong> ${opts.colaboradorNome}</li>
          <li><strong>Data solicitada:</strong> ${opts.data}</li>
          <li><strong>Marcação na escala:</strong> ${opts.codigo}</li>
          <li><strong>Validade atual do ASO:</strong> ${opts.validade || '—'}</li>
          <li><strong>Solicitante:</strong> ${opts.solicitante}</li>
        </ul>
        <p style="font-size:13px;">Acesse o portal em <strong>Gestão de Tripulantes → ASO Logística</strong> para aprovar ou reprovar com assinatura digital.</p>
      </div>
    </div>
  `;
}

export async function solicitarAgendamento(opts: {
  colaboradorId: string;
  documentoAsoId?: string | null;
  dataValidade?: string | null;
  dataSolicitada: string;
  observacoes?: string;
  signatureUrl?: string;
  ator: AsoAgendamentoAtor;
  ip: string;
}) {
  const data = String(opts.dataSolicitada || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error('Data solicitada inválida (use YYYY-MM-DD)');
  }

  const eventos = await carregarEventosEscala(opts.colaboradorId);
  const dia = classificarDataSolicitada(eventos, data);
  const cfgSug = await sugerirDatasParaColaborador({
    colaboradorId: opts.colaboradorId,
    dataValidade: opts.dataValidade,
  });

  const { data: colab } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id, nome_completo, user_id, email, cpf')
    .eq('id', opts.colaboradorId)
    .maybeSingle();
  if (!colab) throw new Error('Colaborador não encontrado');

  let row = await abertoDoColaborador(opts.colaboradorId);
  if (!row) {
    const inserted = await supabaseAdmin
      .from('gt_aso_agendamentos')
      .insert({
        colaborador_id: opts.colaboradorId,
        documento_aso_id: opts.documentoAsoId || null,
        data_validade: opts.dataValidade || null,
        data_sugerida: cfgSug.sugestoes[0]?.data || data,
        datas_sugeridas: cfgSug.sugestoes,
        status: 'sugerido',
      })
      .select('*')
      .single();
    if (inserted.error) throw new Error(inserted.error.message);
    row = inserted.data;
  }

  const carimbo = montarCarimboAso({
    ator: { ...opts.ator, signatureUrl: opts.signatureUrl || opts.ator.signatureUrl },
    ip: opts.ip,
    acao: 'solicitar',
    papel: 'dp',
    dataRef: data,
    agendamentoId: row.id,
  });
  const assinaturas = Array.isArray(row.assinaturas) ? [...row.assinaturas, carimbo] : [carimbo];
  const dest = await destinatariosLogistica();

  const { data: updated, error } = await supabaseAdmin
    .from('gt_aso_agendamentos')
    .update({
      status: 'solicitado',
      documento_aso_id: opts.documentoAsoId || row.documento_aso_id,
      data_validade: opts.dataValidade || row.data_validade,
      data_solicitada: data,
      data_marcada: null,
      escala_codigo_solicitada: dia.codigo_escala,
      conflito_on: dia.conflito_on,
      observacoes: opts.observacoes || row.observacoes,
      motivo_reprovacao: null,
      solicitado_por_id: opts.ator.id,
      solicitado_por_nome: opts.ator.nome,
      solicitado_por_cpf: opts.ator.cpf,
      solicitado_em: carimbo.assinado_em,
      solicitado_ip: opts.ip,
      solicitacao_assinatura_url: carimbo.assinaturaUrl,
      solicitacao_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_enviados: dest.emails,
    })
    .eq('id', row.id)
    .select(AGENDAMENTO_SELECT)
    .single();

  if (error) throw new Error(error.message);

  await appendLog({
    agendamentoId: row.id,
    acao: 'solicitado',
    statusAnterior: row.status,
    statusNovo: 'solicitado',
    ator: opts.ator,
    ip: opts.ip,
    payload: { data_solicitada: data, escala: dia, hash: carimbo.assinaturaHash },
  });

  const nome = colab.nome_completo || 'Colaborador';
  await notificarPortal({
    userIds: dest.userIds,
    title: `ASO pendente de logística — ${nome}`,
    message: `DP solicitou ASO em ${data} (escala ${dia.codigo_escala}). Aprove ou reprove no painel.`,
    actionUrl: '/department/gestao-tripulantes?tab=aso-logistica',
    priority: dia.conflito_on ? 'high' : 'normal',
  });

  try {
    await sendEmail(
      dest.emails,
      `[ASO] Solicitação de agendamento — ${nome} em ${data}`,
      `O DP solicitou ASO para ${nome} em ${data}. Acesse o portal para aprovar.`,
      htmlSolicitacao({
        colaboradorNome: nome,
        data,
        codigo: dia.codigo_escala,
        validade: opts.dataValidade || null,
        solicitante: opts.ator.nome,
      }),
    );
  } catch (err) {
    console.warn('[aso-agendamento] e-mail logística falhou:', err);
  }

  return flattenAsoAgendamento(asRecord(updated));
}

export async function decidirAgendamento(opts: {
  id: string;
  acao: 'aprovar' | 'reprovar';
  motivo?: string;
  signatureUrl?: string;
  ator: AsoAgendamentoAtor;
  ip: string;
}) {
  const atual = await buscarAgendamentoPorId(opts.id);
  if (!atual) throw new Error('Agendamento não encontrado');
  const statusAtual = String(atual.status || '') as AsoAgendamentoStatus;
  if (statusAtual !== 'solicitado') {
    throw new Error('Somente solicitações pendentes de logística podem ser decididas');
  }

  const dataRef = String(atual.data_solicitada || atual.data_sugerida || '').slice(0, 10);
  const novoStatus: AsoAgendamentoStatus = opts.acao === 'aprovar' ? 'marcado' : 'reprovado';
  if (opts.acao === 'reprovar' && !String(opts.motivo || '').trim()) {
    throw new Error('Informe o motivo da reprovação');
  }

  const carimbo = montarCarimboAso({
    ator: { ...opts.ator, signatureUrl: opts.signatureUrl || opts.ator.signatureUrl },
    ip: opts.ip,
    acao: opts.acao,
    papel: 'logistica',
    dataRef,
    agendamentoId: opts.id,
  });
  const assinaturas = Array.isArray(atual.assinaturas) ? [...atual.assinaturas, carimbo] : [carimbo];

  const patch: Record<string, unknown> = {
    status: novoStatus,
    assinaturas,
    aprovado_por_id: opts.ator.id,
    aprovado_por_nome: opts.ator.nome,
    aprovado_por_cpf: opts.ator.cpf,
    aprovado_em: carimbo.assinado_em,
    aprovado_ip: opts.ip,
    assinatura_url: carimbo.assinaturaUrl,
    assinatura_hash: carimbo.assinaturaHash,
  };
  if (opts.acao === 'aprovar') {
    patch.data_marcada = dataRef;
    patch.motivo_reprovacao = null;
  } else {
    patch.motivo_reprovacao = String(opts.motivo).trim();
    patch.data_marcada = null;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('gt_aso_agendamentos')
    .update(patch)
    .eq('id', opts.id)
    .select(AGENDAMENTO_SELECT)
    .single();
  if (error) throw new Error(error.message);

  await appendLog({
    agendamentoId: opts.id,
    acao: opts.acao,
    statusAnterior: statusAtual,
    statusNovo: novoStatus,
    ator: opts.ator,
    ip: opts.ip,
    payload: { motivo: opts.motivo || null, hash: carimbo.assinaturaHash, data: dataRef },
  });

  const colab = flattenColaborador(atual.colaborador) || (atual.colaborador as ReturnType<typeof flattenColaborador>);
  const dpIds: string[] = [];
  if (atual.solicitado_por_id) dpIds.push(String(atual.solicitado_por_id));
  if (colab?.user_id) dpIds.push(colab.user_id);

  const { data: dpUsers } = await supabaseAdmin
    .from('users_unified')
    .select('id, email, role')
    .in('role', ['dp', 'DP', 'admin', 'ADMIN', 'manager', 'MANAGER'])
    .limit(20);
  const emails = new Set<string>();
  for (const u of dpUsers || []) {
    if (u.id) dpIds.push(u.id);
    if (u.email) emails.add(String(u.email).toLowerCase());
  }
  if (colab?.email) emails.add(colab.email.toLowerCase());

  const nome = colab?.nome_completo || 'Colaborador';
  const title =
    opts.acao === 'aprovar'
      ? `ASO marcado — ${nome} em ${dataRef}`
      : `ASO reprovado pela logística — ${nome}`;
  const message =
    opts.acao === 'aprovar'
      ? `Logística aprovou o ASO de ${nome} para ${dataRef}. Status: marcado.`
      : `Logística reprovou o ASO de ${nome} (${dataRef}). Motivo: ${opts.motivo}`;

  await notificarPortal({
    userIds: [...new Set(dpIds)],
    title,
    message,
    actionUrl: '/department/dp',
    priority: opts.acao === 'reprovar' ? 'high' : 'normal',
  });

  if (emails.size > 0) {
    try {
      await sendEmail(
        [...emails],
        title,
        message,
        `<div style="font-family:Arial,sans-serif;padding:16px;">
          <h2 style="color:#002060;">${title}</h2>
          <p>${message}</p>
          <p><strong>Hash:</strong> <code>${carimbo.assinaturaHash}</code></p>
          <p><strong>Assinado por:</strong> ${opts.ator.nome} · IP ${opts.ip}</p>
        </div>`,
      );
    } catch (err) {
      console.warn('[aso-agendamento] e-mail DP falhou:', err);
    }
  }

  return flattenAsoAgendamento(asRecord(updated));
}

export async function cancelarAgendamento(opts: {
  id: string;
  motivo?: string;
  ator: AsoAgendamentoAtor;
  ip: string;
}) {
  const atual = await buscarAgendamentoPorId(opts.id);
  if (!atual) throw new Error('Agendamento não encontrado');
  const statusAtual = String(atual.status || '') as AsoAgendamentoStatus;
  if (statusAtual === 'marcado' || statusAtual === 'cancelado') {
    throw new Error('Não é possível cancelar um ASO já marcado ou cancelado');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('gt_aso_agendamentos')
    .update({
      status: 'cancelado',
      observacoes: opts.motivo || (typeof atual.observacoes === 'string' ? atual.observacoes : null),
    })
    .eq('id', opts.id)
    .select(AGENDAMENTO_SELECT)
    .single();
  if (error) throw new Error(error.message);

  await appendLog({
    agendamentoId: opts.id,
    acao: 'cancelado',
    statusAnterior: statusAtual,
    statusNovo: 'cancelado',
    ator: opts.ator,
    ip: opts.ip,
    payload: { motivo: opts.motivo || null },
  });

  return flattenAsoAgendamento(asRecord(updated));
}

export async function loadAtorFromUserId(userId: string): Promise<AsoAgendamentoAtor> {
  const { data } = await supabaseAdmin
    .from('users_unified')
    .select('id, first_name, last_name, name, email, tax_id, signature_url, role')
    .eq('id', userId)
    .maybeSingle();
  const row = (data || {}) as {
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    email?: string | null;
    tax_id?: string | null;
    signature_url?: string | null;
    role?: string | null;
  };
  return {
    id: userId,
    nome: displayNameFromUser(row),
    email: (row.email || '').toLowerCase(),
    cpf: row.tax_id || '',
    cargo: row.role || '',
    signatureUrl: row.signature_url || '',
  };
}
