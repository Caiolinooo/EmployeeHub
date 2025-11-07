import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyRequestToken } from '@/lib/auth';
import { MobileUploadResponse } from '@/types/api-mobile';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const userId = authResult.payload.userId;
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const entityId = formData.get('entityId') as string;
    const metadata = formData.get('metadata') ? JSON.parse(formData.get('metadata') as string) : {};

    // Validar arquivo
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'Arquivo é obrigatório'
      }, { status: 400 });
    }

    // Validar tipo
    const allowedTypes = ['avatar', 'comprovante', 'documento'];
    if (!type || !allowedTypes.includes(type)) {
      return NextResponse.json({
        success: false,
        error: `Tipo deve ser um de: ${allowedTypes.join(', ')}`
      }, { status: 400 });
    }

    // Validar tamanho do arquivo (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'Arquivo muito grande. Máximo 10MB.'
      }, { status: 400 });
    }

    // Validar tipo MIME
    const allowedMimeTypes = {
      avatar: ['image/jpeg', 'image/png', 'image/webp'],
      comprovante: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      documento: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    };

    if (!allowedMimeTypes[type].includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de arquivo não permitido para ${type}`
      }, { status: 400 });
    }

    // Gerar nome único do arquivo
    const fileExtension = file.name.split('.').pop();
    const fileName = `${type}/${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;

    // Converter File para ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('mobile-uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao fazer upload do arquivo'
      }, { status: 500 });
    }

    // Obter URL pública
    const { data: publicUrlData } = supabase.storage
      .from('mobile-uploads')
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData.publicUrl;

    // Gerar thumbnail se for imagem
    let thumbnailUrl: string | undefined;
    if (file.type.startsWith('image/')) {
      try {
        thumbnailUrl = await generateThumbnail(fileName, buffer, file.type);
      } catch (error) {
        console.error('Erro ao gerar thumbnail:', error);
        // Não é crítico, continua sem thumbnail
      }
    }

    // Salvar metadados no banco
    const { data: fileRecord, error: dbError } = await supabase
      .from('mobile_uploads')
      .insert({
        id: uploadData.id || `upload_${Date.now()}`,
        user_id: userId,
        file_name: fileName,
        original_name: metadata.originalName || file.name,
        file_type: type,
        mime_type: file.type,
        file_size: file.size,
        file_url: fileUrl,
        thumbnail_url: thumbnailUrl,
        entity_id: entityId,
        metadata: {
          ...metadata,
          uploadedFrom: 'mobile',
          userAgent: request.headers.get('user-agent'),
          uploadedAt: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Erro ao salvar no banco:', dbError);
      // Tentar remover arquivo do storage
      await supabase.storage
        .from('mobile-uploads')
        .remove([fileName]);
      
      return NextResponse.json({
        success: false,
        error: 'Erro ao salvar informações do arquivo'
      }, { status: 500 });
    }

    // Atualizar referência se necessário
    if (entityId && type === 'avatar') {
      await supabase
        .from('users_unified')
        .update({ avatar_url: fileUrl })
        .eq('id', userId);
    }

    const response: MobileUploadResponse = {
      success: true,
      fileId: fileRecord.id,
      url: fileUrl,
      thumbnailUrl,
      metadata: {
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro no upload mobile:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

async function generateThumbnail(fileName: string, buffer: Uint8Array, mimeType: string): Promise<string> {
  // Aqui seria implementada a geração de thumbnail
  // Por simplicidade, vamos retornar a URL original
  // Em produção, seria usado uma biblioteca como Sharp ou similar
  
  try {
    // Simular geração de thumbnail
    const thumbnailFileName = fileName.replace(/(\.[^.]+)$/, '_thumb$1');
    
    // Em produção, aqui seria:
    // 1. Redimensionar a imagem
    // 2. Comprimir
    // 3. Fazer upload do thumbnail
    // 4. Retornar URL do thumbnail
    
    // Por enquanto, retornamos a URL original
    const { data } = supabase.storage
      .from('mobile-uploads')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
    
  } catch (error) {
    console.error('Erro ao gerar thumbnail:', error);
    throw error;
  }
}

// Endpoint para listar uploads do usuário
export async function GET(request: NextRequest) {
  try {
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const userId = authResult.payload.userId;
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const entityId = url.searchParams.get('entityId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('mobile_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('file_type', type);
    }

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    const { data: uploads, error } = await query;

    if (error) {
      console.error('Erro ao buscar uploads:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar uploads'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: uploads || [],
      pagination: {
        limit,
        offset,
        total: uploads?.length || 0
      }
    });

  } catch (error) {
    console.error('Erro ao listar uploads:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// Endpoint para deletar upload
export async function DELETE(request: NextRequest) {
  try {
    const authResult = verifyRequestToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const userId = authResult.payload.userId;
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({
        success: false,
        error: 'fileId é obrigatório'
      }, { status: 400 });
    }

    // Buscar arquivo
    const { data: file, error: fetchError } = await supabase
      .from('mobile_uploads')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json({
        success: false,
        error: 'Arquivo não encontrado'
      }, { status: 404 });
    }

    // Remover do storage
    const { error: storageError } = await supabase.storage
      .from('mobile-uploads')
      .remove([file.file_name]);

    if (storageError) {
      console.error('Erro ao remover do storage:', storageError);
    }

    // Remover thumbnail se existir
    if (file.thumbnail_url) {
      const thumbnailPath = file.file_name.replace(/(\.[^.]+)$/, '_thumb$1');
      await supabase.storage
        .from('mobile-uploads')
        .remove([thumbnailPath]);
    }

    // Remover do banco
    const { error: dbError } = await supabase
      .from('mobile_uploads')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('Erro ao remover do banco:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao remover arquivo'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Arquivo removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar upload:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
