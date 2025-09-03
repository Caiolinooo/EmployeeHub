import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

// POST - Upload de mídias de notícias para o Supabase Storage (bucket 'news')
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Coletar arquivos (aceita chaves 'file' e 'files')
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Pasta opcional
    const folder = (formData.get('folder') as string) || 'posts';

    // Garantir que o bucket 'news' exista (ignorar erro se já existir)
    try {
      // createBucket falha se existir; podemos tentar e ignorar 'Bucket already exists'
      // Nota: Alguns ambientes bloqueiam createBucket com anon; ideal com service role
      // Este supabaseAdmin deve estar com service role
      // @ts-ignore
      await (supabaseAdmin as any).storage.createBucket('news', { public: true });
    } catch (e) {
      // ignore
    }

    const uploaded: Array<{ originalName: string; path: string; url: string; type: string; size: number }> = [];

    for (const file of files) {
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = `${uuidv4()}.${ext}`;
      const filePath = `${folder}/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data, error } = await supabaseAdmin.storage.from('news').upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

      if (error) {
        console.error('Erro ao enviar para Supabase Storage:', error);
        return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
      }

      const { data: publicUrlData } = supabaseAdmin.storage.from('news').getPublicUrl(data.path);

      uploaded.push({
        originalName: file.name,
        path: data.path,
        url: publicUrlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }

    return NextResponse.json({ success: true, files: uploaded });
  } catch (error) {
    console.error('Erro em /api/news/upload:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

