import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withPermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET - Obter todos os documentos
export async function GET(request: NextRequest) {

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase.from('documents').select('*');

    if (category) {
      query = query.eq('category', category);
    }

    const { data: documents, error } = await query.order('order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar documentos:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Erro ao obter documentos:', error);

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar um novo documento (somente ADMIN ou MANAGER)
export const POST = withPermission('manager', async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { title, description, category, language, file, enabled, order } = body;

    if (!title || !description || !category || !language || !file || order === undefined) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        title,
        description,
        category,
        language,
        file,
        enabled: enabled !== false,
        order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar documento:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
});