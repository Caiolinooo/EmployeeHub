import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withPermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET - Obter um documento pelo ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { params } = context;
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;

    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('Erro ao obter documento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar um documento (somente ADMIN ou MANAGER)
export const PUT = withPermission('manager', async (
  request: NextRequest,
  _user: any,
  context: { params: Promise<{ id: string }> }
) => {
  const { params } = context;
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, category, language, file, enabled, order } = body;

    if (!title || !description || !category || !language || !file || order === undefined) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const { data: existingDocument, error: existingError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existingDocument) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    const { data: updatedDocument, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        title,
        description,
        category,
        language,
        file,
        enabled: enabled !== false,
        order,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao atualizar documento' }, { status: 500 });
    }

    return NextResponse.json(updatedDocument);
  } catch (error) {
    console.error('Erro ao atualizar documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
});

// DELETE - Excluir um documento (somente ADMIN ou MANAGER)
export const DELETE = withPermission('manager', async (
  request: NextRequest,
  _user: any,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const { data: existingDocument, error: findError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingDocument) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: 'Erro ao excluir documento' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Documento excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir documento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
});
