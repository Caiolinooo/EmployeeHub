import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { processarDocumentoOCR, processarImagensPreRenderizadas, extrairDadosTexto } from '@/lib/ocr';
import { extrairDadosASODoTexto, aplicarGateIdentidadeDocumento, persistirCamposOcrDocumento } from '@/lib/gestao-tripulantes/ocr-processor';
import type { OCRTipoDocumento } from '@/types/ocr';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — LLM vision pode levar tempo

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

    const { data: documento, error: docError } = await supabaseAdmin
      .from('gt_documentos')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (docError || !documento) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    if (!documento.arquivo_url) {
      return NextResponse.json({ error: 'Documento não possui arquivo para processar OCR' }, { status: 400 });
    }

    // Atualizar status para processando
    await supabaseAdmin
      .from('gt_documentos')
      .update({ ocr_status: 'processando', updated_at: new Date().toISOString() })
      .eq('id', id);

    // Buscar CPF do perfil do colaborador para guiar a reconciliação contextual
    let profileCpf: string | null = null;
    if (documento.colaborador_id) {
      const { data: colab } = await supabaseAdmin
        .from('gt_colaboradores')
        .select('cpf')
        .eq('id', documento.colaborador_id)
        .maybeSingle();
      if (colab?.cpf) {
        profileCpf = colab.cpf.replace(/\D/g, '');
      }
    }

    // Verificar se o cliente enviou imagens pré-renderizadas, texto extraído, ou se usa processamento server-side
    let result;
    try {
      const body = await request.json();
      const clientImages: string[] | undefined = body?.images;
      const clientTextRaw: string | undefined = body?.text;
      const clientText = typeof clientTextRaw === 'string' ? clientTextRaw.trim() : '';

      if (clientText.length >= 30) {
        console.log(`[OCR/Route] Recebido texto extraído diretamente do cliente (${clientText.length} caracteres).`);
        const dadosRegex = extrairDadosTexto(clientText, documento.tipo_documento as OCRTipoDocumento, profileCpf);
        result = {
          success: true,
          data: {
            texto: clientText,
            dadosExtraidos: dadosRegex,
            confianca: 95
          }
        };
      } else if (clientImages && Array.isArray(clientImages) && clientImages.length > 0) {
        console.log(`[OCR/Route] Recebidas ${clientImages.length} imagens pré-renderizadas do cliente.`);
        result = await processarImagensPreRenderizadas(
          clientImages,
          documento.tipo_documento as OCRTipoDocumento,
          profileCpf
        );
      } else {
        // FLUXO LEGADO: Processamento server-side (pdf-parse, etc.)
        result = await processarDocumentoOCR(
          documento.arquivo_url,
          documento.tipo_documento as OCRTipoDocumento,
          profileCpf
        );
      }
    } catch {
      // Se o body não for JSON válido (ex: POST sem body), usar fluxo legado
      result = await processarDocumentoOCR(
        documento.arquivo_url,
        documento.tipo_documento as OCRTipoDocumento,
        profileCpf
      );
    }

    if (!result.success || !result.data) {
      await supabaseAdmin
        .from('gt_documentos')
        .update({
          ocr_status: 'erro',
          ocr_erro: result.error || 'Falha no processamento OCR',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      return NextResponse.json({ error: result.error || 'Erro ao processar OCR' }, { status: 500 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('gt_documentos')
      .update({
        ocr_status: 'concluido',
        ocr_texto: result.data.texto,
        ocr_dados_extraidos: result.data.dadosExtraidos,
        ocr_data: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar OCR do documento:', updateError);
      return NextResponse.json({ error: 'Erro ao salvar resultado do OCR' }, { status: 500 });
    }

    let asoIdentity: { identity_match?: string | null; cpf_documento?: string | null; colaborador_id?: string | null; esocial_status?: string | null } | null = null;
    let gateResultado: { identity_match: string | null; cpf_documento: string | null } = {
      identity_match: null,
      cpf_documento: null,
    };

    if (documento.tipo_documento === 'aso') {
      try {
        await extrairDadosASODoTexto(
          id,
          result.data.texto,
          result.data.dadosExtraidos,
          documento.colaborador_id,
          documento.data_emissao
        );
        const { data: asoRow } = await supabaseAdmin
          .from('gt_documentos_aso')
          .select('identity_match, cpf_documento, colaborador_id, esocial_status')
          .eq('documento_id', id)
          .maybeSingle();
        asoIdentity = asoRow;
        // Espelha o resultado do gate no documento (auditoria/quarentena na UI)
        if (asoRow?.identity_match) {
          await supabaseAdmin
            .from('gt_documentos')
            .update({
              identity_match: asoRow.identity_match,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        }
        gateResultado = {
          identity_match: asoRow?.identity_match ?? null,
          cpf_documento: asoRow?.cpf_documento ?? null,
        };
        await persistirCamposOcrDocumento(id, 'aso', result.data.dadosExtraidos, result.data.texto);
      } catch (asoErr) {
        console.error('Erro ao processar dados de ASO:', asoErr);
      }
    } else {
      // Gate de identidade para TODOS os tipos de documento:
      // passaporte, CNH, treinamentos etc. só podem ficar no dono do CPF.
      try {
        const gate = await aplicarGateIdentidadeDocumento(
          id,
          result.data.texto,
          result.data.dadosExtraidos,
          documento.colaborador_id
        );
        gateResultado = { identity_match: gate.identityMatch, cpf_documento: gate.cpfDocumento };
      } catch (gateErr) {
        console.error('Erro no gate de identidade do documento:', gateErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        documento: updated,
        aso_identity: asoIdentity,
        identity_gate: gateResultado,
        ocr: {
          confianca: result.data.confianca,
          dados_extraidos: result.data.dadosExtraidos,
          texto_extraido: result.data.texto.substring(0, 500)
        }
      }
    });
  } catch (error) {
    console.error('Erro na API OCR:', error);
    const msg = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
