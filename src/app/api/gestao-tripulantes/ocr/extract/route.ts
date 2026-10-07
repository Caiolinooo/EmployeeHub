import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { processarDocumentoOCR } from '@/lib/ocr';
import type { OCRTipoDocumento } from '@/types/ocr';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
    const tipoDocumento = (formData.get('tipo_documento') as string) || 'pessoal';

    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'pdf';
    const tempPath = `ocr-temp/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('gestao-tripulantes-documentos')
      .upload(tempPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Erro ao fazer upload: ' + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('gestao-tripulantes-documentos')
      .getPublicUrl(tempPath);

    const result = await processarDocumentoOCR(publicUrl, tipoDocumento as OCRTipoDocumento);

    await supabaseAdmin.storage
      .from('gestao-tripulantes-documentos')
      .remove([tempPath]);

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Falha no OCR (sem dados)' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: {
        campos: result.data.dadosExtraidos,
        texto_extraido: (result.data.texto || '').substring(0, 2000),
        confianca: result.data.confianca,
        tipo_documento: tipoDocumento,
      },
    });
  } catch (error) {
    console.error('[OCR Extract] Erro:', error);
    const msg = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
