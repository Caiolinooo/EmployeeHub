import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { authenticateUser } from '@/lib/api-auth';
import { canDeleteGtDocuments, canEditGtDocuments } from '@/lib/gestao-tripulantes/documento-permissions';
import { buscarCodigoExame } from '@/lib/e-social/codigos';
import {
  garantirNumeroRastreioUnico,
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

    const { data, error } = await supabaseAdmin
      .from('gt_documentos')
      .select('*, gt_colaboradores(nome_completo, cpf, matricula)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar documento:', error);
      return NextResponse.json({ error: 'Erro ao buscar documento' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    // If it's an ASO document, also fetch the ASO metadata
    let asoData = null;
    if (data.tipo_documento === 'aso') {
      const { data: aso, error: asoError } = await supabaseAdmin
        .from('gt_documentos_aso')
        .select('*')
        .eq('documento_id', id)
        .maybeSingle();

      if (!asoError && aso) {
        asoData = aso;
      }
    }

    return NextResponse.json({ success: true, data: { ...data, aso: asoData } });
  } catch (error) {
    console.error('Erro ao obter documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !(await canEditGtDocuments(user))) {
      return NextResponse.json({ error: 'Sem permissão para editar documentos do cadastro' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const { aso, treinamento_data, ...docFields } = body;
    const updateData: Record<string, any> = { ...docFields, updated_at: new Date().toISOString() };
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.deleted_at;
    delete updateData.colaborador_id;
    delete updateData.numero_rastreio;
    delete updateData.arquivo_hash;

    for (const key of ['numero_documento', 'orgao_emissor', 'data_emissao', 'data_validade', 'titulo', 'descricao', 'subtipo']) {
      if (key in updateData && typeof updateData[key] === 'string') {
        const trimmed = updateData[key].trim();
        updateData[key] = trimmed === '' ? null : (key.startsWith('data_') ? trimmed.slice(0, 10) : trimmed);
      }
    }

    // ---- Validação dura de integridade -------------------------------------
    const { data: atual, error: fetchErr } = await supabaseAdmin
      .from('gt_documentos')
      .select('data_emissao, data_validade, numero_rastreio, tipo_documento, identity_match, colaborador_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !atual) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    const emQuarentena =
      atual.identity_match === 'quarantine' || body.quarentena === true;

    const efetivo = {
      data_emissao: 'data_emissao' in updateData ? updateData.data_emissao : atual.data_emissao,
      data_validade: 'data_validade' in updateData ? updateData.data_validade : atual.data_validade,
      tipo_documento: atual.tipo_documento,
    };
    const validacao = validarDatasObrigatorias(efetivo, {
      permitirQuarentena: emQuarentena,
      permitirSemValidade: true,
      tipoDocumento: atual.tipo_documento,
    });
    if (!validacao.ok) {
      return NextResponse.json({
        error: 'Documento incompleto: ' + validacao.errors.join(', '),
        detalhes: validacao.errors,
      }, { status: 422 });
    }
    if ('status_validacao' in updateData) {
      // status_validacao é derivado da validade — recalculado abaixo
      delete updateData.status_validacao;
    }
    if (efetivo.data_validade !== undefined) {
      updateData.status_validacao = calcularStatusValidacaoPorValidade(efetivo.data_validade, { tipoDocumento: atual.tipo_documento });
    }

    // Garante numero_rastreio único em qualquer edição
    let numeroRastreioFinal = atual.numero_rastreio as string | null;
    if (!numeroRastreioFinal) {
      numeroRastreioFinal = await garantirNumeroRastreioUnico(atual.tipo_documento);
      updateData.numero_rastreio = numeroRastreioFinal;
    }

    const { data, error } = await supabaseAdmin
      .from('gt_documentos')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao atualizar documento:', error);
      return NextResponse.json({ error: 'Erro ao atualizar documento' }, { status: 500 });
    }

    // If ASO data was provided, upsert it into gt_documentos_aso
    if (aso && typeof aso === 'object') {
      const asoPayload: Record<string, any> = { ...aso, documento_id: id, updated_at: new Date().toISOString() };
      delete asoPayload.id;
      delete asoPayload.created_at;
      delete asoPayload.deleted_at;

      // Resolve exam codes on manual save
      if (Array.isArray(asoPayload.exames_realizados)) {
        for (const ex of asoPayload.exames_realizados) {
          if (!ex.codProc || ex.codProc === '9999') {
            const resolvedCode = await buscarCodigoExame(ex.nome);
            ex.codProc = resolvedCode || '9999';
          }
        }
      }

      const { error: asoError } = await supabaseAdmin
        .from('gt_documentos_aso')
        .upsert({
          documento_id: id,
          ...asoPayload,
        }, { onConflict: 'documento_id' });

      if (asoError) {
        console.error('Erro ao atualizar dados do ASO:', asoError);
      }
    }

    // If Treinamento data was provided, upsert into gt_documentos_treinamento
    if (treinamento_data && typeof treinamento_data === 'object') {
      const { error: treErr } = await supabaseAdmin
        .from('gt_documentos_treinamento')
        .upsert({
          documento_id: id,
          colaborador_id: atual.colaborador_id,
          nome_curso: treinamento_data.nome_curso || data.titulo,
          instituicao: treinamento_data.instituicao || data.orgao_emissor,
          carga_horaria: treinamento_data.carga_horaria ? Number(treinamento_data.carga_horaria) : null,
          tipo_curso: treinamento_data.tipo_curso || null,
        }, { onConflict: 'documento_id' });

      if (treErr) {
        console.error('Erro ao atualizar dados do treinamento:', treErr);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao atualizar documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !(await canDeleteGtDocuments(user))) {
      return NextResponse.json({ error: 'Sem permissão para excluir documentos do cadastro' }, { status: 403 });
    }

    const { id } = await context.params;

    const { error } = await supabaseAdmin
      .from('gt_documentos')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir documento:', error);
      return NextResponse.json({ error: 'Erro ao excluir documento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Documento excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
