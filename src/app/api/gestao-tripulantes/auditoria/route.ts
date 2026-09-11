import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { garantirNumeroRastreioUnico, calcularStatusValidacaoPorValidade } from '@/lib/gestao-tripulantes/documento-integrity';

export const dynamic = 'force-dynamic';

/**
 * Painel de auditoria da integridade documental do módulo Gestão de Tripulantes.
 *
 * GET  /api/gestao-tripulantes/auditoria
 *   → buckets de pendências: sem_emissao, sem_validade, sem_rastreio,
 *     duplicados, quarentena, vencidos, vencendo (+ resumo).
 *
 * POST /api/gestao-tripulantes/auditoria
 *   body: { acao: 'gerar_rastreio' | 'corrigir_datas' | 'resolver_quarentena'
 *                | 'mesclar_duplicados', documento_id, ... }
 */

const SELECT_BASE = `
  id, colaborador_id, tipo_documento, titulo, numero_documento,
  data_emissao, data_validade, numero_rastreio, arquivo_hash,
  identity_match, status_validacao, origem, created_at
`;

interface DocRow {
  id: string;
  colaborador_id: string | null;
  tipo_documento: string;
  titulo: string;
  numero_documento: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  numero_rastreio: string | null;
  arquivo_hash: string | null;
  identity_match: string | null;
  status_validacao: string | null;
  origem: string;
  created_at: string;
  gt_colaboradores?: { nome_completo?: string; cpf?: string } | null;
}

