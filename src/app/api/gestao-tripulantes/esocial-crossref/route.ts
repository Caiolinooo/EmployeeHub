import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { cpfsMatch, normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { filtrarPorColaboradorPermitido } from '@/lib/gestao-tripulantes/empresa-acesso';
import { MENSAGEM_DOCUMENTOS_RESTRITOS } from '@/lib/gestao-tripulantes/documento-escopo';

export const dynamic = 'force-dynamic';

// ────────────────────────────────────────────────────────────────
// GET /api/gestao-tripulantes/esocial-crossref?evento_id=<uuid>
//                                        &cpf=<cpf>[&evento_codigo=S-2220]
// Caminho inverso do vínculo Documento → e-Social:
// dado um evento (ou CPF) retorna o(s) documento(s) ASO vinculados
// + dados do colaborador, provando que o evento corresponde ao
// documento certo.
// ────────────────────────────────────────────────────────────────

interface EventoRow {
  id: string;
  evento_codigo: string;
  cpf_trabalhador: string | null;
  cnpj_empregador: string | null;
  matricula: string | null;
  status: string;
  protocolo_envio: string | null;
  numero_recibo: string | null;
  data_envio: string | null;
  data_processamento: string | null;
  erros_processamento: unknown;
  modulo_origem: string | null;
  entidade_origem_id: string | null;
  entidade_origem_tipo: string | null;
  created_at: string;
}

interface DocumentoRow {
  id: string;
  tipo_documento: string;
  titulo: string | null;
  numero_rastreio: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  colaborador_id: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const eventoId = (searchParams.get('evento_id') || '').trim();
    const cpfParam = normalizeCpf(searchParams.get('cpf') || '');
    const eventoCodigo = (searchParams.get('evento_codigo') || '').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    if (!eventoId && !cpfParam) {
      return NextResponse.json(
        { error: 'Informe ?evento_id=<uuid> ou ?cpf=<cpf> (opcionalmente &evento_codigo=S-2220).' },
        { status: 400 }
      );
    }

    if (eventoId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventoId)) {
      return NextResponse.json({ error: 'evento_id inválido' }, { status: 400 });
    }

    // ── 1. Buscar eventos ───────────────────────────────────────
    let query = supabaseAdmin
      .from('esocial_eventos')
      .select('id, evento_codigo, cpf_trabalhador, cnpj_empregador, matricula, status, protocolo_envio, numero_recibo, data_envio, data_processamento, erros_processamento, modulo_origem, entidade_origem_id, entidade_origem_tipo, created_at')
      .order('created_at', { ascending: false })
      .limit(eventoId ? 10 : limit);

    if (eventoId) query = query.eq('id', eventoId);
    else {
      query = query.eq('cpf_trabalhador', cpfParam);
      if (eventoCodigo) query = query.eq('evento_codigo', eventoCodigo);
    }

    const { data: eventos, error: evError } = await query;

    if (evError) {
      console.error('[esocial-crossref] Erro ao buscar eventos:', evError);
      return NextResponse.json({ error: 'Erro ao buscar eventos e-Social' }, { status: 500 });
    }

    if (!eventos || eventos.length === 0) {
      return NextResponse.json({
        success: true,
        data: { eventos: [], total_eventos: 0, mensagem: 'Nenhum evento e-Social encontrado para os critérios informados.' },
      });
    }

    // ── 2. Resolver documentos vinculados a cada evento ─────────
    // Vínculo direto: esocial_eventos.entidade_origem_id → gt_documentos.id
    const origemDocIds = Array.from(
      new Set(
        (eventos as EventoRow[])
          .map(ev => ev.entidade_origem_id)
          .filter((v): v is string => !!v)
      )
    );

    const docMap = new Map<string, DocumentoRow>();
    if (origemDocIds.length > 0) {
      const { data: docs } = await supabaseAdmin
        .from('gt_documentos')
        .select('id, tipo_documento, titulo, numero_rastreio, data_emissao, data_validade, colaborador_id')
        .in('id', origemDocIds);
      (docs || []).forEach(d => docMap.set(d.id, d as DocumentoRow));
    }

    // Vínculo indireto: gt_documentos_aso.esocial_evento_id → evento
    const eventoIdsList = (eventos as EventoRow[]).map(ev => ev.id);
    const asoLinkMap = new Map<string, string>(); // evento_id -> documento_id
    const asoCpfDocMap = new Map<string, string | null>(); // documento_id -> cpf_documento
    const { data: asoLinks } = await supabaseAdmin
      .from('gt_documentos_aso')
      .select('documento_id, esocial_evento_id, cpf_documento')
      .in('esocial_evento_id', eventoIdsList);
    (asoLinks || []).forEach(link => {
      if (link.esocial_evento_id && link.documento_id) {
        asoLinkMap.set(link.esocial_evento_id, link.documento_id);
        asoCpfDocMap.set(link.documento_id, link.cpf_documento || null);
      }
    });

    const allDocIds = Array.from(
      new Set([...origemDocIds, ...Array.from(asoLinkMap.values())])
    );
    if (allDocIds.length > docMap.size) {
      const missing = allDocIds.filter(id => !docMap.has(id));
      if (missing.length > 0) {
        const { data: docs2 } = await supabaseAdmin
          .from('gt_documentos')
          .select('id, tipo_documento, titulo, numero_rastreio, data_emissao, data_validade, colaborador_id')
          .in('id', missing);
        (docs2 || []).forEach(d => docMap.set(d.id, d as DocumentoRow));
      }
    }

    // ── 3. Colaboradores dos documentos ─────────────────────────
    const colabIds = Array.from(
      new Set(
        Array.from(docMap.values())
          .map(d => d.colaborador_id)
          .filter((v): v is string => !!v)
      )
    );
    const colabMap = new Map<string, Record<string, unknown>>();
    if (colabIds.length > 0) {
      const { data: colabs } = await supabaseAdmin
        .from('gt_colaboradores')
        .select('id, nome_completo, cpf, matricula, matricula_esocial')
        .in('id', colabIds);
      (colabs || []).forEach(c => colabMap.set(c.id, c));
    }
    // Fallback: colaborador pelo CPF do evento (quando não há documento)
    let colabByCpf: Record<string, unknown> | null = null;
    const cpfDoEvento = normalizeCpf((eventos as EventoRow[])[0].cpf_trabalhador || '');
    if (cpfDoEvento.length === 11) {
      const { data: c } = await supabaseAdmin
        .from('gt_colaboradores')
        .select('id, nome_completo, cpf, matricula, matricula_esocial')
        .eq('cpf', cpfDoEvento)
        .maybeSingle();
      colabByCpf = c || null;
    }

    const conhecidos = [...colabMap.keys(), ...(colabByCpf ? [colabByCpf.id as string] : [])];
    const sujeitos = conhecidos.length > 0 ? conhecidos : [null];
    const visiveis = await filtrarPorColaboradorPermitido(
      { id: payload.userId, role: payload.role },
      sujeitos,
      (id) => id,
    );
    if (visiveis.length < sujeitos.length) {
      return NextResponse.json({ error: MENSAGEM_DOCUMENTOS_RESTRITOS }, { status: 403 });
    }

    // ── 4. Montar resposta com verificação de consistência ──────
    const results = (eventos as EventoRow[]).map(ev => {
      const docIdVinculado =
        (ev.entidade_origem_id && docMap.has(ev.entidade_origem_id)
          ? ev.entidade_origem_id
          : null) ||
        asoLinkMap.get(ev.id) ||
        null;

      const doc = docIdVinculado ? docMap.get(docIdVinculado) || null : null;
      const colab = doc?.colaborador_id ? colabMap.get(doc.colaborador_id) || null : null;

      const verificacoes = {
        documento_vinculado: !!doc,
        origem_do_vinculo:
          ev.entidade_origem_id && docMap.has(ev.entidade_origem_id)
            ? 'entidade_origem_id'
            : asoLinkMap.has(ev.id)
              ? 'gt_documentos_aso.esocial_evento_id'
              : null,
        cpf_bate_com_colaborador:
          colab && ev.cpf_trabalhador
            ? cpfsMatch(colab.cpf as string, ev.cpf_trabalhador)
            : colabByCpf && ev.cpf_trabalhador
              ? cpfsMatch(colabByCpf.cpf as string, ev.cpf_trabalhador)
              : null,
        cpf_bate_com_cpf_documento_aso:
          docIdVinculado && ev.cpf_trabalhador && asoCpfDocMap.has(docIdVinculado)
            ? cpfsMatch(asoCpfDocMap.get(docIdVinculado) || '', ev.cpf_trabalhador)
            : null,
        orfao: !doc,
      };

      return {
        evento: {
          id: ev.id,
          evento_codigo: ev.evento_codigo,
          status: ev.status,
          protocolo_envio: ev.protocolo_envio,
          numero_recibo: ev.numero_recibo,
          data_envio: ev.data_envio,
          data_processamento: ev.data_processamento,
          erros_processamento: ev.erros_processamento,
          cpf_trabalhador: ev.cpf_trabalhador,
          matricula: ev.matricula,
          modulo_origem: ev.modulo_origem,
        },
        documento: doc,
        colaborador: colab || colabByCpf,
        verificacoes,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        criterio: eventoId ? { evento_id: eventoId } : { cpf: cpfParam, evento_codigo: eventoCodigo || 'todos' },
        total_eventos: results.length,
        resultados: results,
      },
    });
  } catch (error) {
    console.error('[esocial-crossref] Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
