/**
 * Fast GET-by-id for Gestão de Tripulantes.
 * Bypasses gt_vw_colaboradores_completo (c.* includes mio_data + 5 correlated
 * subqueries) and runs independent lookups in two parallel waves.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { marcarPapeisConformidade } from '@/lib/gestao-tripulantes/validade-civil';
import { montarItensAlerta } from '@/lib/gestao-tripulantes/documentos-alertas';
import { contarDocsPorStatusPrimario, type DocumentoAgrupavel } from '@/lib/gestao-tripulantes/documento-historico';
import { overlayStatusEscalaHoje } from '@/lib/gestao-tripulantes/dashboard-service';

export const DEFAULT_INCLUDE = [
  'profile',
  'documentos',
  'embarques',
  'substituicoes',
  'esocial_asos',
] as const;

export type ColaboradorInclude = (typeof DEFAULT_INCLUDE)[number];

const PROFILE_SELECT = `
  id, user_id, nome_completo, cpf, rg, data_nascimento, email, telefone,
  nacionalidade, naturalidade, naturalidade_uf, pais_nascimento,
  nome_mae, nome_pai, estado_civil,
  endereco_logradouro, endereco_numero, endereco_complemento,
  endereco_bairro, endereco_cidade, endereco_uf, endereco_cep,
  centro_custo_id, empresa_id, embarcacao_atual_id, cargo_id,
  data_admissao, data_demissao, matricula, status_embarque, standby,
  data_ultimo_embarque, data_ultimo_desembarque, data_proximo_embarque,
  origem, mio_id, ultimo_sync_mio, foto_url, ativo, created_at, updated_at,
  sexo, genero, peso, altura, raca_cor, escolaridade, deficiencia, deficiencia_cid,
  orgao_emissor, data_emissao_rg, pis_pasep, ctps, ctps_serie, ctps_uf,
  cnh, cnh_categoria, cnh_validade, cnh_uf,
  titulo_eleitor, titulo_eleitor_zona, titulo_eleitor_sessao,
  certidao_tipo, certidao_numero, certidao_cartorio,
  salario, tipo_salario, forma_pagamento, sindicato, cbo,
  jornada_semanal, jornada_mensal, tipo_contrato, prazo_contrato,
  categoria_contrato, tipo_trabalho, tipo_mao_de_obra, regime_trabalho,
  escala_embarque, escala_folga, departamento, motivo_demissao,
  tipo_admissao, natureza_atividade, tipo_jornada, tipo_lotacao, matricula_esocial,
  dados_bancarios, dados_saude,
  cargo:gt_cargos(nome, nivel, ordem_exibicao),
  empresa:gt_empresas(nome, cnpj),
  embarcacao_atual:gt_embarcacoes!embarcacao_atual_id(nome, imo),
  centro_custo:gt_centros_custo(nome, codigo)
`.replace(/\s+/g, ' ').trim();

/** UI fields only — never ocr_texto (full OCR dump). */
const DOCUMENTOS_SELECT = `
  id, colaborador_id, user_id, tipo_documento, subtipo, titulo, descricao,
  numero_documento, orgao_emissor, data_emissao, data_validade,
  arquivo_url, arquivo_path, arquivo_tamanho_bytes, arquivo_tipo,
  ocr_status, ocr_dados_extraidos, ocr_data, ocr_erro,
  status_validacao, origem, origem_ref, status_revisao,
  numero_rastreio, arquivo_hash, identity_match, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const EMBARQUES_SELECT = `
  id, tipo, data_embarque, data_desembarque, data_prevista_desembarque,
  local_embarque, local_desembarque, voo_ida, voo_volta, observacoes,
  substituindo_id, origem, embarcacao:gt_embarcacoes(nome)
`.replace(/\s+/g, ' ').trim();

const ESOCIAL_ASO_SELECT = `
  id, evento_codigo, status, protocolo_envio, numero_recibo,
  data_envio, data_processamento, entidade_origem_id, created_at,
  dados_evento, cpf_trabalhador
