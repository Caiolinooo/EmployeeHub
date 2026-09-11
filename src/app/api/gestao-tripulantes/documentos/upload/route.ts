import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import {
  calcularArquivoHash,
  garantirNumeroRastreioUnico,
  buscarDuplicado,
  validarDatasObrigatorias,
  calcularStatusValidacaoPorValidade,
  normalizarTipoDocumento,
  resolverMimeArquivo,
} from '@/lib/gestao-tripulantes/documento-integrity';

export const dynamic = 'force-dynamic';

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const colaborador_id = (formData.get('colaborador_id') as string | null)?.trim() || '';
    const documento_id = (formData.get('documento_id') as string | null)?.trim();
    const titulo = (formData.get('titulo') as string | null)?.trim() || 'Documento';
    const descricao = formData.get('descricao') as string | null;
    const tipoRaw = formData.get('tipo_documento') as string | null;
    const tipoNorm = normalizarTipoDocumento(tipoRaw);
    const tipo_documento = tipoNorm.tipo;
    const subtipoForm = (formData.get('subtipo') as string | null)?.trim() || tipoNorm.subtipo || null;
    const numero_documento = formData.get('numero_documento') as string | null;
    const orgao_emissor = formData.get('orgao_emissor') as string | null;
    const data_emissao = ((formData.get('data_emissao') as string | null) || '').trim() || null;
    const data_validade = ((formData.get('data_validade') as string | null) || '').trim() || null;
    const emQuarentena = String(formData.get('quarentena') || '') === 'true';

    if (!file || !colaborador_id || (!tipo_documento && !documento_id)) {
      return NextResponse.json({
        error: 'file, colaborador_id e tipo_documento são obrigatórios',
        detalhes: {
          hasFile: Boolean(file),
          hasColaborador: Boolean(colaborador_id),
          tipo_documento: tipoRaw,
        },
      }, { status: 400 });
    }

    const { data: colaborador, error: colError } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('id, cpf')
      .eq('id', colaborador_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (colError || !colaborador) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    if (tipoNorm.invalido) {
      return NextResponse.json({
        error: `Tipo de documento inválido: ${tipoRaw}`,
        tipos_aceitos: [
          'aso', 'treinamento', 'passaporte', 'cnh', 'certidao_nascimento',
          'certidao_casamento', 'reservista', 'titulo_eleitor', 'ctps',
          'documento_pessoal', 'certificado', 'contrato', 'laudo', 'outro',
        ],
      }, { status: 400 });
    }

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

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo muito grande. Tamanho máximo: 20MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const mime = resolverMimeArquivo(file.name, file.type, buffer);
    if (!mime) {
      return NextResponse.json({
        error: 'Formato de arquivo não permitido. Use PDF, JPEG, PNG ou WebP',
        mime_recebido: file.type || '(vazio)',
        arquivo: file.name,
      }, { status: 400 });
    }
    const arquivo_hash = calcularArquivoHash(buffer);

    // ---- Anexação direta a documento existente -----------------------------
    if (documento_id) {
      const { data: existingDoc } = await supabaseAdmin
        .from('gt_documentos')
        .select('*')
        .eq('id', documento_id)
        .eq('colaborador_id', colaborador_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingDoc) {
        const ext = file.name.split('.').pop() || 'pdf';
        const filePath = `gestao-tripulantes/${colaborador_id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from('gestao-tripulantes-documentos')
          .upload(filePath, buffer, { contentType: mime, upsert: false });

        if (upErr) {
          console.error('Erro storage:', upErr);
          return NextResponse.json({ error: 'Erro ao enviar arquivo para o storage' }, { status: 500 });
        }

        const { data: urlData } = supabaseAdmin.storage
          .from('gestao-tripulantes-documentos')
          .getPublicUrl(filePath);

        const updatePayload: Record<string, any> = {
          arquivo_path: filePath,
          arquivo_url: urlData?.publicUrl || '',
          arquivo_tamanho_bytes: file.size,
          arquivo_tipo: mime,
          arquivo_hash,
          updated_at: new Date().toISOString(),
        };

        if (numero_documento) updatePayload.numero_documento = numero_documento;
        if (orgao_emissor) updatePayload.orgao_emissor = orgao_emissor;
        if (data_emissao) updatePayload.data_emissao = data_emissao;
        if (data_validade) {
          updatePayload.data_validade = data_validade;
          updatePayload.status_validacao = calcularStatusValidacaoPorValidade(data_validade, { tipoDocumento: existingDoc.tipo_documento });
        }

        const { data: updated, error: updErr } = await supabaseAdmin
          .from('gt_documentos')
          .update(updatePayload)
          .eq('id', documento_id)
          .select('*')
          .single();

        if (updErr) {
          return NextResponse.json({ error: 'Erro ao atualizar documento com arquivo' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: updated,
          message: 'Arquivo anexado ao documento com sucesso!'
        });
      }
    }

    // ---- Anti-duplicação: atualiza o existente em vez de criar novo --------
    const duplicado = await buscarDuplicado({
      colaborador_id,
      tipo_documento: tipo_documento || '',
      titulo,
      numero_documento,
      data_emissao,
      data_validade,
      arquivo_hash,
    });

    if (duplicado) {
      const updateData: Record<string, any> = {
        titulo,
        descricao: descricao ?? duplicado.descricao ?? null,
        numero_documento: numero_documento ?? duplicado.numero_documento ?? null,
        orgao_emissor: orgao_emissor ?? duplicado.orgao_emissor ?? null,
        data_emissao: data_emissao ?? duplicado.data_emissao ?? null,
        data_validade: data_validade ?? duplicado.data_validade ?? null,
        arquivo_tamanho_bytes: file.size,
        arquivo_tipo: mime,
        arquivo_hash,
        updated_at: new Date().toISOString(),
      };
      // Só substitui o arquivo se o conteúdo realmente mudou
      if (duplicado.arquivo_hash !== arquivo_hash) {
        const ext = file.name.split('.').pop() || 'pdf';
        const filePath = `gestao-tripulantes/${colaborador_id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from('gestao-tripulantes-documentos')
          .upload(filePath, buffer, { contentType: mime, upsert: false });
        if (!upErr) {
          const { data: urlData } = supabaseAdmin.storage
            .from('gestao-tripulantes-documentos')
            .getPublicUrl(filePath);
          updateData.arquivo_path = filePath;
          updateData.arquivo_url = urlData?.publicUrl || duplicado.arquivo_url || null;
        }
      }
      updateData.status_validacao = calcularStatusValidacaoPorValidade(updateData.data_validade, {
        tipoDocumento: tipo_documento || duplicado.tipo_documento,
      });

      let numero_rastreio = duplicado.numero_rastreio;
      if (!numero_rastreio) {
        numero_rastreio = await garantirNumeroRastreioUnico(tipo_documento || '', colaborador.cpf);
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

      return NextResponse.json({
        success: true,
        data: updated,
        merged: true,
        message: 'Documento idêntico já existia — registro existente foi atualizado (sem duplicação)'
      }, { status: 200 });
    }

    // ---- Upload novo --------------------------------------------------------
    const ext = file.name.split('.').pop() || 'pdf';
    const filePath = `gestao-tripulantes/${colaborador_id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('gestao-tripulantes-documentos')
      .upload(filePath, buffer, {
        contentType: mime,
        upsert: false
      });

    if (uploadError) {
      console.error('Erro ao fazer upload do arquivo:', uploadError);
      return NextResponse.json({ error: 'Erro ao fazer upload do arquivo' }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('gestao-tripulantes-documentos')
      .getPublicUrl(filePath);

    const arquivo_url = urlData?.publicUrl || '';

    const numero_rastreio = await garantirNumeroRastreioUnico(tipo_documento || '', colaborador.cpf);

    const { data: documento, error: insertError } = await supabaseAdmin
      .from('gt_documentos')
      .insert({
        colaborador_id,
        tipo_documento,
        subtipo: subtipoForm,
        titulo,
        descricao: descricao || null,
        numero_documento: numero_documento || null,
        orgao_emissor: orgao_emissor || null,
        data_emissao: data_emissao || null,
        data_validade: data_validade || null,
        arquivo_url,
        arquivo_path: filePath,
        arquivo_tamanho_bytes: file.size,
        arquivo_tipo: mime,
        arquivo_hash,
        numero_rastreio,
        origem: 'upload',
        ocr_status: 'pendente',
        status_validacao: calcularStatusValidacaoPorValidade(data_validade, { tipoDocumento: tipo_documento }),
        notificado_vencimento: false,
        status_revisao: 'nao_necessita',
        // Identidade NÃO verificada no upload — só o gate de OCR (CPF extraído
        // batendo com o perfil) pode marcar 'match'. 'unknown' evita que docs
        // trocados herdem prova falsa antes do OCR.
        identity_match: 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Erro ao salvar registro do documento:', insertError);
      await supabaseAdmin.storage.from('gestao-tripulantes-documentos').remove([filePath]);
      return NextResponse.json({ error: 'Erro ao salvar registro do documento' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: documento,
      message: 'Documento enviado com sucesso'
    }, { status: 201 });
  } catch (error) {
    console.error('Erro no upload de documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
