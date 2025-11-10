import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withPermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET - Obter uma notícia pelo ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { params } = context;
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;

    const { data: news, error } = await supabaseAdmin
      .from('news')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !news) {
      return NextResponse.json(
        { error: 'Notícia não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(news);
  } catch (error) {
    console.error('Erro ao obter notícia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar uma notícia (somente ADMIN ou MANAGER)
export const PUT = withPermission('manager', async (
  request: NextRequest,
  _user: any,
  context: { params: Promise<{ id: string }> }
) => {
  const { params } = context;
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;
    console.log(`API de notícias - Iniciando atualização da notícia ID: ${id}`);

    const body = await request.json();
    console.log('Dados recebidos:', body);

    const { title, description, date, file, enabled, featured, category, author, thumbnail } = body;

    // Validar os dados de entrada
    if (!title || !description || !date || !category || !author) {
      console.log('Validação falhou - campos obrigatórios ausentes');
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar conexão com o Supabase (não é necessário conectar explicitamente)
    console.log('Usando Supabase para operações de banco de dados');

    // Verificar se a notícia existe
    console.log(`Verificando se a notícia ID ${id} existe...`);
    const { data: existingNews, error: findError } = await supabaseAdmin
      .from('news')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingNews) {
      console.log(`Notícia ID ${id} não encontrada`);
      return NextResponse.json(
        { error: 'Notícia não encontrada' },
        { status: 404 }
      );
    }

    console.log(`Notícia ID ${id} encontrada, atualizando...`);

    // Atualizar a notícia
    const { data: updatedNews, error: updateError } = await supabaseAdmin
      .from('news')
      .update({
        title,
        description,
        content: description, // Usar a descrição como conteúdo por padrão
        date: new Date(date).toISOString(),
        file: file || '', // Tornar o arquivo opcional
        enabled: enabled !== false,
        featured: featured || false,
        category,
        author,
        thumbnail,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar notícia:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar notícia', details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`Notícia ID ${id} atualizada com sucesso`);
    return NextResponse.json(updatedNews);
  } catch (error) {
    console.error('Erro ao atualizar notícia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
});

// DELETE - Excluir uma notícia (somente ADMIN ou MANAGER)
export const DELETE = withPermission('manager', async (
  request: NextRequest,
  _user: any,
  context: { params: Promise<{ id: string }> }
) => {
  const { params } = context;
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;
    console.log(`API de notícias - Iniciando exclusão da notícia ID: ${id}`);

    // Verificar se a notícia existe
    console.log(`Verificando se a notícia ID ${id} existe...`);
    const { data: existingNews, error: findError } = await supabaseAdmin
      .from('news')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingNews) {
      console.log(`Notícia ID ${id} não encontrada`);
      return NextResponse.json(
        { error: 'Notícia não encontrada' },
        { status: 404 }
      );
    }

    console.log(`Notícia ID ${id} encontrada, excluindo...`);

    // Excluir a notícia
    const { error: deleteError } = await supabaseAdmin
      .from('news')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao excluir notícia:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao excluir notícia', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log(`Notícia ID ${id} excluída com sucesso`);
    return NextResponse.json({ message: 'Notícia excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir notícia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
});
