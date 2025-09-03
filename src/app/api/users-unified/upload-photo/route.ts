import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
import { getCredential } from '@/lib/secure-credentials';
import { supabaseAdmin } from '@/lib/supabase';

// OBS: Preferimos Supabase Storage para fotos de perfil. Google Drive fica como fallback legado.
async function initializeGoogleDriveClient() {
  try {
    const { google } = await import('googleapis');
    const googleServiceAccountEmail = await getCredential('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const googleServiceAccountPrivateKey = await getCredential('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    if (!googleServiceAccountEmail || !googleServiceAccountPrivateKey) {
      return null; // Sem credenciais -> usaremos Supabase Storage
    }
    const auth = new google.auth.JWT({
      email: googleServiceAccountEmail,
      key: googleServiceAccountPrivateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.warn('Drive desabilitado, usando Supabase Storage. Detalhes:', error);
    return null;
  }
}

// Função auxiliar para validar tipos de imagem
function isValidImageType(mimeType: string): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  return validTypes.includes(mimeType);
}

// Função auxiliar para gerar nome de arquivo seguro
function generateFileName(firstName: string, lastName: string, originalName: string): string {
  const extension = originalName.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const safeName = `${firstName}_${lastName}_profile_${timestamp}.${extension}`;
  return safeName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação primeiro para economizar recursos
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Processar o formulário
    const formData = await request.formData();
    const photo = formData.get('photo') as File;
    const userId = formData.get('userId') as string;

    // Verificar se o usuário está tentando modificar seus próprios dados
    if (payload.userId !== userId && payload.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!photo) {
      return NextResponse.json(
        { error: 'Nenhuma foto enviada' },
        { status: 400 }
      );
    }

    // Verificar tipo de arquivo com validação mais específica
    if (!isValidImageType(photo.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Formatos aceitos: JPEG, PNG, WebP, GIF.' },
        { status: 400 }
      );
    }

    // Verificar tamanho do arquivo (máximo 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (photo.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande. O tamanho máximo é ${maxSize / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    // Inicializar cliente Supabase com configuração otimizada
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Buscar informações do usuário
    const { data: userData, error: userError } = await supabase
      .from('users_unified')
      .select('first_name, last_name, drive_photo_id')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Nome base do arquivo
    const fileName = generateFileName(
      userData.first_name || 'user',
      userData.last_name || 'photo',
      photo.name
    );

    // Tentar enviar para Supabase Storage (bucket: profile-photos)
    let fileUrl = '';
    try {
      const arrayBuffer = await photo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from('profile-photos')
        .upload(`${userId}/${fileName}`, buffer, {
          contentType: photo.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: publicUrl } = supabaseAdmin.storage
        .from('profile-photos')
        .getPublicUrl(`${userId}/${fileName}`);

      fileUrl = publicUrl.publicUrl;
    } catch (storageError) {
      console.warn('Falha ao usar Supabase Storage, tentando Google Drive…', storageError);

      // Fallback para Google Drive se storage falhar e credenciais estiverem disponíveis
      const drive = await initializeGoogleDriveClient();
      if (!drive) {
        return NextResponse.json(
          { error: 'Upload falhou: Storage e Drive indisponíveis' },
          { status: 500 }
        );
      }

      // Converter o arquivo para stream e enviar para Drive
      const arrayBuffer = await photo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: photo.type,
          parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined
        },
        media: {
          body: stream,
          mimeType: photo.type
        }
      });

      const fileId = response.data.id || '';
      if (!fileId) throw new Error('Falha ao criar arquivo no Google Drive');

      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' }
      });

      const fileResponse = await drive.files.get({ fileId, fields: 'webViewLink, webContentLink' });
      fileUrl = fileResponse.data.webContentLink || fileResponse.data.webViewLink || '';
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Falha ao obter URL do arquivo após upload' },
        { status: 500 }
      );
    }

    // Atualizar referência no banco de dados
    const { error: updateError } = await supabase
      .from('users_unified')
      .update({
        avatar: fileUrl,
        drive_photo_url: fileUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Erro ao atualizar referência da foto:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar referência da foto no banco de dados' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Foto de perfil atualizada com sucesso',
      photoUrl: fileUrl,
      fileId
    });
  } catch (error) {
    console.error('Erro ao processar requisição de upload:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao processar upload' },
      { status: 500 }
    );
  }
}