`.replace(/\s+/g, ' ').trim();

export function parseIncludeParam(raw: string | null): Set<string> {
  if (!raw || raw === 'all') return new Set(DEFAULT_INCLUDE);
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const set = new Set(parts);
  set.add('profile');
  return set;
}

function asObj<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type FlattenedColaboradorRow = Record<string, unknown> & {
  cargo_nome: string | null;
  cargo_nivel: number | null;
  cargo_ordem: number | null;
  empresa_nome: string | null;
  empresa_cnpj: string | null;
  embarcacao_nome: string | null;
  embarcacao_imo: string | null;
  centro_custo_nome: string | null;
  centro_custo_codigo: string | null;
};

export function flattenColaboradorRow(row: Record<string, unknown>): FlattenedColaboradorRow {
  const cargo = asObj(row.cargo as { nome?: string; nivel?: number; ordem_exibicao?: number } | null);
  const empresa = asObj(row.empresa as { nome?: string; cnpj?: string } | null);
  const embarcacao = asObj(row.embarcacao_atual as { nome?: string; imo?: string } | null);
  const centro = asObj(row.centro_custo as { nome?: string; codigo?: string } | null);
  const {
    cargo: _cargo,
    empresa: _empresa,
    embarcacao_atual: _emb,
    centro_custo: _cc,
    ...rest
  } = row;
  void _cargo;
  void _empresa;
  void _emb;
  void _cc;
  return {
    ...rest,
    cargo_nome: cargo?.nome ?? null,
    cargo_nivel: cargo?.nivel ?? null,
    cargo_ordem: cargo?.ordem_exibicao ?? null,
    empresa_nome: empresa?.nome ?? null,
    empresa_cnpj: empresa?.cnpj ?? null,
    embarcacao_nome: embarcacao?.nome ?? null,
    embarcacao_imo: embarcacao?.imo ?? null,
    centro_custo_nome: centro?.nome ?? null,
    centro_custo_codigo: centro?.codigo ?? null,
  };
}

function flattenEmbarque(row: Record<string, unknown>) {
  const embarcacao = asObj(row.embarcacao as { nome?: string } | null);
  return {
    ...row,
    embarcacao_nome: embarcacao?.nome ?? null,
  };
}

function countDocsByStatus(documentos: DocumentoAgrupavel[]) {
  const counts = contarDocsPorStatusPrimario(documentos);
  return {
    qtd_docs_vencidos: counts.qtd_docs_vencidos,
    qtd_docs_vencendo: counts.qtd_docs_vencendo,
    qtd_docs_validos: counts.qtd_docs_validos,
  };
}

function enrichAndDedupDocumentos(
  rawDocs: any[],
  asoRecords: any[] | null,
  treRecords: any[] | null,
  eventosVinculados: any[] | null
) {
  let documentos = rawDocs || [];

  if (asoRecords && asoRecords.length > 0) {
    const asoDataMap: Record<string, any> = {};
    asoRecords.forEach((rec) => {
      asoDataMap[rec.documento_id] = rec;
    });
    documentos = documentos.map((doc) => {
      if (doc.tipo_documento === 'aso') {
        return { ...doc, aso_data: asoDataMap[doc.id] || null };
      }
      return doc;
    });
  }

  const eventoPorDocId: Record<string, any> = {};
  (eventosVinculados || []).forEach((ev) => {
    const docKey = ev.entidade_origem_id as string;
    if (!eventoPorDocId[docKey]) eventoPorDocId[docKey] = ev;
  });
  if (Object.keys(eventoPorDocId).length > 0) {
    documentos = documentos.map((doc) => {
      const ev = eventoPorDocId[doc.id];
      if (!ev) return doc;
      return {
        ...doc,
        aso_data: {
          ...(doc.aso_data || {}),
          esocial_evento_ref: {
            id: ev.id,
            evento_codigo: ev.evento_codigo,
            status: ev.status,
            numero_recibo: ev.numero_recibo,
            protocolo_envio: ev.protocolo_envio,
            data_envio: ev.data_envio,
            data_processamento: ev.data_processamento,
          },
        },
      };
    });
  }

  if (treRecords && treRecords.length > 0) {
    const treMap: Record<string, any> = {};
    treRecords.forEach((r) => {
      treMap[r.documento_id] = r;
    });
    documentos = documentos.map((doc) => {
      if (doc.tipo_documento === 'treinamento') {
        return { ...doc, treinamento_data: treMap[doc.id] || null };
      }
      return doc;
    });
  }

  const asoMap = new Map<string, any>();
  const nonAsoDocs: any[] = [];

  documentos.forEach((d) => {
    if (d.tipo_documento === 'aso') {
      const dRealiz = (d.aso_data?.data_realizacao || d.data_emissao || '').trim();
      const dValid = (d.data_validade || '').trim();
      const normTitle = (d.titulo || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/(\.pdf|\.jpg|\.png|_rotated|\(1\)|\(2\))/gi, '')
        .trim();
      const cleanUrl = (d.arquivo_url || '').split('?')[0];

      // Smart Dedup Key: Combina data de realização/emissão + título limpo ou URL
      const key = cleanUrl
        ? `url_${cleanUrl}`
        : `${normTitle}_${dRealiz || 'SEM_DATA'}_${dValid || 'SEM_VALID'}`;

      const existing = asoMap.get(key);
      if (!existing) {
        asoMap.set(key, d);
      } else {
        const existingScore =
          (existing.aso_data?.esocial_evento_ref?.numero_recibo || existing.aso_data?.esocial_status === 'processado' ? 1000 : 0) +
          (existing.aso_data?.esocial_status === 'enviado' ? 500 : 0) +
          (existing.ocr_status === 'concluido' ? 50 : 0) +
          (existing.ocr_dados_extraidos ? 20 : 0) +
          (existing.data_validade ? 10 : 0);

        const currentScore =
          (d.aso_data?.esocial_evento_ref?.numero_recibo || d.aso_data?.esocial_status === 'processado' ? 1000 : 0) +
          (d.aso_data?.esocial_status === 'enviado' ? 500 : 0) +
          (d.ocr_status === 'concluido' ? 50 : 0) +
          (d.ocr_dados_extraidos ? 20 : 0) +
          (d.data_validade ? 10 : 0);

        const winner = currentScore > existingScore ? d : existing;
        const loser = currentScore > existingScore ? existing : d;

        // Merge dados do perdedor no vencedor se faltar no vencedor
        const mergedAsoData = {
          ...(loser.aso_data || {}),
          ...(winner.aso_data || {}),
          esocial_evento_ref: winner.aso_data?.esocial_evento_ref || loser.aso_data?.esocial_evento_ref || null,
        };

        const mergedOcrData = {
          ...(loser.ocr_dados_extraidos || {}),
          ...(winner.ocr_dados_extraidos || {}),
        };

        asoMap.set(key, {
          ...winner,
          aso_data: mergedAsoData,
          ocr_dados_extraidos: Object.keys(mergedOcrData).length > 0 ? mergedOcrData : winner.ocr_dados_extraidos,
          data_validade: winner.data_validade || loser.data_validade || null,
        });
      }
    } else {
      nonAsoDocs.push(d);
    }
  });

  const uniqueAsos = Array.from(asoMap.values()).sort((a, b) => {
    const dateA = a.aso_data?.data_realizacao || a.data_emissao || a.created_at || '';
    const dateB = b.aso_data?.data_realizacao || b.data_emissao || b.created_at || '';
    return dateB.localeCompare(dateA);
  });

  return [...uniqueAsos, ...nonAsoDocs];
}

export interface ColaboradorDetailResult {
  data?: Record<string, unknown>;
  notFound?: boolean;
  error?: string;
  timingsMs: Record<string, number>;
}

export async function loadColaboradorDetail(
  id: string,
  include: Set<string>
): Promise<ColaboradorDetailResult> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const wantDocs = include.has('documentos');
  const wantEmb = include.has('embarques');
  const wantSub = include.has('substituicoes');
  const wantEsocial = include.has('esocial_asos');

  const wave1Start = Date.now();
  const [profileRes, docsRes, embRes, subRes] = await Promise.all([
    supabaseAdmin
      .from('gt_colaboradores')
      .select(PROFILE_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    wantDocs
      ? supabaseAdmin
          .from('gt_documentos')
          .select(DOCUMENTOS_SELECT)
          .eq('colaborador_id', id)
          .is('deleted_at', null)
          .order('data_validade', { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: [] as any[], error: null }),
    wantEmb
      ? supabaseAdmin
          .from('gt_historico_embarques')
          .select(EMBARQUES_SELECT)
          .eq('colaborador_id', id)
          .is('deleted_at', null)
          .order('data_embarque', { ascending: false })
      : Promise.resolve({ data: [] as any[], error: null }),
    wantSub
      ? supabaseAdmin
          .from('gt_historico_substituicoes')
          .select('*, substituto:gt_colaboradores!substituto_id(nome_completo), substituido:gt_colaboradores!substituido_id(nome_completo)')
          .or(`substituto_id.eq.${id},substituido_id.eq.${id}`)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  timings.wave1 = Date.now() - wave1Start;

  if (profileRes.error) {
    console.error('Erro ao buscar colaborador:', profileRes.error);
    return { error: 'Erro ao buscar colaborador', timingsMs: timings };
  }
  if (!profileRes.data) {
    return { notFound: true, timingsMs: timings };
  }

  const colaborador = flattenColaboradorRow(profileRes.data as unknown as Record<string, unknown>) as Record<string, any>;
  let documentos = (docsRes.data || []) as any[];
  const embarques = ((embRes.data || []) as Record<string, unknown>[]).map(flattenEmbarque);
  const substituicoes = subRes.data || [];

  const asoDocIds = documentos.filter((d) => d.tipo_documento === 'aso').map((d) => d.id);
  const treDocIds = documentos.filter((d) => d.tipo_documento === 'treinamento').map((d) => d.id);
  const cpfClean = normalizeCpf(String(colaborador.cpf || ''));

  const wave2Start = Date.now();
  const [asoRes, treRes, eventosRes, esocialRes, overlay] = await Promise.all([
    asoDocIds.length > 0
      ? supabaseAdmin.from('gt_documentos_aso').select('*').in('documento_id', asoDocIds)
      : Promise.resolve({ data: [] as any[] }),
    treDocIds.length > 0
      ? supabaseAdmin.from('gt_documentos_treinamento').select('*').in('documento_id', treDocIds)
      : Promise.resolve({ data: [] as any[] }),
    asoDocIds.length > 0
      ? supabaseAdmin
          .from('esocial_eventos')
          .select('id, evento_codigo, status, protocolo_envio, numero_recibo, data_envio, data_processamento, entidade_origem_id, created_at')
          .in('entidade_origem_id', asoDocIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    wantEsocial && cpfClean.length === 11
      ? supabaseAdmin
          .from('esocial_eventos')
          .select(ESOCIAL_ASO_SELECT)
          .eq('evento_codigo', 'S-2220')
          .eq('cpf_trabalhador', cpfClean)
      : Promise.resolve({ data: [] as any[] }),
    overlayStatusEscalaHoje([
      {
        id: String(colaborador.id),
        status_embarque: colaborador.status_embarque as string | null,
        standby: colaborador.standby as boolean | null,
      },
    ]),
  ]);
  timings.wave2 = Date.now() - wave2Start;

  if (!overlay.error && overlay.rows[0]) {
    colaborador.status_embarque = overlay.rows[0].status_embarque;
    colaborador.standby = overlay.rows[0].standby;
    colaborador.escala_codigo_hoje = overlay.rows[0].escala_codigo_hoje;
  }

  const rawDocs = documentos;
  const counts = countDocsByStatus(rawDocs);
  const alertas = montarItensAlerta(
    rawDocs.map((d) => ({
      id: d.id,
      colaborador_id: id,
      tipo_documento: d.tipo_documento,
      subtipo: d.subtipo ?? null,
      titulo: d.titulo,
      numero_documento: d.numero_documento ?? null,
      numero_rastreio: d.numero_rastreio ?? null,
      data_emissao: d.data_emissao ?? null,
      data_validade: d.data_validade ?? null,
      status_validacao: d.status_validacao ?? null,
      origem: d.origem ?? null,
      created_at: d.created_at ?? null,
    })),
    { [id]: { nome: colaborador.nome_completo || null, matricula: colaborador.matricula || null, cpf: colaborador.cpf || null } },
  );

  if (wantDocs) {
    documentos = enrichAndDedupDocumentos(
      documentos,
      asoRes.data || [],
      treRes.data || [],
      eventosRes.data || []
    );
    const marked = new Map(marcarPapeisConformidade(rawDocs).map((d) => [d.id, d.papel]));
    documentos = documentos.map((d) => ({ ...d, papel_conformidade: marked.get(d.id) || 'vigente' }));
  }
  timings.total = Date.now() - t0;

  return {
    data: {
      ...colaborador,
      ...counts,
      documentos,
      documentos_alertas: alertas,
      embarques,
      substituicoes,
      esocial_asos: esocialRes.data || [],
    },
    timingsMs: timings,
  };
}

export const LIST_SELECT = `
  id, nome_completo, cpf, email, matricula, foto_url,
  status_embarque, standby, data_proximo_embarque,
  ativo, regime_trabalho, escala_embarque, escala_folga,
  cargo:gt_cargos(nome),
  empresa:gt_empresas(nome, cnpj),
  embarcacao_atual:gt_embarcacoes!embarcacao_atual_id(nome),
  centro_custo:gt_centros_custo(nome, codigo)
`.replace(/\s+/g, ' ').trim();
