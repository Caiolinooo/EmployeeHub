import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { generateEventXML, validateEventXML, validateEventData, updateEvento, logEnvio } from '@/services/eSocialService';
import { cpfsMatch, normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { sanitizeTsNome } from '@/lib/e-social/ts-nome';

export const dynamic = 'force-dynamic';

// ────────────────────────────────────────────────────────────────
// GET — cross-reference Documento ASO → eventos e-Social
// Retorna todos os eventos e-Social vinculados ao documento com
// protocolo, recibo, datas de envio/processamento, status e erros.
// ────────────────────────────────────────────────────────────────
interface EsocialEventoRef {
  id: string;
  evento_codigo: string;
  cpf_trabalhador: string | null;
  matricula: string | null;
  cnpj_empregador: string | null;
  status: string;
  protocolo_envio: string | null;
  numero_recibo: string | null;
  data_envio: string | null;
  data_processamento: string | null;
  erros_processamento: unknown;
  ultimo_erro: string | null;
  tentativas_envio: number;
  created_at: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const { id: docId } = await context.params;

    // Validate UUID format early (avoids Postgres cast errors)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(docId)) {
      return NextResponse.json({ error: 'ID de documento inválido' }, { status: 400 });
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from('gt_documentos')
      .select('id, tipo_documento, titulo, data_emissao, data_validade, colaborador_id, colaborador:gt_colaboradores!colaborador_id(id, nome_completo, cpf, matricula, matricula_esocial)')
      .eq('id', docId)
      .is('deleted_at', null)
      .maybeSingle();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    const isAso = doc.tipo_documento === 'aso';

    const { data: asoData } = isAso
      ? await supabaseAdmin
          .from('gt_documentos_aso')
          .select('*')
          .eq('documento_id', docId)
          .maybeSingle()
      : { data: null };

    // Collect events linked to this document:
    // 1) direct link via entidade_origem_id
    // 2) tracked link via gt_documentos_aso.esocial_evento_id
    const eventoIds = new Set<string>();

    const { data: byOrigem } = await supabaseAdmin
      .from('esocial_eventos')
      .select('*')
      .eq('entidade_origem_id', docId)
      .order('created_at', { ascending: false });

    (byOrigem || []).forEach(ev => eventoIds.add(ev.id));

    if (asoData?.esocial_evento_id) {
      eventoIds.add(asoData.esocial_evento_id);
    }

    let eventos: EsocialEventoRef[] = [];
    if (eventoIds.size > 0) {
      const { data: fetched, error } = await supabaseAdmin
        .from('esocial_eventos')
        .select('id, evento_codigo, cpf_trabalhador, matricula, cnpj_empregador, status, protocolo_envio, numero_recibo, data_envio, data_processamento, erros_processamento, ultimo_erro, tentativas_envio, created_at')
        .in('id', Array.from(eventoIds))
        .order('created_at', { ascending: false });

      if (!error) eventos = (fetched || []) as EsocialEventoRef[];
    }

    const ultimoEvento = eventos.length > 0 ? eventos[0] : null;

    // Consistency signals surfaced alongside the cross-reference
    const inconsistencias: string[] = [];
    if (isAso && asoData?.cpf_documento && ultimoEvento?.cpf_trabalhador) {
      if (!cpfsMatch(asoData.cpf_documento, ultimoEvento.cpf_trabalhador)) {
        inconsistencias.push(
          `cpf_documento (${normalizeCpf(asoData.cpf_documento)}) difere do cpf_trabalhador do evento (${normalizeCpf(ultimoEvento.cpf_trabalhador)})`
        );
      }
    }
    if (isAso && asoData?.esocial_status && ultimoEvento?.status) {
      const esperado = mapEventoStatusParaAso(ultimoEvento.status);
      if (esperado && asoData.esocial_status !== esperado && asoData.esocial_status !== 'quarentena') {
        inconsistencias.push(
          `esocial_status do documento (${asoData.esocial_status}) diverge do status do último evento (${ultimoEvento.status} → ${esperado})`
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        documento: {
          id: doc.id,
          tipo_documento: doc.tipo_documento,
          titulo: doc.titulo,
          data_emissao: doc.data_emissao,
          data_validade: doc.data_validade,
          colaborador: doc.colaborador,
        },
        aso: asoData
          ? {
              esocial_status: asoData.esocial_status,
              esocial_evento_id: asoData.esocial_evento_id,
              esocial_protocolo: asoData.esocial_protocolo,
              esocial_numero_recibo: asoData.esocial_numero_recibo,
              esocial_data_envio: asoData.esocial_data_envio,
              identity_match: asoData.identity_match,
            }
          : null,
        eventos: eventos,
        total_eventos: eventos.length,
        ultimo_evento: ultimoEvento,
        inconsistencias,
      },
    });
  } catch (error) {
    console.error('Erro ao consultar eventos E-Social do documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/** Maps esocial_eventos.status → mirrored gt_documentos_aso.esocial_status (same CASE as tracking backfills). */
function mapEventoStatusParaAso(status: string): string | null {
  switch (status) {
    case 'rascunho':
    case 'devolvido':
    case 'revisao_rejeitado':
      return 'erro_validacao';
    case 'erro':
      return 'erro';
    case 'processado':
      return 'processado';
    case 'enviado':
    case 'enviando':
    case 'fila_envio':
      return 'enviado';
    case 'pendente_revisao':
    case 'revisao_aprovado':
      return 'pendente_revisao';
    default:
      return 'pendente';
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const { id: docId } = await context.params;

    // Fetch document with collaborator's matricula
    const { data: doc, error: docError } = await supabaseAdmin
      .from('gt_documentos')
      .select('*, colaborador:gt_colaboradores!colaborador_id(id, nome_completo, cpf, matricula, matricula_esocial)')
      .eq('id', docId)
      .is('deleted_at', null)
      .maybeSingle();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    if (doc.tipo_documento !== 'aso') {
      return NextResponse.json({ error: 'Documento não é um ASO' }, { status: 400 });
    }

    const colaborador = doc.colaborador as {
      id: string;
      nome_completo: string;
      cpf: string;
      matricula?: string;
      matricula_esocial?: string;
    } | null;

    const { data: asoData, error: asoError } = await supabaseAdmin
      .from('gt_documentos_aso')
      .select('*')
      .eq('documento_id', docId)
      .maybeSingle();

    if (asoError || !asoData) {
      return NextResponse.json({ error: 'Dados detalhados do ASO não encontrados. Execute o OCR primeiro.' }, { status: 400 });
    }

    if (asoData.esocial_status === 'quarentena' || asoData.identity_match === 'quarantine') {
      return NextResponse.json({
        error: 'ASO em quarentena de identidade — CPF do documento não bate com um colaborador válido. Corrija o vínculo antes de enviar.',
      }, { status: 400 });
    }

    // Check if already queued
    if (['enviado', 'processado', 'pendente', 'pendente_revisao'].includes(asoData.esocial_status || '')) {
      return NextResponse.json({ error: 'ASO já foi processado para o E-Social' }, { status: 400 });
    }

    // Prefer OCR CPF for e-Social compliance; block on mismatch with profile
    const cpfOcr = normalizeCpf(asoData.cpf_documento || '');
    const cpfPerfil = normalizeCpf(colaborador?.cpf || '');
    const ocrDados = (doc.ocr_dados_extraidos || {}) as { cpf?: string };
    const cpfFromOcrDados = normalizeCpf(ocrDados.cpf || '');
    const cpfDocumento = cpfOcr.length === 11 ? cpfOcr : (cpfFromOcrDados.length === 11 ? cpfFromOcrDados : '');

    if (cpfDocumento && cpfPerfil && !cpfsMatch(cpfDocumento, cpfPerfil)) {
      return NextResponse.json({
        error: `CPF do ASO (OCR: ${cpfDocumento}) difere do CPF do perfil (${cpfPerfil}). Envio bloqueado.`,
        code: 'ASO_CPF_MISMATCH',
        cpf_documento: cpfDocumento,
        cpf_perfil: cpfPerfil,
      }, { status: 400 });
    }

    // Gate duro: sem CPF extraído pelo OCR não há prova de identidade — nunca enviar.
    // (Impede que um ASO trocado seja lançado com o CPF do perfil onde foi upado.)
    if (!cpfDocumento) {
      return NextResponse.json({
        error: 'Execute o OCR / identidade não verificada: este ASO não tem CPF extraído e não pode ser enviado ao E-Social.',
        code: 'ASO_CPF_NAO_EXTRAIDO',
      }, { status: 409 });
    }

    if (!cpfPerfil) {
      return NextResponse.json({ error: 'CPF não disponível no perfil do colaborador.' }, { status: 400 });
    }

    // Fetch CNPJ of the collaborator's employer company
    let cnpj = '';
    if (doc.colaborador_id) {
      const { data: colabCnpj } = await supabaseAdmin
        .from('gt_colaboradores')
        .select('gt_empresas!empresa_id(cnpj)')
        .eq('id', doc.colaborador_id)
        .maybeSingle();
      const rawCnpj = (colabCnpj as { gt_empresas?: { cnpj?: string } } | null)?.gt_empresas?.cnpj || '';
      cnpj = rawCnpj.replace(/\D/g, '');
    }

    // Compliance: send OCR CPF when present, else profile
    const cpfLimpo = cpfDocumento || cpfPerfil;

    // Create e-Social event record (S-2220 - Monitoramento da Saúde do Trabalhador)
    const { data: evento, error: eventoError } = await supabaseAdmin
      .from('esocial_eventos')
      .insert({
        evento_codigo: 'S-2220',
        cpf_trabalhador: cpfLimpo,
        cnpj_empregador: cnpj || null,
        matricula: colaborador?.matricula_esocial || colaborador?.matricula || null,
        dados_evento: {
          documento_id: docId,
          colaborador_id: doc.colaborador_id,
          tipo_exame: asoData.tipo_exame || 'periodico',
          data_realizacao: asoData.data_realizacao || doc.data_emissao,
          resultado: asoData.resultado || 'apto',
          medico_nome: sanitizeTsNome(asoData.medico_nome || '') || null,
          medico_crm: asoData.medico_crm,
          medico_uf: asoData.medico_uf,
          medico_pcmso_nome: sanitizeTsNome(asoData.medico_pcmso_nome || '') || null,
          medico_pcmso_crm: asoData.medico_pcmso_crm,
          medico_pcmso_uf: asoData.medico_pcmso_uf,
          exames_realizados: asoData.exames_realizados,
          nome_clinica: asoData.nome_clinica,
          data_validade: doc.data_validade,
          matricula_esocial: colaborador?.matricula_esocial || '',
          matricula: colaborador?.matricula || '',
        },
        status: 'pendente_revisao',
        modulo_origem: 'ocr',
        entidade_origem_id: docId,
        entidade_origem_tipo: 'aso'
      })
      .select('id')
      .single();

    if (eventoError) {
      console.error('Erro ao criar evento E-Social:', eventoError);
      return NextResponse.json({ error: 'Erro ao criar evento E-Social no banco de dados' }, { status: 500 });
    }

    // Generate XML for the S-2220 event
    let xmlGerado = '';
    let xmlValido = false;
    let errosValidacao: string[] = [];

    try {
      const eventData = {
        cpf: cpfLimpo,
        cnpj,
        tpAmb: 2,
        indRetif: 1,
        matricula: colaborador?.matricula_esocial || colaborador?.matricula || '',
        dadosEspecificos: {
          tipoExame: asoData.tipo_exame || 'periodico',
          dataRealizacao: asoData.data_realizacao || doc.data_emissao,
          resultado: asoData.resultado || 'apto',
          medico_nome: sanitizeTsNome(asoData.medico_nome || ''),
          medico_crm: asoData.medico_crm || '',
          medico_uf: asoData.medico_uf || '',
          medico_pcmso_nome: sanitizeTsNome(asoData.medico_pcmso_nome || ''),
          medico_pcmso_crm: asoData.medico_pcmso_crm || '',
          medico_pcmso_uf: asoData.medico_pcmso_uf || '',
          exames_realizados: asoData.exames_realizados || [],
          nome_clinica: asoData.nome_clinica || '',
          matricula_esocial: colaborador?.matricula_esocial || '',
          matricula: colaborador?.matricula || '',
        },
      };

      const dataValidation = validateEventData('S-2220', eventData);

      if (dataValidation.valido) {
        xmlGerado = generateEventXML('S-2220', eventData);
        const xmlValidation = validateEventXML(xmlGerado);
        xmlValido = xmlValidation.valido;
        if (!xmlValido) errosValidacao = xmlValidation.erros;
      } else {
        errosValidacao = dataValidation.erros;
      }

      if (xmlGerado) {
        await updateEvento(evento.id, { xml_gerado: xmlGerado });
      }

      await logEnvio({
        evento_id: evento.id,
        acao: 'geracao_xml',
        request_body: JSON.stringify(eventData),
        response_body: xmlGerado || undefined,
        sucesso: xmlValido,
        mensagem_erro: errosValidacao.length > 0 ? errosValidacao.join('; ') : undefined,
      });
    } catch (xmlErr) {
      console.error('[S-2220] Erro ao gerar XML:', xmlErr);
    }

    // Update ASO document esocial_status
    await supabaseAdmin
      .from('gt_documentos_aso')
      .update({
        esocial_status: 'pendente',
        esocial_evento_id: evento.id,
        updated_at: new Date().toISOString()
      })
      .eq('documento_id', docId);

    return NextResponse.json({
      success: true,
      data: { evento_id: evento.id, status: 'pendente_revisao' }
    });
  } catch (error) {
    console.error('Erro ao processar E-Social:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