async function carregarDocumentos(): Promise<DocRow[]> {
  const all: DocRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('gt_documentos')
      .select(`${SELECT_BASE}, gt_colaboradores(nome_completo, cpf)`)
      .is('deleted_at', null)
      .order('created_at')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...((data || []) as unknown as DocRow[]));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const docs = await carregarDocumentos();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em30 = new Date(hoje.getTime() + 30 * 86400000);

    // Duplicados: mesmo colaborador + tipo + título normalizado + nº documento,
    // ou mesmo arquivo_hash compartilhado entre 2+ documentos.
    // Para ASO, agrupa também por data_emissao + data_validade.
    const groups = new Map<string, DocRow[]>();
    for (const d of docs) {
      const key = d.tipo_documento === 'aso'
        ? `${d.colaborador_id || 'ORFAO'}::aso::${d.data_emissao || 'NE'}::${d.data_validade || 'NV'}`
        : `${d.colaborador_id || 'ORFAO'}::${d.tipo_documento}::${(d.titulo || '').toLowerCase().trim()}::${(d.numero_documento || '').trim()}`;
      const g = groups.get(key) ?? groups.set(key, []).get(key)!;
      g.push(d);
    }
    const gruposDuplicados = [...groups.values()].filter(g => g.length > 1);

    const hashGroups = new Map<string, DocRow[]>();
    for (const d of docs) {
      if (!d.arquivo_hash) continue;
      const g = hashGroups.get(d.arquivo_hash) ?? hashGroups.set(d.arquivo_hash, []).get(d.arquivo_hash)!;
      g.push(d);
    }
    const duplicadosPorHash = [...hashGroups.values()].filter(
      g => g.length > 1 && new Set(g.map(x => x.colaborador_id)).size === 1
    );

    const duplicadosIds = new Set(gruposDuplicados.flat().map(d => d.id));

    const semEmissao = docs.filter(d => !d.data_emissao && !duplicadosIds.has(d.id));
    const semValidade = docs.filter(d => !d.data_validade && !duplicadosIds.has(d.id));
    const semRastreio = docs.filter(d => !d.numero_rastreio);
    const quarentena = docs.filter(
      d => d.identity_match === 'quarantine' || !d.colaborador_id
    );
    const vencidos = docs.filter(d => d.data_validade && new Date(`${d.data_validade}T00:00:00`) < hoje);
    const vencendo = docs.filter(
      d =>
        d.data_validade &&
        new Date(`${d.data_validade}T00:00:00`) >= hoje &&
        new Date(`${d.data_validade}T00:00:00`) <= em30
    );
    const orfaos = docs.filter(d => !d.colaborador_id);

    return NextResponse.json({
      success: true,
      data: {
        resumo: {
          total_documentos: docs.length,
          sem_emissao: semEmissao.length,
          sem_validade: semValidade.length,
          sem_rastreio: semRastreio.length,
          duplicados_grupos: gruposDuplicados.length,
          duplicados_excedentes: gruposDuplicados.reduce((a, g) => a + g.length - 1, 0),
          quarentena: quarentena.length,
          orfaos: orfaos.length,
          vencidos: vencidos.length,
          vencendo: vencendo.length,
        },
        sem_emissao: semEmissao,
        sem_validade: semValidade.slice(0, 500),
        sem_validade_total: semValidade.length,
        sem_rastreio: semRastreio,
        duplicados: gruposDuplicados.map(g => ({ grupo: g })),
        duplicados_por_hash: duplicadosPorHash.map(g => ({ grupo: g })),
        quarentena,
        vencidos,
        vencendo,
      },
    });
  } catch (error) {
    console.error('Erro na auditoria:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
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

    // Apenas ADMIN pode corrigir pela auditoria
    if (payload.role !== 'ADMIN' && String(payload.role).toUpperCase() !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas administradores podem corrigir pendências' }, { status: 403 });
    }

    const body = await request.json();
    const acao = body?.acao as string;

    switch (acao) {
      // Gerar numero_rastreio para registros antigos sem rastreio
      case 'gerar_rastreio': {
        const docs = await carregarDocumentos();
        const alvos = body.documento_id
          ? docs.filter(d => d.id === body.documento_id)
          : docs.filter(d => !d.numero_rastreio);
        let gerados = 0;
        for (const d of alvos) {
          let cpf: string | null = null;
          if (d.colaborador_id) {
            const { data: col } = await supabaseAdmin
              .from('gt_colaboradores')
              .select('cpf')
              .eq('id', d.colaborador_id)
              .maybeSingle();
            cpf = col?.cpf || null;
          }
          const rastreio = await garantirNumeroRastreioUnico(d.tipo_documento, cpf);
          const { error } = await supabaseAdmin
            .from('gt_documentos')
            .update({ numero_rastreio: rastreio, updated_at: new Date().toISOString() })
            .eq('id', d.id);
          if (!error) gerados++;
        }
        return NextResponse.json({ success: true, message: `${gerados} número(s) de rastreio gerado(s)` });
      }

      // Edição manual do numero_rastreio (ADMIN) — para corrigir na mão
      // quando o OCR não extrai o número próprio do documento.
      case 'corrigir_rastreio': {
        const { documento_id, numero_rastreio } = body;
        const token = String(numero_rastreio || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!documento_id || !token) {
          return NextResponse.json(
            { error: 'documento_id e numero_rastreio são obrigatórios' },
            { status: 400 }
          );
        }
        if (token.length < 4 || token.length > 40) {
          return NextResponse.json(
            { error: 'numero_rastreio deve ter entre 4 e 40 caracteres' },
            { status: 422 }
          );
        }
        const { data: conflito } = await supabaseAdmin
          .from('gt_documentos')
          .select('id')
          .eq('numero_rastreio', token)
          .neq('id', documento_id)
          .limit(1)
          .maybeSingle();
        if (conflito) {
          return NextResponse.json(
            { error: `numero_rastreio já usado pelo documento ${conflito.id}` },
            { status: 409 }
          );
        }
        const { error } = await supabaseAdmin
          .from('gt_documentos')
          .update({ numero_rastreio: token, updated_at: new Date().toISOString() })
          .eq('id', documento_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: `numero_rastreio atualizado para ${token}` });
      }

      // Corrigir emissão/validade direto no painel
      case 'corrigir_datas': {
        const { documento_id, data_emissao, data_validade } = body;
        if (!documento_id || !data_emissao || !data_validade) {
          return NextResponse.json(
            { error: 'documento_id, data_emissao e data_validade são obrigatórios' },
            { status: 400 }
          );
        }
        if (new Date(data_validade) < new Date(data_emissao)) {
          return NextResponse.json(
            { error: 'Data de validade não pode ser anterior à data de emissão' },
            { status: 422 }
          );
        }
        const { error } = await supabaseAdmin
          .from('gt_documentos')
          .update({
            data_emissao,
            data_validade,
            status_validacao: calcularStatusValidacaoPorValidade(data_validade),
            updated_at: new Date().toISOString(),
          })
          .eq('id', documento_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: 'Datas atualizadas' });
      }

      // Resolver quarentena atribuindo o documento ao colaborador correto.
      // Gate duro: CPF do OCR (quando existir) precisa bater com o do alvo.
      case 'resolver_quarentena': {
        const { documento_id, colaborador_id } = body;
        if (!documento_id || !colaborador_id) {
          return NextResponse.json({ error: 'documento_id e colaborador_id são obrigatórios' }, { status: 400 });
        }
        const { data: doc } = await supabaseAdmin
          .from('gt_documentos')
          .select('ocr_dados_extraidos, ocr_texto, identity_match')
          .eq('id', documento_id)
          .maybeSingle();
        if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

        const { data: col } = await supabaseAdmin
          .from('gt_colaboradores')
          .select('cpf')
          .eq('id', colaborador_id)
          .maybeSingle();
        if (!col) return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });

        const cpfDoc =
          doc.ocr_dados_extraidos?.cpf ||
          (doc.ocr_texto || '').match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)?.[0] ||
          null;
        if (cpfDoc && col.cpf) {
          const norm = (s: string) => s.replace(/\D/g, '');
          if (norm(String(cpfDoc)) !== norm(col.cpf)) {
            return NextResponse.json(
              {
                error:
                  'CPF do documento difere do CPF do colaborador selecionado — resolução bloqueada pelo gate de identidade',
              },
              { status: 409 }
            );
          }
        }

        const { error } = await supabaseAdmin
          .from('gt_documentos')
          .update({
            colaborador_id,
            identity_match: 'reassigned',
            status_revisao: 'nao_necessita',
            updated_at: new Date().toISOString(),
          })
          .eq('id', documento_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Espelha resolução no ASO vinculado, se houver
        await supabaseAdmin
          .from('gt_documentos_aso')
          .update({
            colaborador_id,
            identity_match: 'reassigned',
            esocial_status: 'nao_enviado',
            updated_at: new Date().toISOString(),
          })
          .eq('documento_id', documento_id);

        return NextResponse.json({ success: true, message: 'Documento reassociado ao colaborador' });
      }

      // Mesclar duplicados: mantém um registro e soft-deleta os excedentes
      case 'mesclar_duplicados': {
        const { manter_id } = body;
        if (!manter_id) {
          return NextResponse.json({ error: 'manter_id é obrigatório' }, { status: 400 });
        }
        const docs = await carregarDocumentos();
        const manter = docs.find(d => d.id === manter_id);
        if (!manter) return NextResponse.json({ error: 'Registro a manter não encontrado' }, { status: 404 });

        const keyOf = (d: DocRow) =>
          d.tipo_documento === 'aso'
            ? `${d.colaborador_id || 'ORFAO'}::aso::${d.data_emissao || 'NE'}::${d.data_validade || 'NV'}`
            : `${d.colaborador_id || 'ORFAO'}::${d.tipo_documento}::${(d.titulo || '').toLowerCase().trim()}::${(d.numero_documento || '').trim()}`;
        const grupo = docs.filter(d => keyOf(d) === keyOf(manter));
        const remover = grupo.filter(d => d.id !== manter.id);

        const agora = new Date().toISOString();
        for (const r of remover) {
          await supabaseAdmin
            .from('gt_documentos')
            .update({
              deleted_at: agora,
              comentario_revisao: `Duplicado mesclado em ${manter.numero_rastreio || manter.id}`,
              updated_at: agora,
            })
            .eq('id', r.id);
          await supabaseAdmin
            .from('gt_documentos_aso')
            .delete()
            .eq('documento_id', r.id);
        }
        // Registro principal recebe o melhor dado disponível do grupo
        const melhorValidade = grupo
          .map(d => d.data_validade)
          .filter(Boolean)
          .sort()
          .pop();
        const melhorEmissao = grupo
          .map(d => d.data_emissao)
          .filter(Boolean)
          .sort()
          .pop();
        await supabaseAdmin
          .from('gt_documentos')
          .update({
            data_emissao: melhorEmissao || manter.data_emissao,
            data_validade: melhorValidade || manter.data_validade,
            status_validacao: calcularStatusValidacaoPorValidade(melhorValidade || manter.data_validade),
            updated_at: agora,
          })
          .eq('id', manter.id);

        return NextResponse.json({
          success: true,
          message: `${remover.length} duplicado(s) removido(s); registro ${manter.numero_rastreio || manter.id} mantido`,
        });
      }

      default:
        return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Erro na ação de auditoria:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
