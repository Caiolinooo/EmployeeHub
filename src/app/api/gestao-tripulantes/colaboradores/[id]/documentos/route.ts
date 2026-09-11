import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import {
  garantirNumeroRastreioUnico,
  buscarDuplicado,
  validarDatasObrigatorias,
  calcularStatusValidacaoPorValidade,
} from '@/lib/gestao-tripulantes/documento-integrity';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;

    const { data: documentos, error } = await supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .eq('colaborador_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar documentos:', error);
      return NextResponse.json({ error: 'Erro ao listar documentos' }, { status: 500 });
    }

    let documentosComAso = documentos || [];
    if (documentosComAso.length > 0) {
      const asoDocIds = documentosComAso
        .filter((doc: any) => doc.tipo_documento === 'aso')
        .map((doc: any) => doc.id);

      if (asoDocIds.length > 0) {
        const { data: asoRecords, error: asoError } = await supabaseAdmin
          .from('gt_documentos_aso')
          .select('*')
          .in('documento_id', asoDocIds);

        if (!asoError && asoRecords) {
          const asoDataMap: Record<string, any> = {};
          asoRecords.forEach((rec: any) => {
            asoDataMap[rec.documento_id] = rec;
          });

          documentosComAso = documentosComAso.map((doc: any) => {
            if (doc.tipo_documento === 'aso') {
              return {
                ...doc,
                aso_data: asoDataMap[doc.id] || null
              };
            }
            return doc;
          });
        }
      }
    }

    // Dedup ASOs: colapsa duplicatas e preserva exames históricos distintos
    const asoMap = new Map<string, any>();
    const nonAsoDocs: any[] = [];

    documentosComAso.forEach((d: any) => {
      if (d.tipo_documento === 'aso') {
        const dRealiz = d.aso_data?.data_realizacao || d.data_emissao || 'SEM_DATA';
        const dValid = d.data_validade || 'SEM_VALIDADE';
        const key = `${dRealiz}_${dValid}`;
        
        const existing = asoMap.get(key);
        if (!existing) {
          asoMap.set(key, d);
        } else {
          const existingScore = (existing.aso_data?.esocial_status === 'processado' ? 1000 : 0) + (existing.ocr_status === 'concluido' ? 50 : 0);
          const currentScore = (d.aso_data?.esocial_status === 'processado' ? 1000 : 0) + (d.ocr_status === 'concluido' ? 50 : 0);
          if (currentScore > existingScore) {
            asoMap.set(key, d);
          }
        }
      } else {
        nonAsoDocs.push(d);
      }
    });

    const uniqueAsos = Array.from(asoMap.values()).sort((a, b) => {
      const dateA = a.aso_data?.data_realizacao || a.data_emissao || '';
      const dateB = b.aso_data?.data_realizacao || b.data_emissao || '';
      return dateB.localeCompare(dateA);
    });

    const finalDocs = [...uniqueAsos, ...nonAsoDocs];

    return NextResponse.json({
      success: true,
      data: finalDocs
    });
  } catch (error) {
    console.error('Erro na API documentos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;
    const body = await request.json();
    const {
      tipo_documento,
      subtipo,
      titulo,
      numero_documento,
      orgao_emissor,
      data_emissao,
      data_validade,
      arquivo_url,
      descricao,
      treinamento_data
    } = body;

    if (!tipo_documento || !titulo) {
      return NextResponse.json({ error: 'Tipo do documento e titulo são obrigatórios' }, { status: 400 });
    }

    // Validação de integridade
    const emQuarentena = body.quarentena === true;
    const validacao = validarDatasObrigatorias(
      { data_emissao, data_validade, tipo_documento },
      { permitirQuarentena: emQuarentena, permitirSemValidade: true, tipoDocumento: tipo_documento }
    );
    if (!validacao.ok) {
      return NextResponse.json({
        error: 'Documento incompleto: ' + validacao.errors.join(', '),
        detalhes: validacao.errors,
      }, { status: 422 });
    }

    // Anti-duplicação: atualiza existente em vez de criar novo
    const duplicado = await buscarDuplicado({
      colaborador_id: id,
      tipo_documento,
      titulo,
      numero_documento,
      data_emissao,
      data_validade,
    });
    if (duplicado) {
      const updateData: Record<string, any> = {
        subtipo: subtipo ?? duplicado.subtipo ?? null,
        numero_documento: numero_documento ?? duplicado.numero_documento ?? null,
        orgao_emissor: orgao_emissor ?? duplicado.orgao_emissor ?? null,
        data_emissao: data_emissao ?? duplicado.data_emissao ?? null,
        data_validade: data_validade ?? duplicado.data_validade ?? null,
        arquivo_url: arquivo_url ?? duplicado.arquivo_url ?? null,
        descricao: descricao ?? duplicado.descricao ?? null,
        updated_at: new Date().toISOString(),
      };
      updateData.status_validacao = calcularStatusValidacaoPorValidade(updateData.data_validade, { tipoDocumento: tipo_documento });
      let numero_rastreio = duplicado.numero_rastreio;
      if (!numero_rastreio) {
        numero_rastreio = await garantirNumeroRastreioUnico(tipo_documento, id);
        updateData.numero_rastreio = numero_rastreio;
      }

      const { data: updated, error: updError } = await supabaseAdmin
        .from('gt_documentos')
        .update(updateData)
        .eq('id', duplicado.id)
        .select('*')
        .single();
      if (updError) {
        console.error('Erro ao atualizar documento duplicado:', updError);
        return NextResponse.json({ error: 'Erro ao atualizar documento existente' }, { status: 500 });
      }

      if (treinamento_data && typeof treinamento_data === 'object') {
        await supabaseAdmin
          .from('gt_documentos_treinamento')
          .upsert({
            documento_id: duplicado.id,
            colaborador_id: id,
            nome_curso: treinamento_data.nome_curso || titulo,
            instituicao: treinamento_data.instituicao || orgao_emissor,
            carga_horaria: treinamento_data.carga_horaria ? Number(treinamento_data.carga_horaria) : null,
            tipo_curso: treinamento_data.tipo_curso || null,
          }, { onConflict: 'documento_id' });
      }

      return NextResponse.json({
        success: true,
        data: updated,
        merged: true,
        message: 'Documento idêntico já existia — registro existente foi atualizado (sem duplicação)'
      }, { status: 200 });
    }

    const numero_rastreio = await garantirNumeroRastreioUnico(tipo_documento, id);

    const { data: documento, error: createError } = await supabaseAdmin
      .from('gt_documentos')
      .insert({
        colaborador_id: id,
        tipo_documento,
        subtipo: subtipo || null,
        titulo,
        numero_documento: numero_documento || null,
        orgao_emissor: orgao_emissor || null,
        data_emissao: data_emissao || null,
        data_validade: data_validade || null,
        arquivo_url: arquivo_url || null,
        descricao: descricao || null,
        numero_rastreio,
        identity_match: 'match',
        status_validacao: calcularStatusValidacaoPorValidade(data_validade, { tipoDocumento: tipo_documento }),
        ocr_status: 'pendente',
        status_revisao: 'nao_necessita',
        notificado_vencimento: false,
        origem: 'manual'
      })
      .select('*')
      .single();

    if (createError) {
      console.error('Erro ao criar documento:', createError);
      return NextResponse.json({ error: 'Erro ao criar documento' }, { status: 500 });
    }

    if (treinamento_data && typeof treinamento_data === 'object' && documento) {
      await supabaseAdmin
        .from('gt_documentos_treinamento')
        .upsert({
          documento_id: documento.id,
          colaborador_id: id,
          nome_curso: treinamento_data.nome_curso || titulo,
          instituicao: treinamento_data.instituicao || orgao_emissor,
          carga_horaria: treinamento_data.carga_horaria ? Number(treinamento_data.carga_horaria) : null,
          tipo_curso: treinamento_data.tipo_curso || null,
        }, { onConflict: 'documento_id' });
    }

    return NextResponse.json({
      success: true,
      data: documento
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
