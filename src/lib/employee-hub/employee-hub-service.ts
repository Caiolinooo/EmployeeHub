/**
 * Employee Hub Service — Central via for querying all employee data
 * across modules: personal info, documents, ASOs, embarques, e-Social events,
 * afastamentos, acidentes, treinamentos.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { formatCpf, normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { listarDocumentosAlertas } from '@/lib/gestao-tripulantes/documentos-alertas';
import { marcarPapeisConformidade } from '@/lib/gestao-tripulantes/validade-civil';
import {
  agruparDocumentosPorTipo,
  contarDocsPorStatusPrimario,
} from '@/lib/gestao-tripulantes/documento-historico';
import { overlayStatusEscalaHoje } from '@/lib/gestao-tripulantes/dashboard-service';
import {
  resolvePortalUser,
  type PortalUser,
} from '@/lib/employee-hub/portal-user';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────
export interface EmployeeFullRecord {
  colaborador: any;
  portalUser: PortalUser | null;
  documentsSummary: DocumentsSummary;
  documentos: any[];
  documentosAlertas: any[];
  latestAso: any | null;
  esocialTimeline: EsocialTimelineEntry[];
  esocialSummary: EsocialSummary;
  embarques: any[];
  afastamentos: any[];
  acidentes: any[];
  treinamentos: any[];
  ferias: any[];
  reembolsos: any[];
}

export interface DocumentsSummary {
  total: number;
  validos: number;
  vencidos: number;
  vencendo: number;
  pendentes: number;
  byType: Record<string, number>;
}

export interface EsocialTimelineEntry {
  id: string;
  evento_codigo: string;
  evento_nome?: string;
  status: string;
  cpf_trabalhador: string;
  data_criacao: string;
  data_envio?: string | null;
  data_processamento?: string | null;
  protocolo?: string | null;
  numero_recibo?: string | null;
  modulo_origem: string;
  entidade_origem_tipo?: string | null;
  erros?: any;
}

export interface EsocialSummary {
  total: number;
  pendentes: number;
  enviados: number;
  processados: number;
  erros: number;
  byEvent: Record<string, { total: number; status: string }>;
}

// ────────────────────────────────────────────────────────────────
// Full record: everything about an employee
// ────────────────────────────────────────────────────────────────
export async function getEmployeeFullRecord(colaboradorId: string): Promise<EmployeeFullRecord | null> {
  // 1. Colaborador base data
  const { data: colab, error: colabErr } = await supabaseAdmin
    .from('gt_colaboradores')
    .select(`
      *,
      gt_cargos:cargo_id (id, nome),
      gt_empresas:empresa_id (id, nome, cnpj),
      gt_embarcacoes:embarcacao_atual_id (id, nome),
      gt_centros_custo:centro_custo_id (id, nome, codigo)
    `)
    .eq('id', colaboradorId)
    .is('deleted_at', null)
    .maybeSingle();

  if (colabErr || !colab) return null;

  const cpf = normalizeCpf(colab.cpf || '');
  const email = String(colab.email || '').trim().toLowerCase();

  // Wave 1: GT data + portal identity (tax_id / email). Férias/reembolsos need the resolved user.
  const [docsPack, latestAso, timeline, embarques, afastamentos, acidentes, treinamentos, portalResolution, live] =
    await Promise.all([
      getDocumentsPack(colaboradorId),
      getLatestAso(colaboradorId),
      getEsocialTimeline(cpf),
      getEmbarques(colaboradorId),
      getAfastamentos(colaboradorId),
      getAcidentes(colaboradorId),
      getTreinamentos(colaboradorId),
      resolvePortalUser({
        colaboradorId: colab.id as string,
        userId: colab.user_id as string | null,
        cpf,
        email,
        nome: colab.nome_completo as string | null,
      }),
      overlayStatusEscalaHoje([
        {
          id: colab.id as string,
          status_embarque: colab.status_embarque as string | null,
          standby: colab.standby as boolean | null,
        },
      ]),
    ]);

  const portalUser = portalResolution.user;
  if (portalUser && !colab.user_id) {
    colab.user_id = portalUser.id;
  }

  const moduleUserIds = portalResolution.moduleUserIds.length
    ? portalResolution.moduleUserIds
    : portalUser?.id
      ? [portalUser.id]
      : [];

  const [ferias, reembolsos] = await Promise.all([
    getFerias(moduleUserIds),
    getReembolsos(moduleUserIds, cpf),
  ]);

  if (!live.error && live.rows[0]) {
    colab.status_embarque = live.rows[0].status_embarque;
    colab.standby = live.rows[0].standby;
    colab.escala_codigo_hoje = live.rows[0].escala_codigo_hoje;
  }

  const esocialSummary = buildEsocialSummary(timeline);

  return {
    colaborador: colab,
    portalUser,
    documentsSummary: docsPack.summary,
    documentos: docsPack.documentos,
    documentosAlertas: docsPack.alertas,
    latestAso,
    esocialTimeline: timeline,
    esocialSummary,
    embarques,
    afastamentos,
    acidentes,
    treinamentos,
    ferias,
    reembolsos,
  };
}

async function safeSelect<T = any>(run: () => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

async function getFerias(userIds: string[]): Promise<any[]> {
  if (!userIds.length) return [];
  return safeSelect(() =>
    supabaseAdmin
      .from('leave_requests')
      .select('id, user_id, start_date, end_date, status, justification, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(20),
  );
}

async function getReembolsos(userIds: string[], cpf: string): Promise<any[]> {
  const select = 'id, user_id, status, valor_total, created_at';
  if (userIds.length) {
    const byUser = await safeSelect(() =>
      supabaseAdmin
        .from('Reimbursement')
        .select(select)
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(20),
    );
    if (byUser.length) return byUser;
  }
  if (cpf.length === 11) {
    const masked = formatCpf(cpf);
    const byCpf = await safeSelect(() =>
      supabaseAdmin
        .from('Reimbursement')
        .select(select)
        .or(`cpf.eq.${cpf},cpf.eq.${masked}`)
        .order('created_at', { ascending: false })
        .limit(20),
    );
    if (byCpf.length) return byCpf;
  }
  return [];
}

// ────────────────────────────────────────────────────────────────
// Documents summary
// ────────────────────────────────────────────────────────────────
async function getDocumentsPack(colaboradorId: string): Promise<{
  summary: DocumentsSummary;
  documentos: any[];
  alertas: any[];
}> {
  const { data: docs } = await supabaseAdmin
    .from('gt_documentos')
    .select('id, colaborador_id, tipo_documento, subtipo, titulo, descricao, numero_documento, origem, data_emissao, data_validade, status_validacao, created_at')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null);

  const raw = docs || [];
  const marked = marcarPapeisConformidade(raw);
  const result: DocumentsSummary = {
    total: raw.length,
    validos: 0,
    vencidos: 0,
    vencendo: 0,
    pendentes: 0,
    byType: {},
  };

  for (const doc of marked) {
    const tipo = doc.tipo_documento || 'outro';
    result.byType[tipo] = (result.byType[tipo] || 0) + 1;
  }

  const counts = contarDocsPorStatusPrimario(raw);
  result.validos = counts.qtd_docs_validos;
  result.vencidos = counts.qtd_docs_vencidos;
  result.vencendo = counts.qtd_docs_vencendo;
  for (const g of agruparDocumentosPorTipo(raw)) {
    if (g.primary.status_validacao === 'pendente') result.pendentes += 1;
  }

  const alertasRes = await listarDocumentosAlertas({ colaboradorIds: [colaboradorId] });
  return {
    summary: result,
    documentos: marked.map((d) => ({ ...d, papel_conformidade: d.papel })),
    alertas: [...alertasRes.vencidos_vigentes, ...alertasRes.vencendo_vigentes, ...alertasRes.vencidos_historico],
  };
}

// ────────────────────────────────────────────────────────────────
// Latest ASO
// ────────────────────────────────────────────────────────────────
async function getLatestAso(colaboradorId: string): Promise<any | null> {
  const { data } = await supabaseAdmin
    .from('gt_documentos_aso')
    .select('*, gt_documentos:documento_id (titulo, arquivo_url, data_emissao, data_validade)')
    .eq('colaborador_id', colaboradorId)
    .order('data_realizacao', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

// ────────────────────────────────────────────────────────────────
// e-Social timeline (all events for a CPF)
// ────────────────────────────────────────────────────────────────
export async function getEsocialTimeline(cpf: string): Promise<EsocialTimelineEntry[]> {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (!cleanCpf || cleanCpf.length !== 11) return [];

  const { data: events } = await supabaseAdmin
    .from('esocial_eventos')
    .select(`
      id, evento_codigo, status, cpf_trabalhador,
      created_at, data_envio, data_processamento,
      protocolo_envio, numero_recibo, modulo_origem,
      entidade_origem_tipo, erros_processamento
    `)
    .eq('cpf_trabalhador', cleanCpf)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!events) return [];

  // Enrich with catalog names
  const { data: catalogo } = await supabaseAdmin
    .from('esocial_eventos_catalogo')
    .select('codigo_evento, nome');

  const catalogoMap = new Map<string, string>();
  if (catalogo) {
    for (const c of catalogo) {
      catalogoMap.set(c.codigo_evento, c.nome);
    }
  }

  return events.map(e => ({
    id: e.id,
    evento_codigo: e.evento_codigo,
    evento_nome: catalogoMap.get(e.evento_codigo) || e.evento_codigo,
    status: e.status,
    cpf_trabalhador: e.cpf_trabalhador,
    data_criacao: e.created_at,
    data_envio: e.data_envio,
    data_processamento: e.data_processamento,
    protocolo: e.protocolo_envio,
    numero_recibo: e.numero_recibo,
    modulo_origem: e.modulo_origem,
    entidade_origem_tipo: e.entidade_origem_tipo,
    erros: e.erros_processamento,
  }));
}

// ────────────────────────────────────────────────────────────────
// e-Social summary from timeline
// ────────────────────────────────────────────────────────────────
function buildEsocialSummary(timeline: EsocialTimelineEntry[]): EsocialSummary {
  const summary: EsocialSummary = {
    total: timeline.length,
    pendentes: 0,
    enviados: 0,
    processados: 0,
    erros: 0,
    byEvent: {},
  };

  for (const e of timeline) {
    if (['pendente_revisao', 'rascunho', 'fila_envio', 'enviando'].includes(e.status)) summary.pendentes++;
    else if (e.status === 'enviado') summary.enviados++;
    else if (e.status === 'processado') summary.processados++;
    else if (e.status === 'erro') summary.erros++;

    if (!summary.byEvent[e.evento_codigo]) {
      summary.byEvent[e.evento_codigo] = { total: 0, status: e.status };
    }
    summary.byEvent[e.evento_codigo].total++;
    // Keep the latest status
    summary.byEvent[e.evento_codigo].status = e.status;
  }

  return summary;
}

// ────────────────────────────────────────────────────────────────
// Embarques history
// ────────────────────────────────────────────────────────────────
async function getEmbarques(colaboradorId: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('gt_historico_embarques')
    .select('*, gt_embarcacoes:embarcacao_id (nome)')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null)
    .order('data_embarque', { ascending: false })
    .limit(50);

  return data || [];
}

// ────────────────────────────────────────────────────────────────
// Afastamentos
// ────────────────────────────────────────────────────────────────
async function getAfastamentos(colaboradorId: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('gt_afastamentos')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null)
    .order('data_inicio', { ascending: false })
    .limit(50);

  return data || [];
}

// ────────────────────────────────────────────────────────────────
// Acidentes (CAT)
// ────────────────────────────────────────────────────────────────
async function getAcidentes(colaboradorId: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('gt_acidentes')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .is('deleted_at', null)
    .order('dt_acidente', { ascending: false })
    .limit(50);

  return data || [];
}

// ────────────────────────────────────────────────────────────────
// Treinamentos
// ────────────────────────────────────────────────────────────────
async function getTreinamentos(colaboradorId: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('gt_documentos_treinamento')
    .select('*, gt_documentos:documento_id (titulo, data_validade, status_validacao)')
    .eq('colaborador_id', colaboradorId)
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}

// ────────────────────────────────────────────────────────────────
// Search employees (unified)
// ────────────────────────────────────────────────────────────────
export async function searchEmployees(params: {
  cpf?: string;
  nome?: string;
  limit?: number;
}): Promise<any[]> {
  let query = supabaseAdmin
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf, matricula, status_embarque, foto_url, cargo_id, gt_cargos:cargo_id (nome)')
    .is('deleted_at', null);

  if (params.cpf) {
    const cleanCpf = params.cpf.replace(/\D/g, '');
    query = query.or(`cpf.eq.${cleanCpf},cpf.eq.${cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`);
  }

  if (params.nome) {
    query = query.ilike('nome_completo', `%${params.nome}%`);
  }

  const { data } = await query.limit(params.limit || 20);
  const rows = (data || []) as Array<{ id: string; status_embarque?: string | null; standby?: boolean | null }>;
  const overlay = await overlayStatusEscalaHoje(rows);
  return overlay.error ? rows : overlay.rows;
}
