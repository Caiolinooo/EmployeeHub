import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string; // 'splash' | 'sound'
    const userId = (formData.get('userId') as string) || 'common';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop() || (type === 'sound' ? 'mp3' : 'png');
    const safeType = type === 'sound' ? 'sound' : 'splash';
    const timestamp = Date.now();
    const filePath = `${userId}/${safeType}_${timestamp}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload para o bucket user-startup-assets
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('user-startup-assets')
      .upload(filePath, buffer, {
        contentType: file.type || (safeType === 'sound' ? 'audio/mpeg' : 'image/png'),
        upsert: true,
      });

    if (uploadError) {
      console.error('Erro ao fazer upload no bucket user-startup-assets:', uploadError);
      return NextResponse.json(
        { success: false, error: `Falha no upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('user-startup-assets')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
    });
  } catch (error: any) {
    console.error('Erro na API de upload de asset de startup:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno no upload' },
      { status: 500 }
    );
  }
}
